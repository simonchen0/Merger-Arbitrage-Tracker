// Runs the rumour headline scan (/api/rumours/scan) and adds what it finds to the saved rumours.
// It runs when the dashboard loads if the last scan is over an hour old, and on demand via scan().
// Added rows are marked autoFound with their headline and never carry terms (lib/rumourScan.ts).
import { useCallback, useEffect, useState } from "react";
import { getRumourList, readScanState, saveRumours, writeScanState } from "./rumours";
import { newRumoursFromScan, type ScanCandidate } from "./rumourScan";

const RESCAN_AFTER_MS = 60 * 60 * 1000;

// One scan at a time, across component re-mounts (React strict mode runs effects twice in dev).
let inFlight = false;

export function useRumourScan(ready: boolean, announcedTickers: string[]) {
  const [scanning, setScanning] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const announcedKey = announcedTickers.join(",");

  const scan = useCallback(async () => {
    if (inFlight) return;
    inFlight = true;
    setScanning(true);
    try {
      const res = await fetch("/api/rumours/scan");
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "News search unavailable");

      const added = newRumoursFromScan(body.candidates as ScanCandidate[], {
        tracked: getRumourList().map((r) => r.targetTicker),
        announced: announcedKey ? announcedKey.split(",") : [],
        dismissed: readScanState().dismissed,
      });
      saveRumours(added);
      // Read the state again: a delete during the fetch may have added to the dismissed list.
      writeScanState({ ...readScanState(), lastScan: Date.now() });
      setStatus(added.length > 0 ? `Scanned · ${added.length} new` : "Scanned · nothing new");
    } catch {
      // A failed scan isn't recorded, so the next visit tries again.
      setStatus("Scan failed");
    } finally {
      inFlight = false;
      setScanning(false);
    }
  }, [announcedKey]);

  useEffect(() => {
    if (!ready || Date.now() - readScanState().lastScan <= RESCAN_AFTER_MS) return;
    // Started from a timer so the effect itself doesn't set state; cancelled if deps change first.
    const timer = setTimeout(() => void scan(), 0);
    return () => clearTimeout(timer);
  }, [ready, scan]);

  return { scanning, status, scan };
}
