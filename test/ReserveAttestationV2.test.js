const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("ReserveAttestationV2 — quorum + median + freshness", function () {
  let reg, owner, a2, a3, stranger;
  const LTC = (n) => BigInt(Math.round(n * 1e8)); // litoshis
  const ZK = (n) => BigInt(n) * 10n ** 18n; // wei
  const SUPPLY = ZK(1000);
  const REF = "litecoinspace:Mref";
  const QUORUM = 2, MAXAGE = 1000, MININT = 0;

  beforeEach(async function () {
    [owner, a2, a3, stranger] = await ethers.getSigners();
    reg = await ethers.deployContract("ReserveAttestationV2", [QUORUM, MAXAGE, MININT]);
    await reg.setAttestor(a2.address, true);
    await reg.setAttestor(a3.address, true);
  });

  // post an attestation implying a given backing %, from a given signer
  const post = (signer, pct) =>
    reg.connect(signer).attest(LTC((pct / 100) * 1000), SUPPLY, REF);

  describe("quorum + freshness gating", function () {
    it("reading is INVALID until >= quorum distinct attestors are fresh", async function () {
      await post(owner, 120);
      let h = await reg.health();
      expect(h.valid).to.equal(false); // only 1 fresh, quorum is 2
      expect(await reg.isFullyBacked()).to.equal(false);

      await post(a2, 120);
      h = await reg.health();
      expect(h.valid).to.equal(true);
      expect(h.freshCount).to.equal(2n);
      expect(await reg.isFullyBacked()).to.equal(true);
    });

    it("stale readings drop out of the quorum after maxAge", async function () {
      await post(owner, 120);
      await post(a2, 120);
      expect((await reg.health()).valid).to.equal(true);
      await time.increase(MAXAGE + 1); // both go stale
      const h = await reg.health();
      expect(h.freshCount).to.equal(0n);
      expect(h.valid).to.equal(false);
      expect(await reg.isFullyBacked()).to.equal(false);
    });
  });

  describe("median — one liar can't move it (the audit fix)", function () {
    it("a single attestor posting a fake high ratio cannot fake FULLY BACKED", async function () {
      // two honest attestors see ~95% backing, one malicious posts 5000%
      await post(owner, 95);
      await post(a2, 95);
      await post(a3, 5000); // liar
      const h = await reg.health();
      // median of [9500, 9500, 500000] = 9500 → under-backed, the lie is ignored
      expect(h.medianBps).to.equal(9500n);
      expect(h.fullyBacked).to.equal(false);
      expect(await reg.isFullyBacked()).to.equal(false);
    });

    it("median of an even set averages the two middle readings", async function () {
      await post(owner, 100);
      await post(a2, 110);
      // 2 fresh: median = (10000 + 11000)/2 = 10500
      expect((await reg.health()).medianBps).to.equal(10500n);
      expect(await reg.isFullyBacked()).to.equal(true);
    });

    it("uses each attestor's MOST RECENT reading only", async function () {
      await post(owner, 80); // stale-ish first reading
      await post(owner, 130); // owner updates
      await post(a2, 130);
      const h = await reg.health();
      expect(h.freshCount).to.equal(2n); // owner counted once, latest only
      expect(h.medianBps).to.equal(13000n);
    });
  });

  describe("status transitions", function () {
    it("emits StatusChanged healthy when quorum first turns fully backed", async function () {
      await post(owner, 120);
      await expect(post(a2, 120)).to.emit(reg, "StatusChanged").withArgs(true, 12000n, 2n);
    });
    it("emits StatusChanged unhealthy when the median drops below 1:1", async function () {
      await post(owner, 120);
      await post(a2, 120); // healthy
      // now both report under-backing
      await post(owner, 90);
      await expect(post(a2, 90)).to.emit(reg, "StatusChanged").withArgs(false, 9000n, 2n);
    });
    it("still emits the raw BackingAlert on an under-backed attestation", async function () {
      await expect(post(owner, 90)).to.emit(reg, "BackingAlert");
    });
  });

  describe("access control & rate limit", function () {
    it("non-attestor cannot attest", async function () {
      await expect(post(stranger, 120)).to.be.revertedWithCustomError(reg, "NotAttestor");
    });
    it("rejects zero supply", async function () {
      await expect(reg.attest(LTC(1000), 0, REF)).to.be.revertedWithCustomError(reg, "ZeroSupply");
    });
    it("enforces a per-attestor minimum interval", async function () {
      const r = await ethers.deployContract("ReserveAttestationV2", [1, MAXAGE, 60]);
      await r.attest(LTC(1000), SUPPLY, REF);
      await expect(r.attest(LTC(1000), SUPPLY, REF)).to.be.revertedWithCustomError(r, "RateLimited");
      await time.increase(61);
      await expect(r.attest(LTC(1000), SUPPLY, REF)).to.emit(r, "Attested");
    });
    it("only owner manages attestors; new attestors are listed once", async function () {
      await expect(reg.connect(stranger).setAttestor(stranger.address, true)).to.be.revertedWithCustomError(reg, "NotOwner");
      expect(await reg.attestorCount()).to.equal(3n); // owner + a2 + a3
      await reg.setAttestor(a2.address, false);
      await reg.setAttestor(a2.address, true); // re-enable reuses slot
      expect(await reg.attestorCount()).to.equal(3n);
    });
  });

  describe("2-step ownership", function () {
    it("transfers ownership only after the new owner accepts", async function () {
      await reg.transferOwnership(a2.address);
      expect(await reg.owner()).to.equal(owner.address); // not yet
      await expect(reg.connect(a3).acceptOwnership()).to.be.revertedWithCustomError(reg, "NotPendingOwner");
      await reg.connect(a2).acceptOwnership();
      expect(await reg.owner()).to.equal(a2.address);
    });
    it("renounce leaves no owner", async function () {
      await reg.renounceOwnership();
      expect(await reg.owner()).to.equal(ethers.ZeroAddress);
      await expect(reg.setAttestor(a2.address, true)).to.be.revertedWithCustomError(reg, "NotOwner");
    });
  });

  describe("history audit trail", function () {
    it("keeps an append-only history and paginates it", async function () {
      await post(owner, 100);
      await post(a2, 110);
      await post(a3, 120);
      expect(await reg.attestationCount()).to.equal(3n);
      const page = await reg.getAttestations(1, 2);
      expect(page.length).to.equal(2);
      expect(page[0].ratioBps).to.equal(11000n);
    });
  });
});
