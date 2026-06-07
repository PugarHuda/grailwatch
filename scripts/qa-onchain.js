/**
 * On-chain QA: verifies the deployed ReserveAttestation state on LiteForge
 * using the same reads the dashboard performs.
 * Usage: node scripts/qa-onchain.js
 */
require("dotenv").config();
const { ethers } = require("ethers");

const RPC_URL = "https://liteforge.rpc.caldera.xyz/http";
const ABI = [
  "function latest() view returns (tuple(address attestor, uint64 timestamp, uint256 ltcLockedSats, uint256 zkLtcSupplyWei, uint256 ratioBps, string litecoinRef))",
  "function isFullyBacked() view returns (bool)",
  "function attestationCount() view returns (uint256)",
  "function getAttestations(uint256 offset, uint256 limit) view returns (tuple(address attestor, uint64 timestamp, uint256 ltcLockedSats, uint256 zkLtcSupplyWei, uint256 ratioBps, string litecoinRef)[])",
  "function owner() view returns (address)",
  "function isAttestor(address) view returns (bool)",
];

let failures = 0;
function check(label, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const contract = new ethers.Contract(process.env.ATTESTATION_ADDRESS, ABI, provider);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY);

  console.log(`QA target: ${process.env.ATTESTATION_ADDRESS} (LiteForge ${(await provider.getNetwork()).chainId})\n`);

  const code = await provider.getCode(process.env.ATTESTATION_ADDRESS);
  check("contract bytecode exists on-chain", code !== "0x", `${(code.length - 2) / 2} bytes`);

  check("deployer is owner", (await contract.owner()) === wallet.address);
  check("deployer is registered attestor", await contract.isAttestor(wallet.address));

  const count = await contract.attestationCount();
  check("attestation history is non-empty", count > 0n, `count=${count}`);

  const all = await contract.getAttestations(0, 1000);
  check("getAttestations returns the full history", BigInt(all.length) === count);

  const latest = await contract.latest();
  const last = all[all.length - 1];
  check(
    "latest() matches the last history entry",
    latest.timestamp === last.timestamp && latest.ratioBps === last.ratioBps
  );

  // ratio math re-verified off-chain for every entry
  const ratioOk = all.every(
    (a) => a.ratioBps === (a.ltcLockedSats * 10n ** 10n * 10000n) / a.zkLtcSupplyWei
  );
  check("ratioBps re-computes correctly for every attestation", ratioOk);

  // isFullyBacked agrees with the latest ratio
  check(
    "isFullyBacked() agrees with latest ratioBps",
    (await contract.isFullyBacked()) === latest.ratioBps >= 10000n,
    `ratio=${Number(latest.ratioBps) / 100}%`
  );

  // history contains at least one alert-worthy entry and ends healthy (demo arc)
  check(
    "history contains an under-backed entry (alert demo)",
    all.some((a) => a.ratioBps < 10000n)
  );
  check("latest reading is fully backed", latest.ratioBps >= 10000n);

  // pagination spot-check, same as the dashboard's paged reads
  const page = await contract.getAttestations(1, 2);
  check(
    "pagination window returns the right slice",
    page.length === 2 && page[0].timestamp === all[1].timestamp
  );

  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : failures + " CHECK(S) FAILED"}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
