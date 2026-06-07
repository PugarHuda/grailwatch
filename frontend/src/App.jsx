import React from "react";
import { ATTESTATION_ADDRESS, CHAIN, FULL_BACKING_BPS } from "./config.js";
import { useAttestations } from "./useAttestations.js";
import { formatRatio, shortAddress } from "./format.js";
import HeroStatus from "./components/HeroStatus.jsx";
import RatioChart from "./components/RatioChart.jsx";
import AttestationTable from "./components/AttestationTable.jsx";
import HowItWorks from "./components/HowItWorks.jsx";

function Header({ live }) {
  return (
    <header className="header">
      <div className="header-inner">
        <div className="brand">
          <span className="brand-icon">🛡️</span>
          <div>
            <h1>GrailWatch</h1>
            <p className="tagline">
              Proof-of-Reserves for zkLTC — hard money, verified.
            </p>
          </div>
        </div>
        <div className="header-right">
          <span className={`live-pill ${live ? "live" : ""}`}>
            <span className="live-dot" />
            {live ? "Live · refreshes every 15s" : "Connecting…"}
          </span>
          <span className="chain-pill mono">
            {CHAIN.name} · Chain {CHAIN.id}
          </span>
        </div>
      </div>
    </header>
  );
}

function AlertBanner({ latest }) {
  return (
    <div className="alert-banner" role="alert">
      <span className="alert-banner-icon">🚨</span>
      <div>
        <strong>BackingAlert:</strong> the latest attestation reports zkLTC is
        only <strong>{formatRatio(latest.ratioBps)}%</strong> backed by LTC
        reserves. A <code>BackingAlert</code> event has been emitted on-chain.
      </div>
    </div>
  );
}

function EmptyState({ title, body, spinner }) {
  return (
    <section className="card empty-state">
      {spinner ? <div className="spinner" /> : <div className="empty-icon">⏳</div>}
      <h2>{title}</h2>
      <p>{body}</p>
    </section>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div>
        Built on <strong>LitVM LiteForge</strong> (Chain {CHAIN.id}) —
        LiteForge Hackathon 2026
      </div>
      <div className="footer-links">
        <a href={CHAIN.explorerUrl} target="_blank" rel="noreferrer">
          LiteForge Explorer ↗
        </a>
        {ATTESTATION_ADDRESS && (
          <a
            href={`${CHAIN.explorerUrl}/address/${ATTESTATION_ADDRESS}`}
            target="_blank"
            rel="noreferrer"
            className="mono"
            title={ATTESTATION_ADDRESS}
          >
            ReserveAttestation {shortAddress(ATTESTATION_ADDRESS)} ↗
          </a>
        )}
      </div>
    </footer>
  );
}

export default function App() {
  const { status, attestations, error } = useAttestations();
  const latest =
    attestations.length > 0 ? attestations[attestations.length - 1] : null;
  const underBacked =
    latest !== null && latest.ratioBps < BigInt(FULL_BACKING_BPS);

  return (
    <div className="page">
      <Header live={status === "ready"} />

      <main className="main">
        {underBacked && <AlertBanner latest={latest} />}

        {status === "unconfigured" && (
          <EmptyState
            title="Awaiting deployment"
            body={
              <>
                No contract address configured. Deploy ReserveAttestation to
                LiteForge and set{" "}
                <code>VITE_ATTESTATION_ADDRESS</code> in <code>frontend/.env</code>,
                then restart the dev server.
              </>
            }
          />
        )}

        {status === "loading" && (
          <EmptyState
            spinner
            title="Reading reserves…"
            body={`Querying the ReserveAttestation contract on ${CHAIN.name}.`}
          />
        )}

        {status === "empty" && (
          <EmptyState
            title="Awaiting first attestation"
            body="The ReserveAttestation contract is deployed but no attestor has posted an observation yet. This page refreshes automatically every 15 seconds."
          />
        )}

        {status === "error" && (
          <EmptyState
            title="Unable to reach LiteForge"
            body={`The RPC call failed (${error}). Retrying automatically every 15 seconds.`}
          />
        )}

        {latest && (
          <>
            <HeroStatus latest={latest} />

            <section className="section">
              <div className="section-head">
                <h2>Backing-ratio history</h2>
                <span className="section-sub">
                  {attestations.length} attestation
                  {attestations.length === 1 ? "" : "s"} on record
                </span>
              </div>
              <div className="card chart-card">
                <RatioChart attestations={attestations} />
              </div>
            </section>

            <section className="section">
              <div className="section-head">
                <h2>Attestation log</h2>
                <span className="section-sub">newest first</span>
              </div>
              <div className="card table-card">
                <AttestationTable attestations={attestations} />
              </div>
            </section>
          </>
        )}

        <section className="section">
          <div className="section-head">
            <h2>How it works</h2>
          </div>
          <HowItWorks />
        </section>
      </main>

      <Footer />
    </div>
  );
}
