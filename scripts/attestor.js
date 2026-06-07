/**
 * GrailWatch attestor bot — observes both chains and posts proof-of-reserves
 * attestations on-chain.
 *
 *   Litecoin side : LTC locked in the bridge (litoshis)
 *   LitVM side    : zkLTC supply observed on LiteForge (wei)
 *
 * On mainnet this would point at the actual Grail Bridge UTXOs on Litecoin.
 * On testnet the bridge address is not public, so the Litecoin observation is
 * configurable: set LITECOIN_BRIDGE_ADDRESS to watch a real address via the
 * litecoinspace.org API, or LTC_LOCKED_OVERRIDE (in LTC) to simulate readings
 * for the demo. The zkLTC supply is read live from the LiteForge Blockscout API.
 *
 * Usage: node scripts/attestor.js [intervalSeconds]   (default: one-shot)
 */
require("dotenv").config();
const { ethers } = require("ethers");

const RPC_URL = "https://liteforge.rpc.caldera.xyz/http";
const BLOCKSCOUT_STATS = "https://liteforge.explorer.caldera.xyz/api/v2/stats";
const LITECOINSPACE_API = "https://litecoinspace.org/api/address";

const ABI = [
  "function attest(uint256 ltcLockedSats, uint256 zkLtcSupplyWei, string litecoinRef) returns (uint256)",
  "function latest() view returns (tuple(address attestor, uint64 timestamp, uint256 ltcLockedSats, uint256 zkLtcSupplyWei, uint256 ratioBps, string litecoinRef))",
  "event Attested(uint256 indexed id, address indexed attestor, uint256 ltcLockedSats, uint256 zkLtcSupplyWei, uint256 ratioBps, string litecoinRef)",
  "event BackingAlert(uint256 indexed id, address indexed attestor, uint256 ratioBps)",
];

/**
 * zkLTC native supply on LiteForge.
 * Tries Blockscout v2 stats, then the v1 ethsupply endpoint. The LiteForge
 * Blockscout instance currently reports 0 / no supply for the native coin,
 * so a ZKLTC_SUPPLY_OVERRIDE (in zkLTC) fallback is supported for the demo —
 * on mainnet attestors would derive supply from Grail Bridge mint/burn events.
 */
async function getZkLtcSupplyWei() {
  try {
    const res = await fetch(BLOCKSCOUT_STATS, { headers: { accept: "application/json" } });
    if (res.ok) {
      const stats = await res.json();
      // coin_total_supply is denominated in whole coins; total_supply is in wei
      if (stats.coin_total_supply != null && Number(stats.coin_total_supply) > 0) {
        return { wei: ethers.parseEther(String(stats.coin_total_supply)), source: "blockscout-v2" };
      }
      if (stats.total_supply != null && BigInt(stats.total_supply) > 0n) {
        return { wei: BigInt(stats.total_supply), source: "blockscout-v2" };
      }
    }
    const res1 = await fetch(
      "https://liteforge.explorer.caldera.xyz/api?module=stats&action=ethsupply"
    );
    if (res1.ok) {
      const data = await res1.json();
      if (data.result && BigInt(data.result) > 0n) {
        return { wei: BigInt(data.result), source: "blockscout-v1" };
      }
    }
  } catch (err) {
    console.warn(`Blockscout supply lookup failed (${err.message}) — trying override`);
  }
  if (process.env.ZKLTC_SUPPLY_OVERRIDE) {
    return { wei: ethers.parseEther(process.env.ZKLTC_SUPPLY_OVERRIDE), source: "override" };
  }
  throw new Error(
    "LiteForge Blockscout does not expose native zkLTC supply — set ZKLTC_SUPPLY_OVERRIDE (in zkLTC) in .env"
  );
}

/** LTC locked on the Litecoin side, in litoshis. */
async function getLtcLockedSats() {
  const addr = process.env.LITECOIN_BRIDGE_ADDRESS;
  if (addr) {
    const res = await fetch(`${LITECOINSPACE_API}/${addr}`);
    if (!res.ok) throw new Error(`litecoinspace ${res.status}`);
    const data = await res.json();
    // BigInt subtraction — float math loses precision past 2^53 litoshis
    const sats =
      BigInt(data.chain_stats.funded_txo_sum) - BigInt(data.chain_stats.spent_txo_sum);
    return { sats, ref: `litecoinspace:${addr}` };
  }
  if (process.env.LTC_LOCKED_OVERRIDE) {
    const sats = BigInt(Math.round(Number(process.env.LTC_LOCKED_OVERRIDE) * 1e8));
    return { sats, ref: "override:demo-observation" };
  }
  throw new Error("Set LITECOIN_BRIDGE_ADDRESS or LTC_LOCKED_OVERRIDE in .env");
}

async function attestOnce(contract) {
  const [supply, locked] = await Promise.all([getZkLtcSupplyWei(), getLtcLockedSats()]);

  console.log(`🔍 zkLTC supply (LitVM, ${supply.source}): ${ethers.formatEther(supply.wei)} zkLTC`);
  console.log(`🔍 LTC locked (Litecoin, ${locked.ref}): ${Number(locked.sats) / 1e8} LTC`);

  const tx = await contract.attest(locked.sats, supply.wei, locked.ref);
  const receipt = await tx.wait();

  const latest = await contract.latest();
  const ratio = Number(latest.ratioBps) / 100;
  const status = latest.ratioBps >= 10000n ? "✅ FULLY BACKED" : "🚨 UNDER-BACKED";
  console.log(`⛓️  Attestation posted — ratio ${ratio.toFixed(2)}% ${status}`);
  console.log(`    tx: https://liteforge.explorer.caldera.xyz/tx/${receipt.hash}\n`);
}

async function main() {
  for (const k of ["PRIVATE_KEY", "ATTESTATION_ADDRESS"]) {
    if (!process.env[k]) {
      console.error(`Missing ${k} in .env`);
      process.exit(1);
    }
  }
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const contract = new ethers.Contract(process.env.ATTESTATION_ADDRESS, ABI, wallet);

  console.log(`🛡️  GrailWatch attestor online — ${wallet.address}\n`);

  const intervalSec = Number(process.argv[2] ?? 0);
  if (Number.isFinite(intervalSec) && intervalSec > 0) {
    // daemon mode: one bad tick (API rate limit, RPC hiccup) must not kill the observer
    for (;;) {
      try {
        await attestOnce(contract);
      } catch (err) {
        console.error(`⚠️  Attestation tick failed: ${err.message?.slice(0, 140)} — retrying next interval`);
      }
      await new Promise((r) => setTimeout(r, intervalSec * 1000));
    }
  } else {
    await attestOnce(contract);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
