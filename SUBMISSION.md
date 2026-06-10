# LiteForge Hackathon Submission — GrailWatch

**Track:** Open Track

---

## ✅ Discord submission message (copy-paste to #liteforge-hackathon)

> **App name:** GrailWatch
>
> **Description:** GrailWatch is the proof-of-reserves layer for zkLTC — a quorum of independent attestors observes both Litecoin and LitVM and posts backing-ratio attestations on-chain, where health is the *median* of their fresh readings (so no single attestor can fake it) and a subscribable BackingAlert fires the moment 1 zkLTC ≠ 1 LTC, turning "trust us, it's backed" into a public, permanent, independently-verifiable audit trail.
>
> **Live app:** https://grailwatch-mauve.vercel.app
>
> **GitHub:** https://github.com/PugarHuda/grailwatch
>
> **Demo video:** `<X_VIDEO_LINK>`  ← *paste your X link here after recording*

*(The five lines above are exactly the fields the submission form requires.)*

---

## 🎥 Demo video script (≤90 seconds) — show it live on LiteForge

1. **Hook (10s):** "LitVM's whole thesis rests on one invariant: 1 zkLTC = 1 LTC. Hard money is only hard if it's *verifiable*." — open the dashboard: giant **✅ FULLY BACKED**, *median 1178% across 4 of 4 fresh attestors*.
2. **It's real, verify it yourself (20s):** Click **"verify reserve"** → litecoinspace.org shows the real ~3.15M LTC balance; the zkLTC supply is read live from the LiteForge Blockscout API. Run `node scripts/qa-grailwatch.js` — it cross-checks the on-chain numbers against those real sources and prints **exact matches** ("not faked").
3. **Why a quorum (25s):** Explain the audit fix on screen — a *single* attestor could once mint a permanent fake "FULLY BACKED". Now health is the **median** of distinct fresh attestors: post one liar's 5000% reading from an attestor → the median **doesn't move**, status stays honest. Show `attest()` landing on the explorer and the dashboard updating over **WebSocket**.
4. **The alert + audit trail (25s):** Drop an under-backed reading → contract fires **BackingAlert**, dashboard flips to 🚨 UNDER-BACKED, chart dips below the 1:1 line — "any wallet, dapp or bot can subscribe." Scroll the append-only **History**: every reading timestamped, attributed, Litecoin-referenced, forever on-chain.
5. **Close (10s):** "Proof-of-reserves became table stakes for exchanges after 2022. GrailWatch brings it to the bridge LitVM is built on. Hard money, verified — on LiteForge."

---

## 🐦 X post caption (attach the demo video to the FIRST tweet)

**Main tweet (the one you submit — must show the app live on LiteForge):**

> 🛡️ Is zkLTC really backed 1:1 by LTC? Don't trust — verify.
>
> GrailWatch is proof-of-reserves for @LitecoinVM. A quorum of independent attestors posts the backing ratio on-chain; health = the MEDIAN of fresh readings, so no single attestor can fake it. A BackingAlert fires the instant 1 zkLTC ≠ 1 LTC.
>
> Live 👇 #LiteForge #Litecoin #zkLTC
> https://grailwatch-mauve.vercel.app

**Optional thread (reply tweets for extra credit):**

> 2/ Every number is REAL and you can check it yourself: the LTC reserve is a live public Litecoin balance (litecoinspace.org), the zkLTC supply is read from the LiteForge Blockscout API. A QA script cross-checks the on-chain figures against both sources — exact match, nothing faked.

> 3/ The hardening: a single attestor could once mint a permanent fake "FULLY BACKED". Now one liar's reading can't move the median. Plus freshness gating, a 3-state status, and an attestor-set cap so attestation can never be gas-bricked. 63 tests, 2 adversarial audit rounds.

> 4/ Proof-of-reserves became table stakes for exchanges after 2022. GrailWatch brings it to the bridge LitVM itself is built on — public-good infrastructure every LitVM dapp can subscribe to.
> #LiteForge Hackathon w/ @LitecoinVM × @Dappit 🚀
> Code: https://github.com/PugarHuda/grailwatch

*Tag the official @LitecoinVM and @Dappit handles (and @Litecoin) so the judges see it.*

---

## 🧱 What's deployed (live + verified on LiteForge, Chain 4441)

| Contract | Address |
|---|---|
| ReserveAttestationV3 (hardened quorum + median + freshness) | `0xf099F039f8206C4C2BF91120A913a1F138fBAfcB` |

- **Trust model:** median across ≥`quorum` *distinct fresh* attestors; `maxAge` staleness; 3-state status; per-attestor rate-limit; 2-step ownership; attestor-set cap (anti-DoS).
- **Data is real:** LTC reserve = live balance of a public Litecoin address (litecoinspace.org); zkLTC supply = live LiteForge Blockscout `ethsupply`. Serverless Vercel **cron** keeps the feed fresh.
- **63 unit tests passing** (V1 26 + V2 15 + V3 22); `scripts/qa-grailwatch.js` proves the on-chain numbers match the real external sources.

## 🏆 Judging-criteria mapping

- **Innovation:** first proof-of-reserves / bridge-transparency infrastructure for LitVM; quorum-median design + alert events other dapps can build on.
- **Hard Money Web3 alignment:** verifies the exact "1 zkLTC = 1 LTC" hard-money invariant the *entire* ecosystem depends on — public-good infrastructure for every other LitVM project.
- **Technical quality:** BigInt-exact bps math, median-of-fresh-attestors with freshness gating, hardened across **2 adversarial audit rounds** (single-attestor-trust → quorum/median; then anti-DoS cap + honest 3-state status + freshness guard), real-data cross-check, WebSocket live updates.
- **UX:** zero-wallet public status page, instant-read backing badge, "median across N of M fresh attestors", one-click independent verification, live history chart.

## ☑️ Pre-submission checklist

- [x] Contract deployed + **verified** on LiteForge (V3)
- [x] 4 real attestors seeded; multiple attestations on-chain (incl. live cron tx)
- [x] Frontend hosted on Vercel — live link works in incognito
- [x] README has deployed address + live link + trust model
- [x] Repo public on GitHub, fully pushed
- [ ] **Demo video posted on X** showing the app live on LiteForge ← *only remaining step (human)*
- [ ] **Submit in #liteforge-hackathon before June 10, 2026** (paste the message above with your X link)
