import { describe, expect, it } from "vitest";
import { findClosed, historyCheckFromStatus, type HistoryCheck } from "./closedDeals";
import type { Deal } from "./types";

const deal = (ticker: string): Deal => ({
  id: ticker.toLowerCase(),
  targetName: `${ticker} Inc`,
  targetTicker: ticker,
  acquirerName: "Buyer",
  offerPrice: 50,
  announceDate: "2026-10-01",
  expectedCloseDate: "2027-03-31",
});

const gone: HistoryCheck = "no-data";
const ids = (deals: Deal[]) => deals.map((d) => d.id);

describe("historyCheckFromStatus", () => {
  it("treats only 200 as data and only 404 as no data; everything else says nothing", () => {
    expect(historyCheckFromStatus(200)).toBe("has-data");
    expect(historyCheckFromStatus(404)).toBe("no-data");
    for (const s of [400, 429, 500, 502, 503, 0]) expect(historyCheckFromStatus(s), String(s)).toBe("unknown");
  });
});

describe("findClosed", () => {
  const deals = [deal("AAA"), deal("BBB"), deal("CCC")];

  it("removes a deal whose ticker is missing from quotes and has no price history", () => {
    expect(ids(findClosed(deals, ["BBB"], { BBB: gone }))).toEqual(["bbb"]);
  });

  it("keeps it if Yahoo still has history for the ticker (the missing quote may be a blip)", () => {
    expect(findClosed(deals, ["BBB"], { BBB: "has-data" })).toEqual([]);
  });

  it("keeps it if the history check failed or never ran", () => {
    expect(findClosed(deals, ["BBB"], { BBB: "unknown" })).toEqual([]);
    expect(findClosed(deals, ["BBB"], {})).toEqual([]);
  });

  it("keeps a deal with no history if its quote is present", () => {
    expect(findClosed(deals, [], { AAA: gone, BBB: gone, CCC: gone })).toEqual([]);
    expect(findClosed(deals, ["AAA"], { AAA: gone, BBB: gone })).toEqual([deals[0]]);
  });

  it("removes several closed deals at once", () => {
    expect(ids(findClosed(deals, ["AAA", "CCC"], { AAA: gone, CCC: gone }))).toEqual(["aaa", "ccc"]);
  });

  it("removes nothing when every tracked ticker is missing and there are three or more: that's an outage", () => {
    expect(findClosed(deals, ["AAA", "BBB", "CCC"], { AAA: gone, BBB: gone, CCC: gone })).toEqual([]);
  });

  it("still removes when all of just one or two tracked tickers are missing", () => {
    expect(ids(findClosed([deal("AAA")], ["AAA"], { AAA: gone }))).toEqual(["aaa"]);
    expect(ids(findClosed([deal("AAA"), deal("BBB")], ["AAA", "BBB"], { AAA: gone, BBB: gone }))).toEqual(["aaa", "bbb"]);
  });

  it("does not trip the outage guard when at least one tracked ticker is fine", () => {
    expect(ids(findClosed(deals, ["AAA", "BBB"], { AAA: gone, BBB: gone }))).toEqual(["aaa", "bbb"]);
  });

  it("counts a ticker once for the guard even if two deals share it", () => {
    const dup = [deal("AAA"), { ...deal("AAA"), id: "aaa-2" }, deal("BBB")];
    // Two distinct tickers, both missing: fewer than three, so the guard doesn't apply.
    expect(ids(findClosed(dup, ["AAA", "BBB"], { AAA: gone, BBB: gone }))).toEqual(["aaa", "aaa-2", "bbb"]);
  });

  it("matches tickers in any letter case", () => {
    expect(ids(findClosed([deal("abc")], ["ABC"], { ABC: gone }))).toEqual(["abc"]);
  });

  it("handles empty inputs", () => {
    expect(findClosed([], [], {})).toEqual([]);
    expect(findClosed(deals, [], {})).toEqual([]);
  });
});
