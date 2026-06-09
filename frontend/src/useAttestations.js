import { useEffect, useRef, useState } from "react";
import { Contract, JsonRpcProvider, WebSocketProvider } from "ethers";
import { RESERVE_ATTESTATION_ABI } from "./abi.js";
import { ATTESTATION_ADDRESS, CHAIN, REFRESH_INTERVAL } from "./config.js";

const PAGE_SIZE = 200n;
const MAX_ATTESTATIONS = 2000n;

function normalize(raw, id) {
  return {
    id,
    attestor: raw.attestor,
    timestamp: raw.timestamp,
    ltcLockedSats: raw.ltcLockedSats,
    zkLtcSupplyWei: raw.zkLtcSupplyWei,
    ratioBps: raw.ratioBps,
    litecoinRef: raw.litecoinRef,
  };
}

/**
 * Read-only hook for ReserveAttestationV2: fetches the attestation history plus
 * the quorum/median/freshness health() reading. Polls every REFRESH_INTERVAL,
 * and also subscribes to Attested events over WebSocket for instant updates.
 * Never throws — returns { status, attestations, health, error, lastFetched }.
 */
export function useAttestations() {
  const [state, setState] = useState({
    status: ATTESTATION_ADDRESS ? "loading" : "unconfigured",
    attestations: [],
    health: null, // { valid, fullyBacked, medianBps, freshCount, attestorCount }
    error: null,
    lastFetched: null,
  });
  const contractRef = useRef(null);

  useEffect(() => {
    if (!ATTESTATION_ADDRESS) return undefined;

    const provider = new JsonRpcProvider(CHAIN.rpcUrl, CHAIN.id, { staticNetwork: true });
    const contract = new Contract(ATTESTATION_ADDRESS, RESERVE_ATTESTATION_ABI, provider);
    contractRef.current = contract;

    let cancelled = false;
    let timer = null;

    async function fetchAll() {
      try {
        const count = await contract.attestationCount();
        if (cancelled) return;
        if (count === 0n) {
          setState((p) => ({ ...p, status: "empty", attestations: [], health: null, error: null, lastFetched: Date.now() }));
          return;
        }
        const total = count > MAX_ATTESTATIONS ? MAX_ATTESTATIONS : count;
        const offsetStart = count - total;
        const all = [];
        for (let offset = offsetStart; offset < count; offset += PAGE_SIZE) {
          const page = await contract.getAttestations(offset, PAGE_SIZE);
          if (cancelled) return;
          page.forEach((raw, i) => all.push(normalize(raw, Number(offset) + i)));
        }
        // quorum + median + freshness reading (V2)
        let health = null;
        try {
          const [h, ac] = await Promise.all([contract.health(), contract.attestorCount()]);
          health = {
            valid: h.valid,
            fullyBacked: h.fullyBacked,
            medianBps: h.medianBps,
            freshCount: Number(h.freshCount),
            attestorCount: Number(ac),
          };
        } catch {
          /* older contract without health() — leave null */
        }
        if (cancelled) return;
        setState({ status: "ready", attestations: all, health, error: null, lastFetched: Date.now() });
      } catch (err) {
        if (cancelled) return;
        setState((p) => ({
          ...p,
          status: p.attestations.length > 0 ? "ready" : "error",
          error: err?.shortMessage || err?.message || String(err),
          lastFetched: p.lastFetched,
        }));
      } finally {
        if (!cancelled) timer = setTimeout(fetchAll, REFRESH_INTERVAL);
      }
    }

    // WebSocket: refetch instantly when a new attestation lands
    let ws = null;
    let wsContract = null;
    try {
      if (CHAIN.wsUrl) {
        ws = new WebSocketProvider(CHAIN.wsUrl, CHAIN.id);
        wsContract = new Contract(ATTESTATION_ADDRESS, RESERVE_ATTESTATION_ABI, ws);
        wsContract.on("Attested", () => { if (!cancelled) fetchAll(); });
      }
    } catch {
      /* WS unavailable — polling backstops */
    }

    fetchAll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      try { if (wsContract) wsContract.removeAllListeners(); if (ws) ws.destroy(); } catch { /* ignore */ }
      provider.destroy();
    };
  }, []);

  return state;
}
