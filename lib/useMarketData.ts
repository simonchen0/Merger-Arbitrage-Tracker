// Fetches live prices for the tracked deals:
//  - latest quotes for all real tickers, re-fetched on refresh()
//  - the unaffected price (close before announcement), the default break price
import { useEffect, useMemo, useRef, useState } from "react";
import { unaffectedPrice, type PricePoint } from "./calc";
import type { Deal, Quote } from "./types";

// `at` is the time of the last successful fetch.
// `missing` = tickers Yahoo no longer lists, from a successful response only (empty after an error).
type QuoteResult = {
  key: string;
  quotes: Record<string, Quote>;
  missing: string[];
  error: string | null;
  at: Date | null;
};

function shiftDate(date: string, days: number): string {
  const t = Date.parse(`${date}T00:00:00Z`) + days * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

/** Daily closes for a ticker since `from` (YYYY-MM-DD), or null if unavailable. */
export async function fetchHistory(ticker: string, from: string): Promise<PricePoint[] | null> {
  try {
    const res = await fetch(`/api/history?symbol=${encodeURIComponent(ticker)}&from=${from}`);
    if (!res.ok) return null;
    const body: { history: PricePoint[] } = await res.json();
    return body.history;
  } catch {
    return null;
  }
}

/**
 * Unaffected price for a ticker: the close before the announcement date (or on/before
 * `unaffectedDate` when news leaked earlier), or null.
 */
export async function fetchUnaffectedPrice(
  ticker: string,
  announceDate: string,
  unaffectedDate?: string,
): Promise<number | null> {
  // Two weeks before the relevant date covers weekends and holidays.
  const start = unaffectedDate && unaffectedDate < announceDate ? unaffectedDate : announceDate;
  const history = await fetchHistory(ticker, shiftDate(start, -14));
  return history ? unaffectedPrice(history, announceDate, unaffectedDate) : null;
}

// "TICKER|announceDate|unaffectedDate" (unaffectedDate is empty when not set)
export function unaffectedKey(deal: Deal): string {
  return `${deal.targetTicker}|${deal.announceDate}|${deal.unaffectedDate ?? ""}`;
}

export function parseUnaffectedKey(key: string): { ticker: string; announceDate: string; unaffectedDate?: string } {
  const [ticker, announceDate, unaffectedDate] = key.split("|");
  return { ticker, announceDate, unaffectedDate: unaffectedDate || undefined };
}

/**
 * `extraTickers` (e.g. rumoured deals' targets) join the same quote request, so one Refresh and
 * one "Updated" time cover everything. They get quotes only, no unaffected price.
 */
export function useMarketData(deals: Deal[] | null, extraTickers: string[] = []) {
  const [refreshCount, setRefreshCount] = useState(0);
  const [quoteResult, setQuoteResult] = useState<QuoteResult | null>(null);
  const [unaffected, setUnaffected] = useState<Record<string, number | null>>({});
  const requested = useRef(new Set<string>());

  const list = useMemo(() => deals ?? [], [deals]);
  const symbols = [...new Set([...list.map((d) => d.targetTicker), ...extraTickers])].sort().join(",");
  const requestKey = `${symbols}#${refreshCount}`;

  // Latest quotes
  useEffect(() => {
    if (!symbols) return;
    let cancelled = false;
    fetch(`/api/quotes?symbols=${encodeURIComponent(symbols)}`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "Price data unavailable");
        return { list: body.quotes as Quote[], missing: (body.missing ?? []) as string[] };
      })
      .then(({ list, missing }) => {
        if (cancelled) return;
        const quotes = Object.fromEntries(list.map((q) => [q.symbol, q]));
        setQuoteResult({ key: requestKey, quotes, missing, error: null, at: new Date() });
      })
      .catch((err: Error) => {
        if (cancelled) return;
        // Keep the last prices (and their timestamp) we had, and say the refresh failed.
        setQuoteResult((prev) => ({
          key: requestKey,
          quotes: prev?.quotes ?? {},
          missing: [],
          error: err.message,
          at: prev?.at ?? null,
        }));
      });
    return () => {
      cancelled = true;
    };
  }, [symbols, requestKey]);

  // Unaffected prices: fetched once per ticker + announcement/unaffected date. Fetched even when
  // a deal has a manual break price, so the detail page can show it for reference.
  const needUnaffected = list.map(unaffectedKey);
  const needKey = [...new Set(needUnaffected)].sort().join(",");

  useEffect(() => {
    for (const key of needKey ? needKey.split(",") : []) {
      if (requested.current.has(key)) continue;
      requested.current.add(key);
      const { ticker, announceDate, unaffectedDate } = parseUnaffectedKey(key);
      fetchUnaffectedPrice(ticker, announceDate, unaffectedDate).then((price) => {
        // A failed lookup isn't remembered: the next Refresh tries again.
        if (price === null) requested.current.delete(key);
        setUnaffected((prev) => ({ ...prev, [key]: price }));
      });
    }
  }, [needKey, refreshCount]);

  const current = quoteResult?.key === requestKey ? quoteResult : null;
  return {
    quotes: quoteResult?.quotes ?? {},
    missing: current && !current.error ? current.missing : [],
    unaffected,
    loading: symbols !== "" && current === null,
    error: current?.error ?? null,
    lastUpdated: quoteResult?.at ?? null,
    hasDeals: symbols !== "",
    refresh: () => setRefreshCount((n) => n + 1),
  };
}
