/**
 * Seed ReserveAttestationV3 with a real multi-attestor quorum, REUSING the
 * existing funded wallets so nothing is wasted and the cron keeps working:
 *   - owner (PRIVATE_KEY)
 *   - the Vercel cron attestor (ATTESTOR_PRIVATE_KEY)
 *   - attestor-2 / attestor-3 from scripts/.seed-attestors-v2.json
 * Each posts a REAL reading (real LTC balance via litecoinspace + real zkLTC
 * supply via Blockscout). Dashboard then shows "4 of 4 fresh · median 1178%".
 *
 * Usage: ATTESTATION_V3_ADDRESS=0x... node scripts/seed-v3.js
 * Env: PRIVATE_KEY, ATTESTOR_PRIVATE_KEY, LITECOIN_BRIDGE_ADDRESS
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
  "function isAttestor(address) view returns (bool)",
  "function status() view returns (uint8)",
  "function health() view returns (bool valid, bool fullyBacked, uint256 medianBps, uint256 freshCount)",
];
const MIN_GAS = ethers.parseEther("0.0008"); // top up below this

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
  const ADDR = process.env.ATTESTATION_V3_ADDRESS;
  if (!ADDR) throw new Error("set ATTESTATION_V3_ADDRESS");
  const provider = new ethers.JsonRpcProvider(RPC);
  const owner = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const reg = new ethers.Contract(ADDR, ABI, owner);

  // assemble the attestor wallets: owner + cron + the two saved ones
  const saved = JSON.parse(
    fs.readFileSync(path.join(__dirname, ".seed-attestors-v2.json"), "utf8")
  );
  const extras = [
    { name: "cron", wallet: new ethers.Wallet(process.env.ATTESTOR_PRIVATE_KEY, provider) },
    ...saved.map((s) => ({ name: s.name, wallet: new ethers.Wallet(s.privateKey, provider) })),
  ];

  // register + gas-fund each extra attestor
  for (const { name, wallet } of extras) {
    if (!(await reg.isAttestor(wallet.address))) {
      await (await reg.setAttestor(wallet.address, true)).wait();
    }
    const bal = await provider.getBalance(wallet.address);
    if (bal < MIN_GAS) {
      await (await owner.sendTransaction({ to: wallet.address, value: ethers.parseEther("0.0015") })).wait();
      console.log(`  funded ${name} ${wallet.address}`);
    }
    console.log(`registered ${name} ${wallet.address}`);
  }

  const { supplyWei, sats, ref } = await realData();
  console.log(`\nreal data: ${Number(sats) / 1e8} LTC reserve, ${ethers.formatEther(supplyWei)} zkLTC supply`);

  const all = [{ name: "owner", wallet: owner }, ...extras];
  for (const { name, wallet } of all) {
    const tx = await reg.connect(wallet).attest(sats, supplyWei, ref);
    await tx.wait();
    console.log(`  ${name} posted — tx ${tx.hash}`);
  }

  const h = await reg.health();
  const st = ["Unknown", "Healthy", "Unhealthy"][Number(await reg.status())];
  console.log(
    `\nstatus=${st} · valid=${h.valid} fullyBacked=${h.fullyBacked} ` +
      `median=${Number(h.medianBps) / 100}% freshCount=${h.freshCount}/${await reg.attestorCount()}`
  );
}
main().catch((e) => { console.error(e); process.exit(1); });
