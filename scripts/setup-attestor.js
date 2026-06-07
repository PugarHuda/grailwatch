/**
 * Creates a dedicated low-privilege attestor wallet for the serverless cron:
 *   1. generates a fresh wallet (or reuses ATTESTOR_PRIVATE_KEY from .env)
 *   2. registers it via setAttestor(addr, true) using the owner key
 *   3. sends it a little gas
 * Blast radius if the key ever leaks: a few thousandths of testnet zkLTC.
 * Usage: node scripts/setup-attestor.js
 */
require("dotenv").config();
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

const RPC_URL = "https://liteforge.rpc.caldera.xyz/http";
const ABI = [
  "function setAttestor(address attestor, bool allowed)",
  "function isAttestor(address) view returns (bool)",
];

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const owner = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const contract = new ethers.Contract(process.env.ATTESTATION_ADDRESS, ABI, owner);

  let attestor;
  if (process.env.ATTESTOR_PRIVATE_KEY) {
    attestor = new ethers.Wallet(process.env.ATTESTOR_PRIVATE_KEY, provider);
    console.log(`Reusing attestor wallet: ${attestor.address}`);
  } else {
    attestor = ethers.Wallet.createRandom().connect(provider);
    fs.appendFileSync(
      path.join(__dirname, "..", ".env"),
      `\n# Dedicated low-privilege wallet for the serverless cron attestor\nATTESTOR_PRIVATE_KEY=${attestor.privateKey}\n`
    );
    console.log(`Created attestor wallet: ${attestor.address} (written to .env)`);
  }

  if (!(await contract.isAttestor(attestor.address))) {
    const tx = await contract.setAttestor(attestor.address, true);
    await tx.wait();
    console.log(`Registered as attestor — tx ${tx.hash}`);
  } else {
    console.log("Already registered as attestor");
  }

  const balance = await provider.getBalance(attestor.address);
  if (balance < ethers.parseEther("0.002")) {
    const tx = await owner.sendTransaction({
      to: attestor.address,
      value: ethers.parseEther("0.005"),
    });
    await tx.wait();
    console.log(`Funded with 0.005 zkLTC gas — tx ${tx.hash}`);
  }
  console.log(
    `Attestor ready: ${attestor.address} (${ethers.formatEther(await provider.getBalance(attestor.address))} zkLTC)`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
