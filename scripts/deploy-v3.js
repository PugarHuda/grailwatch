const hre = require("hardhat");
// quorum=2 distinct fresh attestors, freshness window 2 days, 30s rate-limit
// (minInterval < maxAge is enforced on-chain in V3)
const QUORUM = Number(process.env.QUORUM || 2);
const MAXAGE = Number(process.env.MAXAGE || 172800);
const MININT = Number(process.env.MININT || 30);
async function main() {
  const c = await hre.ethers.deployContract("ReserveAttestationV3", [QUORUM, MAXAGE, MININT]);
  await c.waitForDeployment();
  const a = await c.getAddress();
  console.log("ReserveAttestationV3:", a, `(quorum ${QUORUM}, maxAge ${MAXAGE}s, minInterval ${MININT}s)`);
  console.log("block:", (await hre.ethers.provider.getBlock("latest")).number);
}
main().catch((e) => { console.error(e); process.exit(1); });
