// Network + contract configuration for GrailWatch.

export const CHAIN = {
  id: 4441,
  name: "LitVM LiteForge",
  currency: "zkLTC",
  decimals: 18,
  rpcUrl: "https://liteforge.rpc.caldera.xyz/http",
  wsUrl: "wss://liteforge.rpc.caldera.xyz/ws",
  explorerUrl: "https://liteforge.explorer.caldera.xyz",
};

// Deployed ReserveAttestation contract. Set via .env:
//   VITE_ATTESTATION_ADDRESS=0x...
// Strip BOM / whitespace and validate — a stray ﻿ (e.g. injected by a
// shell pipe when setting the env var) makes ethers treat the address as an
// ENS name and throw "network does not support ENS", silently blanking the
// dashboard. Treat anything that isn't a clean 0x-address as unset.
function cleanAddress(raw) {
  // keep only visible ASCII — drops BOM (U+FEFF), zero-width chars, whitespace
  const a = (raw || "").replace(/[^\x21-\x7e]/g, "");
  return /^0x[0-9a-fA-F]{40}$/.test(a) ? a : "";
}
export const ATTESTATION_ADDRESS =
  cleanAddress(import.meta.env.VITE_ATTESTATION_ADDRESS) ||
  "0x57A318E48e5dB10EF3924d0a5Ac194C77032A1C8"; // ReserveAttestationV2 (quorum+median)

// Dashboard polling interval (ms).
export const REFRESH_INTERVAL = 15_000;

// 10000 bps = 100% = exactly 1:1 backing.
export const FULL_BACKING_BPS = 10_000;
