import { afterEach, describe, expect, it, vi } from "vitest";
import { dropStale, isRumour, parseScanState, readStoredRumours } from "./rumours";
import type { Rumour } from "./types";

const minimal: Rumour = {
  id: "r-1",
  targetTicker: "ABC",
  targetName: "ABC Corp",
  sourceUrl: "https://www.reuters.com/x",
  reportDate: "2026-10-30",
};

/** Minimal stand-in for window.localStorage. */
function stubStorage(items: Record<string, string>) {
  vi.stubGlobal("localStorage", { getItem: (k: string) => items[k] ?? null });
}
afterEach(() => vi.unstubAllGlobals());

describe("isRumour", () => {
  it("accepts a rumour with only the required fields, or with all of them", () => {
    expect(isRumour(minimal)).toBe(true);
    expect(
      isRumour({ ...minimal, acquirerName: "Buyer", reportedPrice: 50, reportedCloseDate: "2027-06-30" }),
    ).toBe(true);
  });

  it("rejects non-objects", () => {
    for (const bad of [null, undefined, "junk", 5, true]) expect(isRumour(bad)).toBe(false);
  });

  it("rejects a missing source or report date", () => {
    expect(isRumour({ ...minimal, sourceUrl: undefined })).toBe(false);
    expect(isRumour({ ...minimal, reportDate: undefined })).toBe(false);
  });

  it("rejects optional fields of the wrong type", () => {
    expect(isRumour({ ...minimal, reportedPrice: "50" })).toBe(false);
    expect(isRumour({ ...minimal, acquirerName: 7 })).toBe(false);
    expect(isRumour({ ...minimal, reportedCloseDate: 20270630 })).toBe(false);
  });
});

describe("readStoredRumours", () => {
  it("starts empty when nothing is saved (there is no seed list)", () => {
    stubStorage({});
    expect(readStoredRumours()).toEqual([]);
  });

  it("reads saved rumours and drops invalid entries", () => {
    stubStorage({ "merger-arb-rumours-v1": JSON.stringify([minimal, { id: "bad" }, null]) });
    expect(readStoredRumours()).toEqual([minimal]);
  });

  it("returns an empty list for corrupt storage", () => {
    stubStorage({ "merger-arb-rumours-v1": "{not json" });
    expect(readStoredRumours()).toEqual([]);
    stubStorage({ "merger-arb-rumours-v1": JSON.stringify({ rumours: [minimal] }) });
    expect(readStoredRumours()).toEqual([]);
  });

  it("returns an empty list when storage is blocked", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
    });
    expect(readStoredRumours()).toEqual([]);
  });
});

describe("auto-found rumours", () => {
  const auto: Rumour = { ...minimal, id: "auto-ABC", autoFound: true, headline: "ABC in talks to be acquired" };

  it("isRumour accepts the auto-found fields and rejects bad ones", () => {
    expect(isRumour(auto)).toBe(true);
    expect(isRumour({ ...minimal, autoFound: false })).toBe(false);
    expect(isRumour({ ...minimal, headline: 5 })).toBe(false);
  });

  it("dropStale removes auto-found rows after 30 days, and keeps newer ones", () => {
    // 2026-10-05 → 2026-11-04 is exactly 30 days: kept. One day later: dropped.
    const old = { ...auto, reportDate: "2026-10-05" };
    expect(dropStale([old], "2026-11-04")).toEqual([old]);
    expect(dropStale([old], "2026-11-05")).toEqual([]);
  });

  it("dropStale never removes rumours the user added or edited, however old", () => {
    const manual = { ...minimal, reportDate: "2025-01-01" };
    expect(dropStale([manual], "2026-11-05")).toEqual([manual]);
  });

  it("dropStale keeps an auto-found row whose date can't be read, rather than guessing", () => {
    const odd = { ...auto, reportDate: "garbage" };
    expect(dropStale([odd], "2026-11-05")).toEqual([odd]);
  });

  it("readStoredRumours drops stale auto-found rows when loading", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-05T17:00:00Z"));
    const stale = { ...auto, id: "auto-OLD", reportDate: "2026-09-01" };
    stubStorage({ "merger-arb-rumours-v1": JSON.stringify([stale, auto, minimal]) });
    expect(readStoredRumours().map((r) => r.id)).toEqual(["auto-ABC", "r-1"]);
    vi.useRealTimers();
  });
});

describe("parseScanState", () => {
  it("reads a saved state", () => {
    expect(parseScanState(JSON.stringify({ lastScan: 1700000000000, dismissed: ["WEN", "GFL"] }))).toEqual({
      lastScan: 1700000000000,
      dismissed: ["WEN", "GFL"],
    });
  });

  it("starts fresh for missing, corrupt or wrong-shaped data", () => {
    const fresh = { lastScan: 0, dismissed: [] };
    expect(parseScanState(null)).toEqual(fresh);
    expect(parseScanState("{nope")).toEqual(fresh);
    expect(parseScanState(JSON.stringify([1, 2]))).toEqual(fresh);
    expect(parseScanState(JSON.stringify({ lastScan: "x", dismissed: "WEN" }))).toEqual(fresh);
  });

  it("keeps only string tickers", () => {
    expect(parseScanState(JSON.stringify({ lastScan: 1, dismissed: ["WEN", 5, null] })).dismissed).toEqual(["WEN"]);
  });
});
