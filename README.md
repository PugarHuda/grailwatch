# 🛡️ GrailWatch — Proof-of-Reserves for zkLTC

**On-chain transparency layer verifying that zkLTC is really backed 1:1 by LTC.**

> *Hard money is only hard if it's verifiable. GrailWatch turns "trust us, it's backed"
> into a public, permanent, on-chain audit trail.*

**Track:** Open Track · **LiteForge Hackathon 2026**

## What it does

zkLTC — the gas token of LitVM — is designed to be fully collateralized by LTC locked
on the Litecoin mainchain via the BitcoinOS Grail Bridge. GrailWatch makes that claim
**continuously verifiable**:

1. **Attestor bots** observe both chains: LTC locked on the Litecoin side, and the live
   zkLTC supply on LiteForge (read from the Blockscout API).
2. Each observation is posted to the `ReserveAttestation` contract, which computes the
   **backing ratio in basis points** and stores it forever.
3. If backing ever drops below 1:1, the contract fires a **`BackingAlert`** event that
   anyone — wallets, dapps, monitoring bots — can subscribe to.
4. A public dashboard shows the current backing status, ratio history, and full
   attestation log with Litecoin block references.

## Why it matters for Hard Money Web3

The entire LitVM thesis rests on one invariant: **1 zkLTC = 1 LTC**. Today that's a
design claim. GrailWatch gives the ecosystem the missing trust infrastructure —
the same way proof-of-reserves became table stakes for exchanges after 2022. Every
DeFi app, RWA platform and AI agent building on LitVM benefits from a public,
incorruptible answer to *"is the bridge solvent right now?"*

## Architecture

```
 Litecoin mainchain                LitVM LiteForge
 (LTC locked in bridge)            (zkLTC native supply)
        │                                 │
        └────────┐               ┌────────┘
                 ▼               ▼
              ┌─────────────────────┐   attest(sats, wei, ref)   ┌────────────────────┐
              │   Attestor bot(s)   │ ─────────────────────────▶ │ ReserveAttestation │
              └─────────────────────┘                            │    (LiteForge)     │
                                                                 └─────────┬──────────┘
                                              Attested / BackingAlert events│
                                                                            ▼
                                                            Public dashboard (live status)
```

- `contracts/ReserveAttestation.sol` — attestor registry, ratio math, alerting, paginated history
- `scripts/attestor.js` — dual-chain observer bot (Blockscout API + Litecoin API)
- `scripts/deploy.js` — deploy to LiteForge

**Data is real and independently verifiable — no mocks, no overrides:**

- **zkLTC supply** is read live from the LiteForge Blockscout `ethsupply` endpoint
  (currently ~267,612 zkLTC).
- **LTC reserve** is the real on-chain balance of a public Litecoin address read
  via [litecoinspace.org](https://litecoinspace.org/address/MQd1fJwqBJvwLuyhr17PhEFx1swiqDbPQS)
  (`MQd1fJwqBJvwLuyhr17PhEFx1swiqDbPQS`, ~3.15M LTC). Every attestation stores this
  address in its `litecoinRef`, so anyone can re-derive the number themselves.

The Grail Bridge's canonical Litecoin-side address isn't public on testnet, so this
is a **transparent reference reserve** rather than the production bridge wallet — but
the figure is genuine, live, on-chain Litecoin data. On mainnet, attestors point
`LITECOIN_BRIDGE_ADDRESS` at the actual Grail BitSNARK Taproot UTXOs; the contract,
attestor and dashboard are otherwise unchanged (source-agnostic by design).

## Network

| | |
|---|---|
| Chain | LitVM LiteForge testnet (Chain ID **4441**) |
| RPC | `https://liteforge.rpc.caldera.xyz/http` |
| Explorer | `https://liteforge.explorer.caldera.xyz` |
| Faucet | `https://liteforge.hub.caldera.xyz` |
| Contract (V2 · quorum + median) | [`0x57A318E48e5dB10EF3924d0a5Ac194C77032A1C8`](https://liteforge.explorer.caldera.xyz/address/0x57A318E48e5dB10EF3924d0a5Ac194C77032A1C8) |
| Contract (V1 · single attestor) | [`0x66DC8E77fe0E4731427fc0F1F2DE3C62270e879F`](https://liteforge.explorer.caldera.xyz/address/0x66DC8E77fe0E4731427fc0F1F2DE3C62270e879F) |

## Trust model — quorum + median + freshness (V2, live)

An adversarial audit of V1 found it was an *honesty-assumed logbook, not proof of
reserves*: a single attestor (or the owner) could post any number and mint a
permanent "FULLY BACKED" record, and `isFullyBacked()` returned the newest reading
no matter how stale. **V2 (`ReserveAttestationV2`) fixes both:**

- **Quorum + median** — health is the **median** backing ratio across *distinct*
  attestors' most recent readings, requiring at least `quorum` of them. One liar
  can't move the median (proven: `test "one liar can't move it"`).
- **Freshness** — only readings newer than `maxAge` count, so a stale "fully
  backed" can never be trusted past its deadline.
- **Status transitions** — a `StatusChanged` event fires on every
  Healthy↔Unhealthy↔Insufficient flip; **2-step ownership** transfer/renounce and
  a **per-attestor rate-limit** round out the hardening.

Live with **4 registered attestors** posting **real** data (LTC reserve from
litecoinspace, zkLTC supply from Blockscout) → median **1178%**, FULLY BACKED.
`node scripts/qa-grailwatch.js` verifies the ratio math AND cross-checks the
on-chain numbers against the real external sources (proving they're not faked).
**41 tests passing** (V1 26 + V2 15). Roadmap: attestor staking/slashing → SPV
proof of the Litecoin locked-address balance for full trustlessness.

## Quickstart

```bash
npm install
npm test                                  # 9 passing unit tests

cp .env.example .env                      # fill in keys
npm run deploy                            # deploy ReserveAttestation to LiteForge
node scripts/attestor.js                  # post one attestation
node scripts/attestor.js 60               # attest every 60s
```

## Demo

🌐 Live dashboard: **https://grailwatch-mauve.vercel.app**
📦 GitHub: **https://github.com/PugarHuda/grailwatch**
🎥 Demo video: `<X_VIDEO_LINK>`
