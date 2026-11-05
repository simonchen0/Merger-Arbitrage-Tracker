// Combines a deal with its market data into everything the UI displays.
// Used by both the dashboard table and the deal detail page.
import { computeMetrics, indicativeMetrics, median, type DealMetrics, type IndicativeMetrics } from "./calc";
import { asOfLabel } from "./format";
import { publisherFor } from "./sources";
import type { Deal, Quote, Rumour } from "./types";
import { unaffectedKey } from "./useMarketData";

export type DealRow = {
  deal: Deal;
  price: number | null;
  priceNote: string; // "as of 4:00 PM ET", "unavailable", "loading…"
  unaffected: number | null; // close before announcement (default break price)
  breakPrice: number | null;
  breakIsEstimate: boolean; // true when breakPrice is the unaffected price, not user-set
  metrics: DealMetrics;
};

export function buildRow(
  deal: Deal,
  today: string,
  quotes: Record<string, Quote>,
  unaffectedByKey: Record<string, number | null>,
  loading: boolean,
): DealRow {
  const quote = quotes[deal.targetTicker];
  const price = quote?.price ?? null;
  const priceNote = quote ? asOfLabel(quote.asOf) : loading ? "loading…" : "unavailable";
  const unaffected = unaffectedByKey[unaffectedKey(deal)] ?? null;

  const breakPrice = deal.breakPrice ?? unaffected;
  return {
    deal,
    price,
    priceNote,
    unaffected,
    breakPrice,
    breakIsEstimate: deal.breakPrice === undefined && unaffected !== null,
    metrics: computeMetrics({
      price,
      offer: deal.offerPrice,
      breakPrice,
      expectedCloseDate: deal.expectedCloseDate,
      today,
    }),
  };
}

export type RumourRow = {
  rumour: Rumour;
  publisher: string | null; // from the source link; null only for a link saved before validation
  price: number | null;
  priceNote: string;
  metrics: IndicativeMetrics; // from reported (unconfirmed) terms: always shown as indicative
};

export function buildRumourRow(rumour: Rumour, today: string, quotes: Record<string, Quote>, loading: boolean): RumourRow {
  const quote = quotes[rumour.targetTicker];
  const price = quote?.price ?? null;
  return {
    rumour,
    publisher: publisherFor(rumour.sourceUrl),
    price,
    priceNote: quote ? asOfLabel(quote.asOf) : loading ? "loading…" : "unavailable",
    metrics: indicativeMetrics({
      price,
      reportedPrice: rumour.reportedPrice,
      reportedCloseDate: rumour.reportedCloseDate,
      today,
    }),
  };
}

export type DealSummary = {
  dealCount: number; // deals tracked
  pricedCount: number; // of those, how many have a market price right now
  medianAnnualized: number | null;
  widest: { id: string; ticker: string; spreadPct: number } | null; // biggest spread %
  medianBreakEven: number | null; // the completion probability the market implies
  breakEvenIsEstimate: boolean; // true if any deal in that median used the estimated break price
};

/** Headline numbers for the dashboard. */
export function summarize(rows: DealRow[]): DealSummary {

  let widest: DealSummary["widest"] = null;
  for (const r of rows) {
    const pct = r.metrics.spreadPct;
    if (pct !== null && (widest === null || pct > widest.spreadPct)) {
      widest = { id: r.deal.id, ticker: r.deal.targetTicker, spreadPct: pct };
    }
  }

  const withBreakEven = rows.filter((r) => r.metrics.breakEven !== null);
  return {
    dealCount: rows.length,
    pricedCount: rows.filter((r) => r.price !== null).length,
    medianAnnualized: median(rows.map((r) => r.metrics.annualized)),
    widest,
    medianBreakEven: median(withBreakEven.map((r) => r.metrics.breakEven)),
    breakEvenIsEstimate: withBreakEven.some((r) => r.breakIsEstimate),
  };
}
