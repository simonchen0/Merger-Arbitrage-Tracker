import { afterEach, describe, expect, it, vi } from "vitest";
import { isRumour, readStoredRumours } from "./rumours";
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
