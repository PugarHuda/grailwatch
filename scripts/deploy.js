const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying ReserveAttestation with:", deployer.address);
  console.log(
    "Balance:",
    hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)),
    "zkLTC"
  );

  const attestation = await hre.ethers.deployContract("ReserveAttestation");
  await attestation.waitForDeployment();

  console.log("ReserveAttestation deployed to:", await attestation.getAddress());
  console.log(
    `Explorer: https://liteforge.explorer.caldera.xyz/address/${await attestation.getAddress()}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
