import React, { useEffect, useState } from "react";
import { ATTESTATION_ADDRESS, CHAIN, FULL_BACKING_BPS } from "./config.js";
import { useAttestations } from "./useAttestations.js";
import { formatRatio, shortAddress } from "./format.js";
import HeroStatus from "./components/HeroStatus.jsx";
import RatioChart from "./components/RatioChart.jsx";
import AttestationTable from "./components/AttestationTable.jsx";
import HowItWorks from "./components/HowItWorks.jsx";

const TABS = [
  { key: "reserves", label: "Reserves", href: "#/reserves" },
  { key: "history", label: "History", href: "#/history" },
];

function parseRoute() {
  const h = window.location.hash || "";
  if (h.startsWith("#/reserves")) return "reserves";
  if (h.startsWith("#/history")) return "history";
  return "landing";
}

function Nav({ live, route }) {
  const isLanding = route === "landing";
  return (
    <nav className="nav">
      <div className="nav-inner">
        <a className="brand" href="#/" style={{ textDecoration: "none" }}>
          <span className="brand-icon">🛡️</span>
          <div>
            <h1>GrailWatch</h1>
            <p className="tagline">Proof-of-Reserves for zkLTC</p>
          </div>
        </a>
        <div className="nav-right">
          {!isLanding && (
            <div className="tabs">
              {TABS.map((t) => (
                <a key={t.key} href={t.href} className={`tab${route === t.key ? " active" : ""}`}>
                  {t.label}
                </a>
              ))}
            </div>
          )}
          <span className={`live-pill ${live ? "live" : ""}`}>
            <span className="live-dot" /> {live ? "Live · 15s" : "Connecting…"}
          </span>
          <span className="chain-pill mono">{CHAIN.name} · {CHAIN.id}</span>
          {isLanding && <a className="btn btn-primary" href="#/reserves">View reserves →</a>}
        </div>
      </div>
    </nav>
  );
}

function AlertBanner({ latest }) {
  return (
    <div className="alert-banner" role="alert">
      <span className="alert-banner-icon">🚨</span>
      <div>
        <strong>BackingAlert:</strong> zkLTC is only{" "}
        <strong>{formatRatio(latest.ratioBps)}%</strong> backed. A{" "}
        <code>BackingAlert</code> event has fired on-chain.
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
        <span>Built on <strong>LitVM LiteForge</strong> (Chain {CHAIN.id}) · LiteForge Hackathon 2026</span>
      </div>
      <div className="footer-links">
        <a href={CHAIN.explorerUrl} target="_blank" rel="noreferrer">Explorer ↗</a>
        {ATTESTATION_ADDRESS && (
          <a className="mono" href={`${CHAIN.explorerUrl}/address/${ATTESTATION_ADDRESS}`} target="_blank" rel="noreferrer" title={ATTESTATION_ADDRESS}>
            Contract {shortAddress(ATTESTATION_ADDRESS)} ↗
          </a>
        )}
        <a href="https://litecoinspace.org/address/MQd1fJwqBJvwLuyhr17PhEFx1swiqDbPQS" target="_blank" rel="noreferrer">Verify LTC reserve ↗</a>
      </div>
    </footer>
  );
}

function Landing({ latest }) {
  const fullyBacked = latest && latest.ratioBps >= BigInt(FULL_BACKING_BPS);
  return (
    <main className="main landing">
      <section className="lp-hero">
        <div>
          <span className="lp-eyebrow">🛡️ Live on {CHAIN.name} · Chain {CHAIN.id}</span>
          <h1>Hard money is only hard if it's <span className="hi">verifiable</span>.</h1>
          <p>
            GrailWatch is the proof-of-reserves layer for zkLTC. Attestors observe
            both chains and post the backing ratio on-chain — turning “trust us,
            it's backed” into a public, permanent, independently-verifiable audit
            trail. Every number here is real and you can check it yourself.
          </p>
          <div className="lp-cta">
            <a className="btn btn-primary" href="#/reserves">View live reserves →</a>
            <a className="btn btn-blue" href="#/history">History</a>
            <a className="btn" href="https://litecoinspace.org/address/MQd1fJwqBJvwLuyhr17PhEFx1swiqDbPQS" target="_blank" rel="noreferrer">Verify reserve ↗</a>
          </div>
        </div>
        <div className="lp-badge-card">
          <div style={{ fontSize: 44 }}>{fullyBacked ? "✅" : latest ? "🚨" : "🛡️"}</div>
          <div className="big">{latest ? `${formatRatio(latest.ratioBps)}%` : "—"}</div>
          <div className="lbl">{fullyBacked ? "Fully backed" : latest ? "Under-backed" : "live backing ratio"}</div>
        </div>
      </section>

      <section className="section">
        <div className="section-head"><h2>How it works</h2></div>
        <HowItWorks />
      </section>

      <section className="cta-band">
        <h2>See the reserves, live.</h2>
        <p>Real LTC on Litecoin vs real zkLTC supply on LitVM — verified on-chain.</p>
        <a className="btn btn-primary" href="#/reserves">View live reserves →</a>
      </section>
    </main>
  );
}

export default function App() {
  const { status, attestations, error } = useAttestations();
  const [route, setRoute] = useState(parseRoute());
  useEffect(() => {
    const onHash = () => { setRoute(parseRoute()); window.scrollTo(0, 0); };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const latest = attestations.length > 0 ? attestations[attestations.length - 1] : null;
  const underBacked = latest !== null && latest.ratioBps < BigInt(FULL_BACKING_BPS);
  const live = status === "ready";

  const states = (
    <>
      {status === "unconfigured" && (
        <EmptyState title="Awaiting deployment" body={<>Set <code>VITE_ATTESTATION_ADDRESS</code> in <code>frontend/.env</code>.</>} />
      )}
      {status === "loading" && <EmptyState spinner title="Reading reserves…" body={`Querying ReserveAttestation on ${CHAIN.name}.`} />}
      {status === "empty" && <EmptyState title="Awaiting first attestation" body="Deployed, but no attestor has posted yet. Refreshes every 15s." />}
      {status === "error" && <EmptyState title="Unable to reach LiteForge" body={`RPC failed (${error}). Retrying every 15s.`} />}
    </>
  );

  return (
    <div className="page">
      <Nav live={live} route={route} />

      {route === "landing" && <Landing latest={latest} />}

      {route === "reserves" && (
        <main className="main">
          <h1 className="page-title">🛡️ Live Reserves</h1>
          {underBacked && <AlertBanner latest={latest} />}
          {latest ? <HeroStatus latest={latest} /> : states}
        </main>
      )}

      {route === "history" && (
        <main className="main">
          <h1 className="page-title">📈 Attestation History</h1>
          {latest ? (
            <>
              <section className="section">
                <div className="section-head">
                  <h2>Backing-ratio history</h2>
                  <span className="section-sub">{attestations.length} attestation{attestations.length === 1 ? "" : "s"} on record</span>
                </div>
                <div className="card chart-card"><RatioChart attestations={attestations} /></div>
              </section>
              <section className="section">
                <div className="section-head">
                  <h2>Attestation log</h2>
                  <span className="section-sub">newest first · every row independently verifiable</span>
                </div>
                <div className="card table-card"><AttestationTable attestations={attestations} /></div>
              </section>
            </>
          ) : states}
        </main>
      )}

      <Footer />
    </div>
  );
}
