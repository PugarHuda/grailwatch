// Network + contract configuration for GrailWatch.

export const CHAIN = {
  id: 4441,
  name: "LitVM LiteForge",
  currency: "zkLTC",
  decimals: 18,
  rpcUrl: "https://liteforge.rpc.caldera.xyz/http",
  explorerUrl: "https://liteforge.explorer.caldera.xyz",
};

// Deployed ReserveAttestation contract. Set via .env:
//   VITE_ATTESTATION_ADDRESS=0x...
export const ATTESTATION_ADDRESS =
  import.meta.env.VITE_ATTESTATION_ADDRESS || "";

// Dashboard polling interval (ms).
export const REFRESH_INTERVAL = 15_000;

// 10000 bps = 100% = exactly 1:1 backing.
export const FULL_BACKING_BPS = 10_000;
