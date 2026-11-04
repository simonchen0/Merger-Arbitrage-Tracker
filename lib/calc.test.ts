import { describe, expect, it } from "vitest";
import {
  annualizedReturn,
  breakEvenProbability,
  computeMetrics,
  daysBetween,
  downside,
  spread,
  spreadHistory,
  todayInNewYork,
  unaffectedPrice,
} from "./calc";

// Reference case (hand-checked): P=48, O=50, B=40, d=120
//   spread     = 50 - 48            = $2.00
//   spread %   = 2 / 48             = 4.1667%
//   annualized = 0.041667 * 365/120 = 12.6736%
//   downside   = (40 - 48) / 48     = -16.6667%
//   break-even = (48 - 40)/(50 - 40) = 80%
const P = 48;
const O = 50;
const B = 40;

describe("spread", () => {
  it("computes dollar and percent spread", () => {
    const s = spread(P, O)!;
    expect(s.dollars).toBeCloseTo(2, 10);
    expect(s.pct).toBeCloseTo(0.041667, 6);
  });

  it("is negative when the target trades above the offer", () => {
    const s = spread(52, 50)!;
    expect(s.dollars).toBeCloseTo(-2, 10);
    expect(s.pct).toBeCloseTo(-0.038462, 6);
  });

  it("returns null for a missing or non-positive price", () => {
    expect(spread(0, O)).toBeNull();
    expect(spread(-1, O)).toBeNull();
    expect(spread(NaN, O)).toBeNull();
    expect(spread(P, NaN)).toBeNull();
  });
});

describe("annualizedReturn", () => {
  it("annualizes the spread with simple calendar-day convention", () => {
    expect(annualizedReturn(P, O, 120)).toBeCloseTo(0.126736, 6);
  });

  it("returns null when the expected close date has passed or is today", () => {
    expect(annualizedReturn(P, O, 0)).toBeNull();
    expect(annualizedReturn(P, O, -5)).toBeNull();
  });

  it("is negative when the spread is negative", () => {
    expect(annualizedReturn(52, 50, 365)).toBeCloseTo(-0.038462, 6);
  });

  it("returns null for invalid inputs", () => {
    expect(annualizedReturn(0, O, 120)).toBeNull();
    expect(annualizedReturn(P, O, NaN)).toBeNull();
  });
});

describe("downside", () => {
  it("computes the loss to the break price", () => {
    expect(downside(P, B)).toBeCloseTo(-0.166667, 6);
  });

  it("returns null for invalid inputs", () => {
    expect(downside(0, B)).toBeNull();
    expect(downside(P, NaN)).toBeNull();
    expect(downside(P, -1)).toBeNull();
  });
});

describe("breakEvenProbability", () => {
  it("computes the completion probability at which expected value is zero", () => {
    expect(breakEvenProbability(P, O, B)).toBeCloseTo(0.8, 10);
  });

  it("returns null when the break price is at or above the current price", () => {
    expect(breakEvenProbability(P, O, 48)).toBeNull();
    expect(breakEvenProbability(P, O, 49)).toBeNull();
  });

  it("returns null when the offer is at or below the break price", () => {
    expect(breakEvenProbability(35, 40, 40)).toBeNull();
  });

  it("exceeds 1 when the target trades above the offer (market implies a higher bid)", () => {
    // (52 - 40) / (50 - 40) = 1.2
    expect(breakEvenProbability(52, 50, 40)).toBeCloseTo(1.2, 10);
  });

  it("returns null for invalid inputs", () => {
    expect(breakEvenProbability(0, O, B)).toBeNull();
    expect(breakEvenProbability(P, NaN, B)).toBeNull();
  });
});

describe("daysBetween", () => {
  it("counts calendar days between YYYY-MM-DD dates", () => {
    expect(daysBetween("2026-01-01", "2026-05-01")).toBe(120);
    expect(daysBetween("2026-11-04", "2026-11-04")).toBe(0);
    expect(daysBetween("2026-11-05", "2026-11-04")).toBe(-1);
  });

  it("is unaffected by daylight saving transitions", () => {
    // US DST ends 2026-11-01; a local-time implementation could return 0.958...
    expect(daysBetween("2026-10-31", "2026-11-02")).toBe(2);
    expect(daysBetween("2026-03-07", "2026-03-09")).toBe(2);
  });

  it("handles leap years", () => {
    expect(daysBetween("2028-02-28", "2028-03-01")).toBe(2);
  });

  it("returns null for malformed dates", () => {
    expect(daysBetween("2026-13-01", "2026-01-01")).toBeNull();
    expect(daysBetween("2026-02-30", "2026-03-01")).toBeNull();
    expect(daysBetween("11/04/2026", "2026-11-04")).toBeNull();
    expect(daysBetween("", "2026-11-04")).toBeNull();
  });
});

