const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

// Status enum: Unknown=0, Healthy=1, Unhealthy=2
const UNKNOWN = 0, HEALTHY = 1, UNHEALTHY = 2;

describe("ReserveAttestationV3 — hardened quorum + median + freshness", function () {
  let reg, owner, a2, a3, stranger;
  const LTC = (n) => BigInt(Math.round(n * 1e8)); // litoshis
  const ZK = (n) => BigInt(n) * 10n ** 18n; // wei
  const SUPPLY = ZK(1000);
  const REF = "litecoinspace:Mref";
  const QUORUM = 2, MAXAGE = 1000, MININT = 0;

  beforeEach(async function () {
    [owner, a2, a3, stranger] = await ethers.getSigners();
    reg = await ethers.deployContract("ReserveAttestationV3", [QUORUM, MAXAGE, MININT]);
    await reg.setAttestor(a2.address, true);
    await reg.setAttestor(a3.address, true);
  });

  const post = (signer, pct) =>
    reg.connect(signer).attest(LTC((pct / 100) * 1000), SUPPLY, REF);

  describe("quorum + freshness gating", function () {
    it("reading is INVALID until >= quorum distinct attestors are fresh", async function () {
      await post(owner, 120);
      let h = await reg.health();
      expect(h.valid).to.equal(false);
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
      await time.increase(MAXAGE + 1);
      const h = await reg.health();
      expect(h.freshCount).to.equal(0n);
      expect(h.valid).to.equal(false);
      expect(await reg.isFullyBacked()).to.equal(false);
    });

    it("a reading exactly at the freshness boundary still counts (inclusive)", async function () {
      // deterministic timing: quorum-1 contract, single owner attestor
      const r = await ethers.deployContract("ReserveAttestationV3", [1, MAXAGE, MININT]);
      const base = (await time.latest()) + 100;
      await time.setNextBlockTimestamp(base);
      await r.attest(LTC(1200), SUPPLY, REF); // reading at t = base
      // view exactly maxAge later: cutoff == base, at.timestamp == cutoff → fresh
      await time.setNextBlockTimestamp(base + MAXAGE);
      await ethers.provider.send("evm_mine", []);
      expect((await r.health()).freshCount).to.equal(1n); // boundary inclusive
      expect(await r.isFullyBacked()).to.equal(true);
      // one second past the window → stale, drops out
      await time.setNextBlockTimestamp(base + MAXAGE + 1);
      await ethers.provider.send("evm_mine", []);
      expect((await r.health()).freshCount).to.equal(0n);
    });
  });

  describe("median — one liar can't move it (the V2 audit fix)", function () {
    it("a single attestor posting a fake high ratio cannot fake FULLY BACKED", async function () {
      await post(owner, 95);
      await post(a2, 95);
      await post(a3, 5000); // liar
      const h = await reg.health();
      expect(h.medianBps).to.equal(9500n);
      expect(h.fullyBacked).to.equal(false);
      expect(await reg.isFullyBacked()).to.equal(false);
    });

    it("median of an even set averages the two middle readings", async function () {
      await post(owner, 100);
      await post(a2, 110);
      expect((await reg.health()).medianBps).to.equal(10500n);
      expect(await reg.isFullyBacked()).to.equal(true);
    });

    it("uses each attestor's MOST RECENT reading only", async function () {
      await post(owner, 80);
      await post(owner, 130);
      await post(a2, 130);
      const h = await reg.health();
      expect(h.freshCount).to.equal(2n);
      expect(h.medianBps).to.equal(13000n);
    });
  });

  // ----------------------------------------------------------- V3 hardening
  describe("V3 #1 — attestor cap bounds the health() hot path (anti-DoS)", function () {
    it("exposes a MAX_ATTESTORS cap", async function () {
      expect(await reg.MAX_ATTESTORS()).to.equal(64n);
    });
    it("reverts once the cap is reached so attest() can never exceed gas", async function () {
      // tiny-cap behaviour is proven structurally: fill to the cap and expect revert.
      // Deploy a fresh contract (owner already occupies slot 0) and add up to 64.
      const r = await ethers.deployContract("ReserveAttestationV3", [1, MAXAGE, MININT]);
      const wallets = [];
      // owner is slot 0; add 63 more to reach 64, then the 65th must revert
      for (let i = 0; i < 63; i++) {
        wallets.push(ethers.Wallet.createRandom().address);
        await r.setAttestor(wallets[i], true);
      }
      expect(await r.attestorCount()).to.equal(64n);
      await expect(
        r.setAttestor(ethers.Wallet.createRandom().address, true)
      ).to.be.revertedWithCustomError(r, "TooManyAttestors");
      // re-enabling an already-listed (disabled) attestor still works at the cap
      await r.setAttestor(wallets[0], false);
      await expect(r.setAttestor(wallets[0], true)).to.emit(r, "AttestorSet");
      expect(await r.attestorCount()).to.equal(64n);
    });
  });

  describe("V3 #2 — 3-state status never lies pre-quorum", function () {
    it("status is Unknown before any quorum is reached", async function () {
      expect(await reg.status()).to.equal(UNKNOWN);
      await post(owner, 120); // only 1 fresh < quorum
      expect(await reg.status()).to.equal(UNKNOWN); // still Unknown, not 'healthy'
    });
    it("emits StatusChanged(Healthy) when quorum first turns fully backed", async function () {
      await post(owner, 120);
      await expect(post(a2, 120)).to.emit(reg, "StatusChanged").withArgs(HEALTHY, 12000n, 2n);
      expect(await reg.status()).to.equal(HEALTHY);
    });
    it("emits StatusChanged(Unhealthy) when the median drops below 1:1", async function () {
      await post(owner, 120);
      await post(a2, 120); // healthy
      await post(owner, 90);
      await expect(post(a2, 90)).to.emit(reg, "StatusChanged").withArgs(UNHEALTHY, 9000n, 2n);
      expect(await reg.status()).to.equal(UNHEALTHY);
    });
    it("falls back to Unknown when quorum is lost to staleness", async function () {
      await post(owner, 120);
      await post(a2, 120); // Healthy
      expect(await reg.status()).to.equal(HEALTHY);
      await time.increase(MAXAGE + 1); // both stale → quorum lost
      // a fresh attestation from one attestor recomputes: 1 fresh < quorum → Unknown
      await expect(post(owner, 120)).to.emit(reg, "StatusChanged").withArgs(UNKNOWN, 0n, 1n);
      expect(await reg.status()).to.equal(UNKNOWN);
    });
    it("still emits the raw BackingAlert on an under-backed attestation", async function () {
      await expect(post(owner, 90)).to.emit(reg, "BackingAlert");
    });
  });

  describe("V3 #3 — rate-limit cannot starve freshness", function () {
    it("rejects a deploy where minInterval >= maxAge", async function () {
      await expect(
        ethers.deployContract("ReserveAttestationV3", [1, 100, 100])
      ).to.be.revertedWithCustomError(reg, "BadConfig");
      await expect(
        ethers.deployContract("ReserveAttestationV3", [1, 100, 200])
      ).to.be.revertedWithCustomError(reg, "BadConfig");
    });
    it("accepts minInterval strictly below maxAge", async function () {
      const r = await ethers.deployContract("ReserveAttestationV3", [1, 100, 99]);
      expect(await r.minInterval()).to.equal(99n);
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
      const r = await ethers.deployContract("ReserveAttestationV3", [1, MAXAGE, 60]);
      await r.attest(LTC(1000), SUPPLY, REF);
      await expect(r.attest(LTC(1000), SUPPLY, REF)).to.be.revertedWithCustomError(r, "RateLimited");
      await time.increase(61);
      await expect(r.attest(LTC(1000), SUPPLY, REF)).to.emit(r, "Attested");
    });
    it("only owner manages attestors; new attestors are listed once", async function () {
      await expect(reg.connect(stranger).setAttestor(stranger.address, true)).to.be.revertedWithCustomError(reg, "NotOwner");
      expect(await reg.attestorCount()).to.equal(3n);
      await reg.setAttestor(a2.address, false);
      await reg.setAttestor(a2.address, true);
      expect(await reg.attestorCount()).to.equal(3n);
    });
  });

  describe("2-step ownership", function () {
    it("transfers ownership only after the new owner accepts", async function () {
      await reg.transferOwnership(a2.address);
      expect(await reg.owner()).to.equal(owner.address);
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
