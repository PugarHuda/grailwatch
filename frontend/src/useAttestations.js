import { useEffect, useRef, useState } from "react";
import { Contract, JsonRpcProvider } from "ethers";
import { RESERVE_ATTESTATION_ABI } from "./abi.js";
import { ATTESTATION_ADDRESS, CHAIN, REFRESH_INTERVAL } from "./config.js";

const PAGE_SIZE = 200n;
const MAX_ATTESTATIONS = 2000n; // safety cap for a hackathon dashboard

function normalize(raw, id) {
  return {
    id,
    attestor: raw.attestor,
    timestamp: raw.timestamp, // BigInt seconds
    ltcLockedSats: raw.ltcLockedSats,
    zkLtcSupplyWei: raw.zkLtcSupplyWei,
    ratioBps: raw.ratioBps,
    litecoinRef: raw.litecoinRef,
  };
}

/**
 * Read-only polling hook: fetches the full attestation history from the
 * ReserveAttestation contract every REFRESH_INTERVAL ms. Never throws —
 * surfaces { status, attestations, error, lastFetched } instead.
 *
 * status: "unconfigured" | "loading" | "empty" | "ready" | "error"
 */
export function useAttestations() {
  const [state, setState] = useState({
    status: ATTESTATION_ADDRESS ? "loading" : "unconfigured",
    attestations: [],
    error: null,
    lastFetched: null,
  });
  const contractRef = useRef(null);

  useEffect(() => {
    if (!ATTESTATION_ADDRESS) return undefined;

    const provider = new JsonRpcProvider(CHAIN.rpcUrl, CHAIN.id, {
      staticNetwork: true,
    });
    contractRef.current = new Contract(
      ATTESTATION_ADDRESS,
      RESERVE_ATTESTATION_ABI,
      provider
    );

    let cancelled = false;
    let timer = null;

    async function fetchAll() {
      try {
        const contract = contractRef.current;
        const count = await contract.attestationCount();
        if (cancelled) return;

        if (count === 0n) {
          setState((prev) => ({
            ...prev,
            status: "empty",
            attestations: [],
            error: null,
            lastFetched: Date.now(),
          }));
          return;
        }

        const total = count > MAX_ATTESTATIONS ? MAX_ATTESTATIONS : count;
        const offsetStart = count - total; // read the newest `total` entries
        const all = [];
        for (let offset = offsetStart; offset < count; offset += PAGE_SIZE) {
          const page = await contract.getAttestations(offset, PAGE_SIZE);
          if (cancelled) return;
          page.forEach((raw, i) => {
            all.push(normalize(raw, Number(offset) + i));
          });
        }

        setState({
          status: "ready",
          attestations: all,
          error: null,
          lastFetched: Date.now(),
        });
      } catch (err) {
        if (cancelled) return;
        setState((prev) => ({
          ...prev,
          // Keep showing stale data if we already have some.
          status: prev.attestations.length > 0 ? "ready" : "error",
          error: err?.shortMessage || err?.message || String(err),
          lastFetched: prev.lastFetched,
        }));
      } finally {
        if (!cancelled) {
          timer = setTimeout(fetchAll, REFRESH_INTERVAL);
        }
      }
    }

    fetchAll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      provider.destroy();
    };
  }, []);

  return state;
}
