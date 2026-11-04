// Combines a deal with its market data into everything the UI displays.
// Used by both the dashboard table and the deal detail page.
import { computeMetrics, unaffectedPrice, type DealMetrics } from "./calc";
import { demoHistory } from "./demo";
import { asOfLabel } from "./format";
import type { Deal, Quote } from "./types";
import { unaffectedKey } from "./useMarketData";

export type DealRow = {
  deal: Deal;
  price: number | null;
  priceNote: string; // "simulated", "as of 4:00 PM ET", "unavailable", "loading…"
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
  let price: number | null;
  let priceNote: string;
  let unaffected: number | null;

  if (deal.isDemo) {
    const history = demoHistory(deal, today);
    price = history.at(-1)?.close ?? null;
    priceNote = "simulated";
    unaffected = unaffectedPrice(history, deal.announceDate);
  } else {
    const quote = quotes[deal.targetTicker];
    price = quote?.price ?? null;
    priceNote = quote ? asOfLabel(quote.asOf) : loading ? "loading…" : "unavailable";
    unaffected = unaffectedByKey[unaffectedKey(deal)] ?? null;
  }

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
