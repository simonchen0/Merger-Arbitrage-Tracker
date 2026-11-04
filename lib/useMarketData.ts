// Fetches live prices for real deals (demo deals never call the API):
//  - latest quotes for all real tickers, re-fetched on refresh()
//  - the unaffected price (close before announcement) for deals without a break price
import { useEffect, useMemo, useRef, useState } from "react";
import { unaffectedPrice, type PricePoint } from "./calc";
import type { Deal, Quote } from "./types";

// `at` is the time of the last successful fetch.
type QuoteResult = { key: string; quotes: Record<string, Quote>; error: string | null; at: Date | null };

function shiftDate(date: string, days: number): string {
  const t = Date.parse(`${date}T00:00:00Z`) + days * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

export function unaffectedKey(deal: Deal): string {
  return `${deal.targetTicker}|${deal.announceDate}`;
}

export function useMarketData(deals: Deal[] | null) {
  const [refreshCount, setRefreshCount] = useState(0);
  const [quoteResult, setQuoteResult] = useState<QuoteResult | null>(null);
  const [unaffected, setUnaffected] = useState<Record<string, number | null>>({});
  const requested = useRef(new Set<string>());

  const realDeals = useMemo(() => (deals ?? []).filter((d) => !d.isDemo), [deals]);
  const symbols = [...new Set(realDeals.map((d) => d.targetTicker))].sort().join(",");
  const requestKey = `${symbols}#${refreshCount}`;

  // Latest quotes
  useEffect(() => {
    if (!symbols) return;
    let cancelled = false;
    fetch(`/api/quotes?symbols=${encodeURIComponent(symbols)}`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "Price data unavailable");
        return body.quotes as Quote[];
      })
      .then((list) => {
        if (cancelled) return;
        const quotes = Object.fromEntries(list.map((q) => [q.symbol, q]));
        setQuoteResult({ key: requestKey, quotes, error: null, at: new Date() });
      })
      .catch((err: Error) => {
        if (cancelled) return;
        // Keep the last prices (and their timestamp) we had, and say the refresh failed.
        setQuoteResult((prev) => ({
          key: requestKey,
          quotes: prev?.quotes ?? {},
          error: err.message,
          at: prev?.at ?? null,
        }));
      });
    return () => {
      cancelled = true;
    };
  }, [symbols, requestKey]);

  // Unaffected prices: fetched once per ticker + announcement date
  const needUnaffected = realDeals.filter((d) => d.breakPrice === undefined).map(unaffectedKey);
  const needKey = [...new Set(needUnaffected)].sort().join(",");

  useEffect(() => {
    for (const key of needKey ? needKey.split(",") : []) {
      if (requested.current.has(key)) continue;
      requested.current.add(key);
      const [ticker, announceDate] = key.split("|");
      // Two weeks before the announcement covers weekends and holidays.
      const from = shiftDate(announceDate, -14);
      fetch(`/api/history?symbol=${encodeURIComponent(ticker)}&from=${from}`)
        .then((res) => (res.ok ? res.json() : { history: [] }))
        .then((body: { history: PricePoint[] }) => unaffectedPrice(body.history, announceDate))
        .catch(() => null)
        .then((price) => setUnaffected((prev) => ({ ...prev, [key]: price })));
    }
  }, [needKey]);

  const current = quoteResult?.key === requestKey ? quoteResult : null;
  return {
    quotes: quoteResult?.quotes ?? {},
    unaffected,
    loading: symbols !== "" && current === null,
    error: current?.error ?? null,
    lastUpdated: quoteResult?.at ?? null,
    hasRealDeals: symbols !== "",
    refresh: () => setRefreshCount((n) => n + 1),
  };
}
