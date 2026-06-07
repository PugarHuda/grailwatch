# LiteForge Hackathon Submission — GrailWatch

**Track:** Open Track

## Discord submission message (copy-paste to #liteforge-hackathon)

---

**App name:** GrailWatch

**Description:** GrailWatch is the proof-of-reserves layer for zkLTC — attestor bots observe both Litecoin and LitVM, post backing-ratio attestations on-chain, and fire a subscribable BackingAlert the moment 1 zkLTC ≠ 1 LTC, turning "trust us, it's backed" into a public, permanent audit trail.

**Live app:** `<LIVE_APP_LINK>`

**GitHub:** `<GITHUB_REPO_LINK>`

**Demo video:** `<X_VIDEO_LINK>`

---

## Demo video script (≤90 seconds)

1. **Hook (10s):** "LitVM's whole thesis rests on one invariant: 1 zkLTC = 1 LTC. Hard money is only hard if it's verifiable." — show the dashboard's giant ✅ FULLY BACKED badge.
2. **How it works (20s):** Show attestor terminal: `node scripts/attestor.js` reads the live zkLTC supply from the LiteForge Blockscout API + the Litecoin-side observation → posts `attest()` → tx confirms on explorer → dashboard refreshes with the new data point.
3. **The alert (30s):** Post an under-backed observation (demo override) → contract fires **BackingAlert** → dashboard flips to 🚨 UNDER-BACKED with red pulsing banner, chart point drops below the 1:1 reference line. "Any wallet, dapp, or bot on LitVM can subscribe to this event."
4. **The audit trail (20s):** Scroll the attestation log — every reading timestamped, attributed, referenced to a Litecoin block, forever on-chain. Show the history chart.
5. **Close (10s):** "Proof-of-reserves became table stakes for exchanges after 2022. GrailWatch brings it to the bridge LitVM is built on. Hard money, verified."

## Judging criteria mapping

- **Innovation:** first proof-of-reserves / bridge-transparency infrastructure in the LitVM ecosystem; alert events other dapps can build on.
- **Hard Money Web3 alignment:** directly verifies the core "1 zkLTC = 1 LTC" hard-money invariant the entire ecosystem depends on — public-good infrastructure for every other LitVM project.
- **Technical quality:** 9/9 unit tests, BigInt-exact bps ratio math, attestor registry, paginated on-chain history, dual-chain observer bot.
- **UX:** zero-wallet public status page, 15s auto-refresh, instant-read status badge, hand-rolled SVG history chart.

## Pre-submission checklist

- [ ] Contract deployed to LiteForge, address in README + frontend/.env (`VITE_ATTESTATION_ADDRESS`)
- [ ] ≥5 attestations posted on-chain (incl. one under-backed for the alert demo, then restored)
- [ ] Frontend hosted (Vercel/Netlify) — live link works in incognito
- [ ] README updated with deployed address + live link + video link
- [ ] Repo pushed to GitHub (public)
- [ ] Demo video posted on X, shows the app live on LiteForge
- [ ] Submitted in #liteforge-hackathon before **June 10, 2026**
