// Removes deals whose target has been delisted (the deal has most likely closed).
// Runs after each successful price refresh that reports missing tickers; the rule itself, with
// its safeguards, is findClosed() in lib/closedDeals.ts.
import { useCallback, useEffect, useRef, useState } from "react";
import { findClosed, historyCheckFromStatus, type HistoryCheck } from "./closedDeals";
import { deleteDeal } from "./deals";
import type { Deal } from "./types";

/**
 * `missing` is the tickers Yahoo no longer lists, from a successful quotes response only.
 * `refreshedAt` identifies that response, so each one is checked once.
 */
export function useClosedDeals(deals: Deal[] | null, missing: string[], refreshedAt: Date | null) {
  const [removed, setRemoved] = useState<Deal[]>([]);
  const checked = useRef(new Set<string>());
  const missingKey = missing.join(",");

  useEffect(() => {
    if (!deals || missing.length === 0 || !refreshedAt) return;
    const seen = checked.current;
    const batch = `${refreshedAt.getTime()}|${missingKey}`;
    if (seen.has(batch)) return;
    seen.add(batch);

    // Earliest announcement date per missing ticker: the history is asked for from then on.
    const missingSet = new Set(missing.map((s) => s.toUpperCase()));
    const from = new Map<string, string>();
    for (const d of deals) {
      const t = d.targetTicker.toUpperCase();
      if (missingSet.has(t) && (!from.has(t) || d.announceDate < from.get(t)!)) from.set(t, d.announceDate);
    }

    let cancelled = false;
    (async () => {
      const history: Record<string, HistoryCheck> = {};
      await Promise.all(
        [...from].map(async ([ticker, date]) => {
          try {
            const res = await fetch(`/api/history?symbol=${encodeURIComponent(ticker)}&from=${date}`);
            history[ticker] = historyCheckFromStatus(res.status);
          } catch {
            history[ticker] = "unknown";
          }
        }),
      );
      if (cancelled) return;
      const closed = findClosed(deals, missing, history);
      if (closed.length === 0) return;
      for (const d of closed) deleteDeal(d.id);
      setRemoved((prev) => [...prev, ...closed]);
    })();
    return () => {
      cancelled = true;
      seen.delete(batch); // not finished: allow a retry if the effect re-runs
    };
    // `deals` is deliberately not a dependency: removing a deal changes it, and this batch is done.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missingKey, refreshedAt]);

  const dismiss = useCallback(() => setRemoved([]), []);
  return { removed, dismiss };
}
