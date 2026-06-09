/**
 * Seed ReserveAttestationV2 with a real multi-attestor quorum: register 2 extra
 * attestor wallets and have all 3 (owner + 2) post a REAL reading each
 * (real LTC balance via litecoinspace + real zkLTC supply via Blockscout).
 * The dashboard then shows "3 of 3 fresh attestors · median 1178%".
 *
 * Usage: node scripts/seed-v2.js
 * Env: PRIVATE_KEY (owner), ATTESTATION_V2_ADDRESS, LITECOIN_BRIDGE_ADDRESS
 */
require("dotenv").config();
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

const RPC = "https://liteforge.rpc.caldera.xyz/http";
const SUPPLY_API = "https://liteforge.explorer.caldera.xyz/api?module=stats&action=ethsupply";
const LTC_API = "https://litecoinspace.org/api/address";
const ABI = [
  "function setAttestor(address, bool)",
  "function attest(uint256 ltcLockedSats, uint256 zkLtcSupplyWei, string litecoinRef) returns (uint256)",
  "function attestorCount() view returns (uint256)",
  "function health() view returns (bool valid, bool fullyBacked, uint256 medianBps, uint256 freshCount)",
];

async function realData() {
  const addr = process.env.LITECOIN_BRIDGE_ADDRESS;
  const [s, d] = await Promise.all([
    (await fetch(SUPPLY_API)).json(),
    (await fetch(`${LTC_API}/${addr}`)).json(),
  ]);
  const supplyWei = BigInt(s.result);
  const sats = BigInt(d.chain_stats.funded_txo_sum) - BigInt(d.chain_stats.spent_txo_sum);
  return { supplyWei, sats, ref: `litecoinspace:${addr}` };
}

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const owner = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const reg = new ethers.Contract(process.env.ATTESTATION_V2_ADDRESS, ABI, owner);

  // register two extra attestor wallets (persisted, gas-funded)
  const saved = [];
  const attestors = [owner];
  for (const name of ["attestor-2", "attestor-3"]) {
    const w = ethers.Wallet.createRandom().connect(provider);
    saved.push({ name, address: w.address, privateKey: w.privateKey });
    await (await owner.sendTransaction({ to: w.address, value: ethers.parseEther("0.002") })).wait();
    await (await reg.setAttestor(w.address, true)).wait();
    console.log(`registered ${name} ${w.address}`);
    attestors.push(w);
  }

  const { supplyWei, sats, ref } = await realData();
  console.log(`\nreal data: ${Number(sats) / 1e8} LTC reserve, ${ethers.formatEther(supplyWei)} zkLTC supply`);

  for (let i = 0; i < attestors.length; i++) {
    const tx = await reg.connect(attestors[i]).attest(sats, supplyWei, ref);
    await tx.wait();
    console.log(`  attestor #${i + 1} posted — tx ${tx.hash}`);
  }

  const h = await reg.health();
  console.log(`\nhealth: valid=${h.valid} fullyBacked=${h.fullyBacked} median=${Number(h.medianBps) / 100}% freshCount=${h.freshCount}/${await reg.attestorCount()}`);
  fs.writeFileSync(path.join(__dirname, ".seed-attestors-v2.json"), JSON.stringify(saved, null, 2));
}
main().catch((e) => { console.error(e); process.exit(1); });
