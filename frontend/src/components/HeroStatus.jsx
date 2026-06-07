import React from "react";
import { FULL_BACKING_BPS } from "../config.js";
import {
  formatAmount,
  formatRatio,
  formatTime,
  ltcFromSats,
  shortAddress,
  timeAgo,
  zkLtcFromWei,
} from "../format.js";

export default function HeroStatus({ latest }) {
  const fullyBacked = latest.ratioBps >= BigInt(FULL_BACKING_BPS);
  const ltc = ltcFromSats(latest.ltcLockedSats);
  const supply = zkLtcFromWei(latest.zkLtcSupplyWei);

  return (
    <section className="hero card" aria-live="polite">
      <div className={`hero-badge ${fullyBacked ? "ok" : "alert"}`}>
        <span className="hero-badge-icon">{fullyBacked ? "✅" : "🚨"}</span>
        {fullyBacked ? "FULLY BACKED" : "UNDER-BACKED"}
      </div>

      <div className={`hero-ratio mono ${fullyBacked ? "ok-text" : "alert-text"}`}>
        {formatRatio(latest.ratioBps)}%
      </div>
      <div className="hero-ratio-label">
        backing ratio · 100.00% = exactly 1 LTC per zkLTC
      </div>

      <div className="hero-compare">
        <div className="hero-figure">
          <div className="hero-figure-value mono">{formatAmount(ltc)}</div>
          <div className="hero-figure-unit">LTC</div>
          <div className="hero-figure-label">locked on Litecoin</div>
        </div>
        <div
          className={`hero-equals mono ${fullyBacked ? "ok-text" : "alert-text"}`}
          title={fullyBacked ? "Reserves cover supply" : "Reserves do NOT cover supply"}
        >
          {fullyBacked ? "≥" : "≠"}
        </div>
        <div className="hero-figure">
          <div className="hero-figure-value mono">{formatAmount(supply)}</div>
          <div className="hero-figure-unit">zkLTC</div>
          <div className="hero-figure-label">supply on LitVM</div>
        </div>
      </div>

      <div className="hero-meta">
        <span>
          Last attested <strong>{timeAgo(latest.timestamp)}</strong> (
          {formatTime(latest.timestamp)})
        </span>
        <span className="hero-meta-sep">·</span>
        <span>
          by <span className="mono">{shortAddress(latest.attestor)}</span>
        </span>
        <span className="hero-meta-sep">·</span>
        <span>
          attestation <span className="mono">#{latest.id}</span>
        </span>
      </div>
    </section>
  );
}
