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

export default function HeroStatus({ latest, health }) {
  const ltc = ltcFromSats(latest.ltcLockedSats);
  const supply = zkLtcFromWei(latest.zkLtcSupplyWei);

  // V2: trust the quorum median, not a single attestor's last write
  const valid = health?.valid ?? true;
  const fullyBacked = health
    ? health.valid && health.fullyBacked
    : latest.ratioBps >= BigInt(FULL_BACKING_BPS);
  const ratioBps = health?.valid ? health.medianBps : latest.ratioBps;
  const fresh = health?.freshCount;
  const total = health?.attestorCount;

  const cls = !valid ? "alert" : fullyBacked ? "ok" : "alert";
  const txtCls = !valid ? "alert-text" : fullyBacked ? "ok-text" : "alert-text";
  const badge = !valid ? "⏳ INSUFFICIENT ATTESTORS" : fullyBacked ? "✅ FULLY BACKED" : "🚨 UNDER-BACKED";

  const ref = latest.litecoinRef || "";
  const ltcAddr = ref.includes(":") ? ref.split(":").pop() : ref;
  const ltcVerifyUrl =
    ltcAddr.startsWith("L") || ltcAddr.startsWith("M") || ltcAddr.startsWith("ltc1")
      ? `https://litecoinspace.org/address/${ltcAddr}`
      : null;

  return (
    <section className="hero card" aria-live="polite">
      <div className={`hero-badge ${cls}`}>{badge}</div>

      <div className={`hero-ratio mono ${txtCls}`}>{formatRatio(ratioBps)}%</div>
      <div className="hero-ratio-label">
        {health?.valid != null ? (
          <>
            <strong>median</strong> backing ratio across{" "}
            <strong>{fresh} of {total}</strong> fresh attestors · 100% = 1 LTC per zkLTC
          </>
        ) : (
          <>backing ratio · 100.00% = exactly 1 LTC per zkLTC</>
        )}
      </div>

      <div className="hero-compare">
        <div className="hero-figure">
          <div className="hero-figure-value mono">{formatAmount(ltc)}</div>
          <div className="hero-figure-unit">LTC</div>
          <div className="hero-figure-label">
            {ltcVerifyUrl ? (
              <a href={ltcVerifyUrl} target="_blank" rel="noreferrer" title={ltcAddr}>
                real reserve · verify {shortAddress(ltcAddr)} ↗
              </a>
            ) : (
              "locked on Litecoin"
            )}
          </div>
        </div>
        <div className={`hero-equals mono ${txtCls}`} title={fullyBacked ? "Reserves cover supply" : "Reserves do NOT cover supply"}>
          {fullyBacked ? "≥" : valid ? "≠" : "?"}
        </div>
        <div className="hero-figure">
          <div className="hero-figure-value mono">{formatAmount(supply)}</div>
          <div className="hero-figure-unit">zkLTC</div>
          <div className="hero-figure-label">supply on LitVM</div>
        </div>
      </div>

      <div className="hero-meta">
        <span>Last attested <strong>{timeAgo(latest.timestamp)}</strong> ({formatTime(latest.timestamp)})</span>
        <span className="hero-meta-sep">·</span>
        <span>by <span className="mono">{shortAddress(latest.attestor)}</span></span>
        {health?.valid != null && (
          <>
            <span className="hero-meta-sep">·</span>
            <span><strong>{total}</strong> registered attestors</span>
          </>
        )}
      </div>
    </section>
  );
}
