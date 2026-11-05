// Spotting deals that have closed. When an acquisition completes the target is delisted, and
// Yahoo stops listing it: /api/quotes reports it as `missing` and /api/history returns 404.
// Pure functions, no I/O; the hook (lib/useClosedDeals.ts) does the fetching.
import type { Deal } from "./types";

/** What /api/history said about a ticker. Only a real "no data" answer counts, never an error. */
export type HistoryCheck = "has-data" | "no-data" | "unknown";

export function historyCheckFromStatus(status: number): HistoryCheck {
  if (status === 200) return "has-data";
  if (status === 404) return "no-data"; // the route's answer when Yahoo has no price data
  return "unknown"; // 400s, 502s and the like say nothing about the ticker
}

/**
 * The deals that have closed. A deal counts only if BOTH hold:
 *  1. its ticker is in `missing` from a successful quotes response, and
 *  2. the history check for it found no price data.
 * Two separate signals, because `missing` also lists symbols that just lack a price right now.
 * An unchecked or unknown history never removes a deal, and if three or more tickers are tracked
 * and every one is missing, that looks like a Yahoo problem rather than closings, so none are removed.
 */
export function findClosed(deals: Deal[], missing: string[], history: Record<string, HistoryCheck>): Deal[] {
  const missingSet = new Set(missing.map((s) => s.toUpperCase()));
  const tracked = [...new Set(deals.map((d) => d.targetTicker.toUpperCase()))];
  if (tracked.length >= 3 && tracked.every((t) => missingSet.has(t))) return [];

  return deals.filter((d) => {
    const t = d.targetTicker.toUpperCase();
    return missingSet.has(t) && history[t] === "no-data";
  });
}
