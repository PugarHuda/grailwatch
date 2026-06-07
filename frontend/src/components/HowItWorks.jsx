import React from "react";

const STEPS = [
  {
    icon: "👁️",
    title: "Attestors observe both chains",
    body: "Registered attestors watch LTC locked in the Grail Bridge on the Litecoin mainchain and the native zkLTC supply on LitVM, at a specific Litecoin block reference.",
  },
  {
    icon: "⛓️",
    title: "Observations posted on-chain",
    body: "Each observation is committed to the ReserveAttestation contract on LiteForge, building a permanent, tamper-proof public audit trail of the backing ratio.",
  },
  {
    icon: "🔍",
    title: "Anyone can verify",
    body: "This dashboard — and any contract or dapp — reads the same data trustlessly. If backing ever drops below 1:1, a BackingAlert event fires that anything on-chain can subscribe to.",
  },
];

export default function HowItWorks() {
  return (
    <div className="steps">
      {STEPS.map((s, i) => (
        <div className="step card" key={i}>
          <div className="step-head">
            <span className="step-num mono">{i + 1}</span>
            <span className="step-icon">{s.icon}</span>
          </div>
          <h3>{s.title}</h3>
          <p>{s.body}</p>
        </div>
      ))}
    </div>
  );
}
