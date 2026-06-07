const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ReserveAttestation", function () {
  let contract, owner, attestor, stranger;

  // 1,000 LTC locked (litoshis) vs 1,000 zkLTC supply (wei) => exactly 1:1
  const SATS_1000_LTC = 1000n * 10n ** 8n;
  const WEI_1000_ZKLTC = 1000n * 10n ** 18n;
  const REF = "litecoin-block-2900000-abc123";

  beforeEach(async function () {
    [owner, attestor, stranger] = await ethers.getSigners();
    contract = await ethers.deployContract("ReserveAttestation");
  });

  it("registers deployer as owner and first attestor", async function () {
    expect(await contract.owner()).to.equal(owner.address);
    expect(await contract.isAttestor(owner.address)).to.equal(true);
  });

  it("records a 1:1 attestation with 10000 bps ratio", async function () {
    await expect(contract.attest(SATS_1000_LTC, WEI_1000_ZKLTC, REF))
      .to.emit(contract, "Attested")
      .withArgs(0, owner.address, SATS_1000_LTC, WEI_1000_ZKLTC, 10000, REF);

    const latest = await contract.latest();
    expect(latest.ratioBps).to.equal(10000n);
    expect(await contract.isFullyBacked()).to.equal(true);
  });

  it("fires BackingAlert when backing drops below 1:1", async function () {
    // only 900 LTC locked backing 1000 zkLTC => 9000 bps
    const sats900 = 900n * 10n ** 8n;
    await expect(contract.attest(sats900, WEI_1000_ZKLTC, REF))
      .to.emit(contract, "BackingAlert")
      .withArgs(0, owner.address, 9000);
    expect(await contract.isFullyBacked()).to.equal(false);
  });

  it("does not fire BackingAlert at or above 1:1", async function () {
    const sats1100 = 1100n * 10n ** 8n; // overcollateralized: 11000 bps
    await expect(contract.attest(sats1100, WEI_1000_ZKLTC, REF)).to.not.emit(
      contract,
      "BackingAlert"
    );
  });

  it("rejects attestations from unregistered addresses", async function () {
    await expect(
      contract.connect(stranger).attest(SATS_1000_LTC, WEI_1000_ZKLTC, REF)
    ).to.be.revertedWithCustomError(contract, "NotAttestor");
  });

  it("owner can add and remove attestors", async function () {
    await contract.setAttestor(attestor.address, true);
    await expect(
      contract.connect(attestor).attest(SATS_1000_LTC, WEI_1000_ZKLTC, REF)
    ).to.emit(contract, "Attested");

    await contract.setAttestor(attestor.address, false);
    await expect(
      contract.connect(attestor).attest(SATS_1000_LTC, WEI_1000_ZKLTC, REF)
    ).to.be.revertedWithCustomError(contract, "NotAttestor");
  });

  it("only owner can manage attestors", async function () {
    await expect(
      contract.connect(stranger).setAttestor(stranger.address, true)
    ).to.be.revertedWithCustomError(contract, "NotOwner");
  });

  it("rejects zero zkLTC supply", async function () {
    await expect(contract.attest(SATS_1000_LTC, 0, REF)).to.be.revertedWithCustomError(
      contract,
      "ZeroSupply"
    );
  });

  it("paginates attestation history", async function () {
    for (let i = 1; i <= 5; i++) {
      await contract.attest(BigInt(i) * 10n ** 8n, BigInt(i) * 10n ** 18n, `ref-${i}`);
    }
    expect(await contract.attestationCount()).to.equal(5n);

    const page = await contract.getAttestations(1, 2);
    expect(page.length).to.equal(2);
    expect(page[0].litecoinRef).to.equal("ref-2");
    expect(page[1].litecoinRef).to.equal("ref-3");

    const empty = await contract.getAttestations(10, 5);
    expect(empty.length).to.equal(0);
  });
});
