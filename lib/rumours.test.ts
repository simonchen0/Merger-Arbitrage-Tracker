import { afterEach, describe, expect, it, vi } from "vitest";
import seedRumours from "@/data/seed-rumours.json";
import { isRumour, isSharedTicker, mergeShared, readStoredRumours } from "./rumours";
import { validateRumour } from "./validate";
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

describe("rumours from the removed headline scan", () => {
  // An earlier version added unverified "auto-found" rows. That feature is gone, and nobody had
  // checked those rows, so they are dropped when the saved list is read.
  const legacyAuto = { ...minimal, id: "auto-ABC", autoFound: true, headline: "ABC in talks to be acquired" };

  it("drops legacy auto-found rows when loading, and keeps every other row", () => {
    stubStorage({ "merger-arb-rumours-v1": JSON.stringify([legacyAuto, minimal]) });
    expect(readStoredRumours()).toEqual([minimal]);
  });

  it("keeps a row that was auto-found and then edited by the user (the edit cleared the flag)", () => {
    const edited = { ...minimal, id: "auto-XYZ", acquirerName: "Buyer" };
    stubStorage({ "merger-arb-rumours-v1": JSON.stringify([edited]) });
    expect(readStoredRumours()).toEqual([edited]);
  });
});

describe("isSharedTicker", () => {
  const shared: Rumour[] = [{ ...minimal, id: "shared-ABC", targetTicker: "ABC" }];
  it("matches a shared ticker in any case", () => {
    expect(isSharedTicker("abc", shared)).toBe(true);
    expect(isSharedTicker("XYZ", shared)).toBe(false);
    expect(isSharedTicker("ABC", [])).toBe(false);
  });
});

describe("shared rumours", () => {
  const shared: Rumour = { ...minimal, id: "shared-ABC", targetTicker: "ABC" };
  const mine: Rumour = { ...minimal, id: "mine-XYZ", targetTicker: "XYZ" };

  it("mergeShared puts shared rumours first, marked shared, then the visitor's own", () => {
    const merged = mergeShared([mine], [shared]);
    expect(merged.map((r) => r.id)).toEqual(["shared-ABC", "mine-XYZ"]);
    expect(merged[0].shared).toBe(true);
    expect(merged[1].shared).toBeUndefined();
  });

  it("mergeShared hides the visitor's own row for a ticker that is shared (any case)", () => {
    const duplicate = { ...mine, id: "mine-abc", targetTicker: "abc" };
    expect(mergeShared([duplicate, mine], [shared]).map((r) => r.id)).toEqual(["shared-ABC", "mine-XYZ"]);
  });

  it("mergeShared doesn't change what is stored, and works with nothing shared", () => {
    expect(mergeShared([mine], [])).toEqual([mine]);
    expect(mergeShared([], [])).toEqual([]);
  });
});

describe("data/seed-rumours.json", () => {
  const seeds = seedRumours as Rumour[];

  it("only holds entries that pass the same validation as the add form", () => {
    for (const r of seeds) {
      const errors = validateRumour(
        {
          targetTicker: r.targetTicker,
          targetName: r.targetName,
          acquirerName: r.acquirerName ?? "",
          sourceUrl: r.sourceUrl,
          reportDate: r.reportDate,
          reportedPrice: r.reportedPrice !== undefined ? String(r.reportedPrice) : "",
          reportedCloseDate: r.reportedCloseDate ?? "",
        },
        "9999-12-31",
      );
      expect(errors, r.id).toEqual({});
      expect(isRumour(r), r.id).toBe(true);
    }
  });

  it("has unique ids and tickers, ids prefixed shared-, and no stored-only fields", () => {
    expect(new Set(seeds.map((r) => r.id)).size).toBe(seeds.length);
    expect(new Set(seeds.map((r) => r.targetTicker.toUpperCase())).size).toBe(seeds.length);
    for (const r of seeds) {
      expect(r.id.startsWith("shared-"), r.id).toBe(true);
      expect((r as Record<string, unknown>).autoFound, r.id).toBeUndefined();
      expect(r.shared, r.id).toBeUndefined();
    }
  });
});