describe("todayInNewYork", () => {
  it("uses the US market date, not UTC", () => {
    // 2026-11-05 02:00 UTC is still 2026-11-04 in New York
    expect(todayInNewYork(new Date("2026-11-05T02:00:00Z"))).toBe("2026-11-04");
    expect(todayInNewYork(new Date("2026-11-05T15:00:00Z"))).toBe("2026-11-05");
  });
});

const history = [
  { date: "2026-03-02", close: 30 },
  { date: "2026-03-03", close: 31 },
  { date: "2026-03-06", close: 32 }, // last trading day before announcement
  { date: "2026-03-09", close: 47 }, // announcement day
  { date: "2026-03-10", close: 48 },
  { date: "2026-03-11", close: 49 },
];

describe("unaffectedPrice", () => {
  it("is the close on the last trading day before the announcement", () => {
    expect(unaffectedPrice(history, "2026-03-09")).toBe(32);
  });

  it("works when the announcement falls on a non-trading day", () => {
    expect(unaffectedPrice(history, "2026-03-08")).toBe(32);
  });

  it("does not depend on input order", () => {
    expect(unaffectedPrice([...history].reverse(), "2026-03-09")).toBe(32);
  });

  it("skips missing closes", () => {
    const withGap = [
      { date: "2026-03-05", close: 31.5 },
      { date: "2026-03-06", close: null },
      { date: "2026-03-09", close: 47 },
    ];
    expect(unaffectedPrice(withGap, "2026-03-09")).toBe(31.5);
  });

  it("returns null when there is no history before the announcement", () => {
    expect(unaffectedPrice(history, "2026-03-01")).toBeNull();
    expect(unaffectedPrice([], "2026-03-09")).toBeNull();
  });
});

describe("spreadHistory", () => {
  it("computes the daily spread from the announcement day onward", () => {
    const result = spreadHistory(history, 50, "2026-03-09");
    expect(result.map((r) => r.date)).toEqual(["2026-03-09", "2026-03-10", "2026-03-11"]);
    expect(result[0].spreadPct).toBeCloseTo(3 / 47, 10);
    expect(result[1].spreadPct).toBeCloseTo(2 / 48, 10);
    expect(result[2].spreadPct).toBeCloseTo(1 / 49, 10);
  });

  it("is sorted by date and skips missing or bad closes", () => {
    const messy = [
      { date: "2026-03-11", close: 49 },
      { date: "2026-03-10", close: null },
      { date: "2026-03-09", close: 0 },
      { date: "2026-03-12", close: 51 },
    ];
    const result = spreadHistory(messy, 50, "2026-03-09");
    expect(result.map((r) => r.date)).toEqual(["2026-03-11", "2026-03-12"]);
    expect(result[1].spreadPct).toBeCloseTo(-1 / 51, 10);
  });
});

describe("computeMetrics", () => {
  it("combines all metrics for a deal", () => {
    const m = computeMetrics({
      price: P,
      offer: O,
      breakPrice: B,
      expectedCloseDate: "2026-05-01",
      today: "2026-01-01",
    });
    expect(m.daysToClose).toBe(120);
    expect(m.spreadDollars).toBeCloseTo(2, 10);
    expect(m.spreadPct).toBeCloseTo(0.041667, 6);
    expect(m.annualized).toBeCloseTo(0.126736, 6);
    expect(m.downside).toBeCloseTo(-0.166667, 6);
    expect(m.breakEven).toBeCloseTo(0.8, 10);
  });

  it("returns nulls (never NaN) when the price is unavailable", () => {
    const m = computeMetrics({
      price: null,
      offer: O,
      breakPrice: B,
      expectedCloseDate: "2026-05-01",
      today: "2026-01-01",
    });
    expect(m.daysToClose).toBe(120);
    expect(m.spreadDollars).toBeNull();
    expect(m.spreadPct).toBeNull();
    expect(m.annualized).toBeNull();
    expect(m.downside).toBeNull();
    expect(m.breakEven).toBeNull();
  });

  it("returns null break-dependent metrics when no break price is known", () => {
    const m = computeMetrics({
      price: P,
      offer: O,
      breakPrice: null,
      expectedCloseDate: "2026-05-01",
      today: "2026-01-01",
    });
    expect(m.spreadPct).toBeCloseTo(0.041667, 6);
    expect(m.downside).toBeNull();
    expect(m.breakEven).toBeNull();
  });

  it("returns null annualized when past the expected close", () => {
    const m = computeMetrics({
      price: P,
      offer: O,
      breakPrice: B,
      expectedCloseDate: "2026-01-01",
      today: "2026-02-01",
    });
    expect(m.daysToClose).toBe(-31);
    expect(m.annualized).toBeNull();
  });
});
