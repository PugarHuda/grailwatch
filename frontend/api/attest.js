/**
 * Serverless attestor — Vercel Cron hits this endpoint on schedule, so the
 * proof-of-reserves feed keeps itself fresh with no machine left running.
 *
 * Reads the live zkLTC supply from the LiteForge Blockscout API, the
 * Litecoin-side observation from env (or litecoinspace.org when a real
 * bridge address is configured), and posts an attestation on-chain.
 *
 * Protected: requires the CRON_SECRET bearer token (sent automatically by
 * Vercel Cron) so strangers can't drain the attestor wallet's gas.
 */
import { ethers } from "ethers";

const RPC_URL = "https://liteforge.rpc.caldera.xyz/http";
const SUPPLY_API = "https://liteforge.explorer.caldera.xyz/api?module=stats&action=ethsupply";
const LITECOINSPACE_API = "https://litecoinspace.org/api/address";

const ABI = [
  "function attest(uint256 ltcLockedSats, uint256 zkLtcSupplyWei, string litecoinRef) returns (uint256)",
  "function latest() view returns (tuple(address attestor, uint64 timestamp, uint256 ltcLockedSats, uint256 zkLtcSupplyWei, uint256 ratioBps, string litecoinRef))",
];

async function getZkLtcSupplyWei() {
  try {
    const res = await fetch(SUPPLY_API);
    if (res.ok) {
      const data = await res.json();
      if (data.result && BigInt(data.result) > 0n) {
        return { wei: BigInt(data.result), source: "blockscout-v1" };
      }
    }
  } catch {
    // fall through to the override — a flaky explorer must not kill the cron
  }
  if (process.env.ZKLTC_SUPPLY_OVERRIDE) {
    return { wei: ethers.parseEther(process.env.ZKLTC_SUPPLY_OVERRIDE), source: "override" };
  }
  throw new Error("no zkLTC supply source available");
}

async function getLtcLockedSats() {
  const addr = process.env.LITECOIN_BRIDGE_ADDRESS;
  if (addr) {
    const res = await fetch(`${LITECOINSPACE_API}/${addr}`);
    if (!res.ok) throw new Error(`litecoinspace ${res.status}`);
    const data = await res.json();
    return {
      sats: BigInt(data.chain_stats.funded_txo_sum) - BigInt(data.chain_stats.spent_txo_sum),
      ref: `litecoinspace:${addr}`,
    };
  }
  if (process.env.LTC_LOCKED_OVERRIDE) {
    return {
      sats: BigInt(Math.round(Number(process.env.LTC_LOCKED_OVERRIDE) * 1e8)),
      ref: "override:scheduled-observation",
    };
  }
  throw new Error("set LITECOIN_BRIDGE_ADDRESS or LTC_LOCKED_OVERRIDE");
}

export default async function handler(req, res) {
  // Vercel Cron sends "Authorization: Bearer <CRON_SECRET>" — and an unset
  // secret must fail closed, not let "Bearer undefined" through
  if (
    !process.env.CRON_SECRET ||
    req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return res.status(401).json({ error: "unauthorized" });
  }

  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    provider.pollingInterval = 500; // LiteForge blocks land in ~0.25-2s; don't burn the 10s budget waiting
    const wallet = new ethers.Wallet(process.env.ATTESTOR_PRIVATE_KEY, provider);
    const contract = new ethers.Contract(
      process.env.ATTESTATION_ADDRESS || process.env.VITE_ATTESTATION_ADDRESS,
      ABI,
      wallet
    );

    const [supply, locked] = await Promise.all([getZkLtcSupplyWei(), getLtcLockedSats()]);
    const tx = await contract.attest(locked.sats, supply.wei, locked.ref);
    const receipt = await tx.wait();
    const latest = await contract.latest();

    return res.status(200).json({
      ok: true,
      tx: receipt.hash,
      ratioBps: latest.ratioBps.toString(),
      fullyBacked: latest.ratioBps >= 10000n,
      supplySource: supply.source,
      litecoinRef: locked.ref,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
