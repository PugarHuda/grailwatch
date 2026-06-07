const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ReserveAttestation — edge cases", function () {
  let contract, owner, attestor2, stranger;

  const LTC = (n) => BigInt(n) * 10n ** 8n; // litoshis
  const ZK = (n) => BigInt(n) * 10n ** 18n; // wei

  beforeEach(async function () {
    [owner, attestor2, stranger] = await ethers.getSigners();
    contract = await ethers.deployContract("ReserveAttestation");
  });

  describe("ratio math & rounding", function () {
    it("floors the ratio: 1 litoshi short of 1:1 triggers the alert", async function () {
      // 1000 LTC minus 1 litoshi backing 1000 zkLTC => 9999.999...99 bps -> floor 9999
      const sats = LTC(1000) - 1n;
      await expect(contract.attest(sats, ZK(1000), "ref")).to.emit(
        contract,
        "BackingAlert"
      );
      expect((await contract.latest()).ratioBps).to.equal(9999n);
    });

    it("exactly 1:1 does NOT alert (10000 bps boundary)", async function () {
      await expect(contract.attest(LTC(1000), ZK(1000), "ref")).to.not.emit(
        contract,
        "BackingAlert"
      );
      expect(await contract.isFullyBacked()).to.equal(true);
    });

    it("handles Litecoin max supply without overflow (84M LTC)", async function () {
      const sats = LTC(84_000_000);
      await contract.attest(sats, ZK(84_000_000), "max-supply");
      expect((await contract.latest()).ratioBps).to.equal(10000n);
    });

    it("handles extreme over-collateralization (dust supply)", async function () {
      // 1 LTC locked backing 1 wei of zkLTC
      await contract.attest(LTC(1), 1n, "dust");
      expect((await contract.latest()).ratioBps).to.equal(
        (LTC(1) * 10n ** 10n * 10000n) / 1n
      );
      expect(await contract.isFullyBacked()).to.equal(true);
    });

    it("zero LTC locked yields 0 bps and alerts", async function () {
      await expect(contract.attest(0, ZK(1000), "empty-bridge"))
        .to.emit(contract, "BackingAlert")
        .withArgs(0, owner.address, 0);
      expect(await contract.isFullyBacked()).to.equal(false);
    });
  });

  describe("empty state", function () {
    it("latest() reverts when no attestations exist", async function () {
      await expect(contract.latest()).to.be.revertedWith("no attestations");
    });

    it("isFullyBacked is false before any attestation", async function () {
      expect(await contract.isFullyBacked()).to.equal(false);
    });

    it("getAttestations on empty history returns empty array", async function () {
      expect(await contract.getAttestations(0, 10)).to.deep.equal([]);
    });
  });

  describe("pagination edges", function () {
    beforeEach(async function () {
      for (let i = 1; i <= 5; i++) {
        await contract.attest(LTC(i), ZK(i), `ref-${i}`);
      }
    });

    it("offset at exact end returns empty", async function () {
      expect((await contract.getAttestations(5, 10)).length).to.equal(0);
    });

    it("limit exceeding remainder is clamped", async function () {
      const page = await contract.getAttestations(3, 100);
      expect(page.length).to.equal(2);
      expect(page[1].litecoinRef).to.equal("ref-5");
    });

    it("limit 0 returns empty page", async function () {
      expect((await contract.getAttestations(0, 0)).length).to.equal(0);
    });

    it("single-element pages walk the whole history in order", async function () {
      for (let i = 0; i < 5; i++) {
        const page = await contract.getAttestations(i, 1);
        expect(page.length).to.equal(1);
        expect(page[0].litecoinRef).to.equal(`ref-${i + 1}`);
      }
    });
  });

  describe("attestor lifecycle", function () {
    it("history written by a removed attestor is preserved", async function () {
      await contract.setAttestor(attestor2.address, true);
      await contract.connect(attestor2).attest(LTC(10), ZK(10), "by-attestor2");
      await contract.setAttestor(attestor2.address, false);

      const latest = await contract.latest();
      expect(latest.attestor).to.equal(attestor2.address);
      expect(latest.litecoinRef).to.equal("by-attestor2");
    });

    it("owner can remove itself as attestor and is then rejected", async function () {
      await contract.setAttestor(owner.address, false);
      await expect(
        contract.attest(LTC(1), ZK(1), "x")
      ).to.be.revertedWithCustomError(contract, "NotAttestor");
      // but still owns the registry
      await contract.setAttestor(owner.address, true);
      await expect(contract.attest(LTC(1), ZK(1), "x")).to.emit(contract, "Attested");
    });

    it("attestations from multiple attestors keep correct attribution", async function () {
      await contract.setAttestor(attestor2.address, true);
      await contract.attest(LTC(1), ZK(1), "from-owner");
      await contract.connect(attestor2).attest(LTC(2), ZK(2), "from-2");
      const page = await contract.getAttestations(0, 10);
      expect(page[0].attestor).to.equal(owner.address);
      expect(page[1].attestor).to.equal(attestor2.address);
    });
  });

  describe("event integrity", function () {
    it("attestation ids increment sequentially in events", async function () {
      for (let i = 0; i < 3; i++) {
        await expect(contract.attest(LTC(1), ZK(1), `r${i}`))
          .to.emit(contract, "Attested")
          .withArgs(i, owner.address, LTC(1), ZK(1), 10000, `r${i}`);
      }
      expect(await contract.attestationCount()).to.equal(3n);
    });

    it("records block timestamp on the attestation", async function () {
      await contract.attest(LTC(1), ZK(1), "t");
      const block = await ethers.provider.getBlock("latest");
      expect((await contract.latest()).timestamp).to.equal(BigInt(block.timestamp));
    });
  });
});
