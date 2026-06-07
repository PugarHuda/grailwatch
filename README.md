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

**Testnet note:** the Grail Bridge's Litecoin-side address is not public on testnet, so
the Litecoin observation source is configurable (`LITECOIN_BRIDGE_ADDRESS` for a real
address via litecoinspace.org, or `LTC_LOCKED_OVERRIDE` to simulate readings for the
demo). Similarly, the LiteForge Blockscout instance does not expose the native zkLTC
supply yet (verified: both the v2 stats and v1 ethsupply endpoints report 0), so
`ZKLTC_SUPPLY_OVERRIDE` covers the LitVM side for the demo. On mainnet, attestors
would watch the actual Grail BitSNARK Taproot UTXOs and derive zkLTC supply from
bridge mint/burn events — the contract and dashboard are source-agnostic by design.

## Network

| | |
|---|---|
| Chain | LitVM LiteForge testnet (Chain ID **4441**) |
| RPC | `https://liteforge.rpc.caldera.xyz/http` |
| Explorer | `https://liteforge.explorer.caldera.xyz` |
| Faucet | `https://liteforge.hub.caldera.xyz` |
| Contract | `<DEPLOYED_ADDRESS>` |

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
