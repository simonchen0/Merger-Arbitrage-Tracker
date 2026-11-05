import { describe, expect, it } from "vitest";
import type { DealMetrics } from "./calc";
import { buildRumourRow, summarize, type DealRow } from "./dealRow";
import type { Quote, Rumour } from "./types";

const noMetrics: DealMetrics = {
  daysToClose: 100,
  spreadDollars: null,
  spreadPct: null,
  annualized: null,
  downside: null,
  downsideDollars: null,
  breakEven: null,
};

function row(
  ticker: string,
  opts: { price?: number | null; spreadPct?: number | null; annualized?: number | null; breakEven?: number | null; est?: boolean } = {},
): DealRow {
  const price = opts.price === undefined ? 10 : opts.price;
  return {
    deal: {
      id: ticker.toLowerCase(),
      targetName: `${ticker} Inc`,
      targetTicker: ticker,
      acquirerName: "Buyer",
      offerPrice: 11,
      announceDate: "2026-10-01",
      expectedCloseDate: "2027-03-31",
    },
    price,
    priceNote: "",
    unaffected: null,
    breakPrice: null,
    breakIsEstimate: opts.est ?? false,
    metrics: {
      ...noMetrics,
      spreadPct: opts.spreadPct ?? null,
      annualized: opts.annualized ?? null,
      breakEven: opts.breakEven ?? null,
    },
  };
}

describe("summarize", () => {
  it("summarizes the deals: count, median annualized return, widest spread, median break-even", () => {
    const s = summarize([
      row("PTC", { spreadPct: 0.0503, annualized: 0.0556, breakEven: 0.839, est: true }),
      row("VRNS", { spreadPct: 0.0195, annualized: 0.0299, breakEven: 0.944, est: true }),
      row("ADT", { spreadPct: 0.0101, annualized: 0.0251, breakEven: 0.968, est: true }),
      row("CCC", { spreadPct: 0.0078, annualized: 0.0194, breakEven: 0.975, est: true }),
      row("PCRX", { spreadPct: 0.0027, annualized: 0.0176, breakEven: 0.991, est: true }),
    ]);
    expect(s.dealCount).toBe(5);
    expect(s.pricedCount).toBe(5);
    expect(s.medianAnnualized).toBeCloseTo(0.0251, 10);
    expect(s.widest).toEqual({ id: "ptc", ticker: "PTC", spreadPct: 0.0503 });
    expect(s.medianBreakEven).toBeCloseTo(0.968, 10);
    expect(s.breakEvenIsEstimate).toBe(true);
  });

  it("skips deals whose numbers can't be computed, but still counts them as tracked", () => {
    const s = summarize([
      row("PTC", { spreadPct: 0.05, annualized: 0.06, breakEven: 0.9 }),
      row("GONE", { price: null }),
      row("OVER", { spreadPct: -0.02, annualized: null, breakEven: null }),
    ]);
    expect(s.dealCount).toBe(3);
    expect(s.pricedCount).toBe(2);
    expect(s.medianAnnualized).toBeCloseTo(0.06, 10);
    expect(s.medianBreakEven).toBeCloseTo(0.9, 10);
    expect(s.widest?.ticker).toBe("PTC");
  });

  it("reports a negative widest spread when every deal trades above its offer", () => {
    const s = summarize([row("A", { spreadPct: -0.03 }), row("B", { spreadPct: -0.01 })]);
    expect(s.widest).toEqual({ id: "b", ticker: "B", spreadPct: -0.01 });
  });

  it("marks break-even as an estimate only when a contributing deal used the estimated break price", () => {
    expect(summarize([row("A", { breakEven: 0.9, est: false }), row("B", { breakEven: 0.8, est: false })]).breakEvenIsEstimate).toBe(false);
    expect(summarize([row("A", { breakEven: 0.9, est: false }), row("B", { breakEven: 0.8, est: true })]).breakEvenIsEstimate).toBe(true);
    // An estimated deal whose break-even is n/a doesn't contribute to the median.
    expect(summarize([row("A", { breakEven: 0.9, est: false }), row("B", { breakEven: null, est: true })]).breakEvenIsEstimate).toBe(false);
  });

  it("returns empty results with no deals", () => {
    expect(summarize([])).toEqual({
      dealCount: 0,
      pricedCount: 0,
      medianAnnualized: null,
      widest: null,
      medianBreakEven: null,
      breakEvenIsEstimate: false,
    });
  });
});

describe("buildRumourRow", () => {
  const rumour: Rumour = {
    id: "r-1",
    targetTicker: "ABC",
    targetName: "ABC Corp",
    sourceUrl: "https://www.bloomberg.com/news/articles/2026-10-30/x",
    reportDate: "2026-10-30",
    reportedPrice: 50,
  };
  const quotes: Record<string, Quote> = { ABC: { symbol: "ABC", name: "ABC Corp", price: 48, asOf: "2026-11-04T21:00:00Z" } };

  it("derives the publisher from the link and computes the indicative spread", () => {
    const r = buildRumourRow(rumour, "2026-11-04", quotes, false);
    expect(r.publisher).toBe("Bloomberg");
    expect(r.price).toBe(48);
    expect(r.metrics.spreadPct).toBeCloseTo(0.041667, 6);
    expect(r.metrics.annualized).toBeNull(); // no reported timeframe
  });

  it("says why there's no price", () => {
    expect(buildRumourRow(rumour, "2026-11-04", {}, true).priceNote).toBe("loading…");
    expect(buildRumourRow(rumour, "2026-11-04", {}, false).priceNote).toBe("unavailable");
    expect(buildRumourRow(rumour, "2026-11-04", {}, false).metrics.spreadPct).toBeNull();
  });
});
