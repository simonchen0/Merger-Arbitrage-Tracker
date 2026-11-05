import { describe, expect, it } from "vitest";
import type { Deal } from "./types";
import { parseUnaffectedKey, unaffectedKey } from "./useMarketData";

const deal: Deal = {
  id: "x",
  isDemo: false,
  targetName: "Varonis",
  targetTicker: "VRNS",
  acquirerName: "Proofpoint",
  offerPrice: 49.75,
  announceDate: "2026-10-15",
  expectedCloseDate: "2027-06-30",
};

describe("unaffectedKey / parseUnaffectedKey", () => {
  it("round-trips a deal without an unaffected date", () => {
    expect(parseUnaffectedKey(unaffectedKey(deal))).toEqual({
      ticker: "VRNS",
      announceDate: "2026-10-15",
      unaffectedDate: undefined,
    });
  });

  it("round-trips a deal with an unaffected date", () => {
    expect(parseUnaffectedKey(unaffectedKey({ ...deal, unaffectedDate: "2026-06-22" }))).toEqual({
      ticker: "VRNS",
      announceDate: "2026-10-15",
      unaffectedDate: "2026-06-22",
    });
  });

  it("gives different keys when the unaffected date differs (so each is looked up separately)", () => {
    expect(unaffectedKey(deal)).not.toBe(unaffectedKey({ ...deal, unaffectedDate: "2026-06-22" }));
  });

  it("round-trips tickers with dots and dashes", () => {
    expect(parseUnaffectedKey(unaffectedKey({ ...deal, targetTicker: "BRK.B" })).ticker).toBe("BRK.B");
  });
});
