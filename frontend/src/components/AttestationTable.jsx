import React from "react";
import { CHAIN, FULL_BACKING_BPS } from "../config.js";
import {
  formatAmount,
  formatRatio,
  formatTime,
  ltcFromSats,
  shortAddress,
  truncateRef,
  zkLtcFromWei,
} from "../format.js";

export default function AttestationTable({ attestations }) {
  // newest first
  const rows = [...attestations].reverse();

  return (
    <div className="table-wrap">
      <table className="attestation-table">
        <thead>
          <tr>
            <th></th>
            <th>#</th>
            <th>Time</th>
            <th>Attestor</th>
            <th className="num">LTC locked</th>
            <th className="num">zkLTC supply</th>
            <th className="num">Ratio</th>
            <th>Litecoin ref</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => {
            const ok = a.ratioBps >= BigInt(FULL_BACKING_BPS);
            return (
              <tr key={a.id}>
                <td>
                  <span
                    className={`dot ${ok ? "dot-ok" : "dot-bad"}`}
                    title={ok ? "Fully backed" : "Under-backed"}
                  />
                </td>
                <td className="mono dim">{a.id}</td>
                <td className="dim">{formatTime(a.timestamp)}</td>
                <td>
                  <a
                    className="mono link"
                    href={`${CHAIN.explorerUrl}/address/${a.attestor}`}
                    target="_blank"
                    rel="noreferrer"
                    title={a.attestor}
                  >
                    {shortAddress(a.attestor)}
                  </a>
                </td>
                <td className="num mono">{formatAmount(ltcFromSats(a.ltcLockedSats))}</td>
                <td className="num mono">{formatAmount(zkLtcFromWei(a.zkLtcSupplyWei))}</td>
                <td className={`num mono ${ok ? "ok-text" : "alert-text"}`}>
                  {formatRatio(a.ratioBps)}%
                </td>
                <td className="mono dim" title={a.litecoinRef}>
                  {truncateRef(a.litecoinRef)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
