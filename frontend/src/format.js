// Formatting helpers. All chain values arrive as BigInt from ethers v6.

const LITOSHIS = 100_000_000n; // 1e8 litoshis per LTC
const WEI = 10n ** 18n; // 1e18 wei per zkLTC

/** BigInt amount -> number with the given divisor (safe for display). */
function toNumber(amount, divisor) {
  // Keep 6 decimal places of precision before converting to Number.
  return Number((amount * 1_000_000n) / divisor) / 1_000_000;
}

export function ltcFromSats(sats) {
  return toNumber(sats, LITOSHIS);
}

export function zkLtcFromWei(wei) {
  return toNumber(wei, WEI);
}

export function formatAmount(value, maxDecimals = 4) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: maxDecimals,
  });
}

/** ratioBps (BigInt or number) -> "100.00" style percent string. */
export function formatRatio(ratioBps) {
  return (Number(ratioBps) / 100).toFixed(2);
}

export function shortAddress(addr) {
  if (!addr) return "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function formatTime(tsSeconds) {
  const d = new Date(Number(tsSeconds) * 1000);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function timeAgo(tsSeconds) {
  const secs = Math.max(0, Math.floor(Date.now() / 1000 - Number(tsSeconds)));
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

export function truncateRef(ref, max = 22) {
  if (!ref) return "—";
  if (ref.length <= max) return ref;
  return `${ref.slice(0, 10)}…${ref.slice(-8)}`;
}
