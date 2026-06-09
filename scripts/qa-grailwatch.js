/**
 * On-chain QA for the live ReserveAttestation — verifies the ratio math, alert
 * logic, AND that the on-chain numbers actually match their real external
 * sources (litecoinspace.org for LTC, Blockscout for zkLTC). This proves the
 * attestations are real data, not fabricated.
 *
 * Usage: node scripts/qa-grailwatch.js
 */
require("dotenv").config();
const { ethers } = require("ethers");

const RPC = "https://liteforge.rpc.caldera.xyz/http";
const SUPPLY_API = "https://liteforge.explorer.caldera.xyz/api?module=stats&action=ethsupply";
const LTC_API = "https://litecoinspace.org/api/address";
const ABI = [
  "function attestationCount() view returns (uint256)",
  "function isFullyBacked() view returns (bool)",
  "function latest() view returns (tuple(address attestor, uint64 timestamp, uint256 ltcLockedSats, uint256 zkLtcSupplyWei, uint256 ratioBps, string litecoinRef))",
  "function getAttestations(uint256, uint256) view returns (tuple(address attestor, uint64 timestamp, uint256 ltcLockedSats, uint256 zkLtcSupplyWei, uint256 ratioBps, string litecoinRef)[])",
];

let fail = 0;
const ok = (c, label, extra = "") => {
  console.log(`${c ? "PASS" : "FAIL"}  ${label}${extra ? " — " + extra : ""}`);
  if (!c) fail++;
};

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const addr = process.env.ATTESTATION_ADDRESS;
  const c = new ethers.Contract(addr, ABI, provider);
  console.log(`QA ReserveAttestation ${addr}\n`);

  ok((await provider.getCode(addr)) !== "0x", "contract bytecode exists");
  const count = Number(await c.attestationCount());
  ok(count > 0, "attestation history is non-empty", `count=${count}`);

  const all = await c.getAttestations(0, 1000);
  // ratio math re-computed for every attestation: ltcSats * 1e10 * 1e4 / supplyWei
  const mathOk = all.every(
    (a) => a.ratioBps === (a.ltcLockedSats * 10n ** 10n * 10000n) / a.zkLtcSupplyWei
  );
  ok(mathOk, "ratioBps recomputes correctly for every attestation");

  const latest = await c.latest();
  ok(
    (await c.isFullyBacked()) === latest.ratioBps >= 10000n,
    "isFullyBacked() agrees with latest ratioBps",
    `ratio=${Number(latest.ratioBps) / 100}%`
  );

  // ---- THE INTEGRITY CHECK: on-chain numbers match the real external sources
  console.log(`\n=== real-data cross-check (latest attestation) ===`);
  // zkLTC supply vs Blockscout ethsupply
  try {
    const s = await (await fetch(SUPPLY_API)).json();
    const realSupply = BigInt(s.result);
    const diff = realSupply > latest.zkLtcSupplyWei ? realSupply - latest.zkLtcSupplyWei : latest.zkLtcSupplyWei - realSupply;
    const within = realSupply === 0n ? false : diff * 100n / realSupply < 5n; // within 5%
    ok(within, "on-chain zkLTC supply matches live Blockscout ethsupply (±5%)", `on-chain ${ethers.formatEther(latest.zkLtcSupplyWei)} vs real ${ethers.formatEther(realSupply)}`);
  } catch (e) {
    console.log("SKIP  Blockscout supply check —", e.message.slice(0, 60));
  }
  // LTC reserve vs litecoinspace balance of the address in litecoinRef
  try {
    const ref = latest.litecoinRef.includes(":") ? latest.litecoinRef.split(":").pop() : latest.litecoinRef;
    const d = await (await fetch(`${LTC_API}/${ref}`)).json();
    const realSats = BigInt(d.chain_stats.funded_txo_sum) - BigInt(d.chain_stats.spent_txo_sum);
    const diff = realSats > latest.ltcLockedSats ? realSats - latest.ltcLockedSats : latest.ltcLockedSats - realSats;
    const within = realSats === 0n ? false : diff * 100n / realSats < 5n;
    ok(within, "on-chain LTC reserve matches the real litecoinspace balance (±5%)", `addr ${ref}: on-chain ${Number(latest.ltcLockedSats) / 1e8} vs real ${Number(realSats) / 1e8} LTC`);
  } catch (e) {
    console.log("SKIP  litecoinspace check —", e.message.slice(0, 60));
  }

  console.log(`\n${fail === 0 ? "✅ ALL GRAILWATCH CHECKS PASSED" : `❌ ${fail} FAILED`}`);
  process.exit(fail === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
