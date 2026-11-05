import { afterEach, describe, expect, it, vi } from "vitest";
import seedDeals from "@/data/seed-deals.json";
import { createDemoDeals } from "./demo";
import { REMOVED_SEED_IDS, SEED_VERSION, isDeal, readStored, refresh, type Stored } from "./deals";
import { daysBetween } from "./calc";
import type { Deal } from "./types";

const TODAY = "2026-11-04";
const seeds = seedDeals as Deal[];

const userDeal: Deal = {
  id: "user-1",
  isDemo: false,
  targetName: "My Deal",
  targetTicker: "ABC",
  acquirerName: "Buyer",
  offerPrice: 50,
  announceDate: "2026-10-01",
  expectedCloseDate: "2027-03-31",
};

/** Minimal stand-in for window.localStorage. */
function stubStorage(items: Record<string, string>) {
  vi.stubGlobal("localStorage", { getItem: (k: string) => items[k] ?? null });
}
afterEach(() => vi.unstubAllGlobals());

describe("isDeal", () => {
  it("accepts a valid deal, with or without optional fields", () => {
    expect(isDeal(userDeal)).toBe(true);
    expect(isDeal({ ...userDeal, breakPrice: 40, unaffectedDate: "2026-09-20", sourceUrl: "https://x.test" })).toBe(true);
  });

  it("rejects non-objects", () => {
    for (const bad of [null, undefined, "junk", 5, true, []]) expect(isDeal(bad)).toBe(false);
  });

  it("rejects a deal missing a required field or with a wrong type", () => {
    const noId: Partial<Deal> = { ...userDeal };
    delete noId.id;
    expect(isDeal(noId)).toBe(false);
    expect(isDeal({ ...userDeal, offerPrice: "50" })).toBe(false);
    expect(isDeal({ ...userDeal, isDemo: "no" })).toBe(false);
    expect(isDeal({ ...userDeal, targetTicker: 12 })).toBe(false);
    expect(isDeal({ ...userDeal, expectedCloseDate: undefined })).toBe(false);
  });
});

describe("readStored", () => {
  it("reads the current format", () => {
    stubStorage({ "merger-arb-deals-v2": JSON.stringify({ seedVersion: 2, deals: [userDeal] }) });
    expect(readStored()).toEqual({ seedVersion: 2, deals: [userDeal] });
  });

  it("drops damaged entries and keeps the valid ones", () => {
    stubStorage({
      "merger-arb-deals-v2": JSON.stringify({ seedVersion: 2, deals: [null, { id: 5 }, "junk", userDeal] }),
    });
    expect(readStored()?.deals).toEqual([userDeal]);
  });

  it("migrates the old plain-array format as seed version 0", () => {
    stubStorage({ "merger-arb-deals-v1": JSON.stringify([userDeal, null]) });
    expect(readStored()).toEqual({ seedVersion: 0, deals: [userDeal] });
  });

  it("returns null when nothing is stored or storage is unreadable", () => {
    stubStorage({});
    expect(readStored()).toBeNull();
    stubStorage({ "merger-arb-deals-v2": "{not json" });
    expect(readStored()).toBeNull();
    stubStorage({ "merger-arb-deals-v2": JSON.stringify({ deals: "nope" }) });
    expect(readStored()).toBeNull();
  });

  it("returns null when storage access throws (blocked storage)", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("denied");
      },
    });
    expect(readStored()).toBeNull();
  });
});

describe("refresh", () => {
  const current = (deals: Deal[]): Stored => ({ seedVersion: SEED_VERSION, deals });

  it("leaves an up-to-date list alone", () => {
    const demos = createDemoDeals(TODAY);
    const { deals, changed } = refresh(current([...seeds, ...demos, userDeal]), TODAY);
    expect(changed).toBe(false);
    expect(deals).toEqual([...seeds, ...demos, userDeal]);
  });

  it("adds the seeded deals for an old stored version and keeps the user's own", () => {
    const { deals, changed } = refresh({ seedVersion: 0, deals: [userDeal] }, TODAY);
    expect(changed).toBe(true);
    expect(deals.map((d) => d.id)).toContain("user-1");
    for (const s of seeds) expect(deals.map((d) => d.id)).toContain(s.id);
  });

  it("replaces a stored seed deal with the new seed version of it", () => {
    const edited = { ...seeds[0], offerPrice: 1 };
    const { deals } = refresh({ seedVersion: 0, deals: [edited] }, TODAY);
    expect(deals.find((d) => d.id === seeds[0].id)?.offerPrice).toBe(seeds[0].offerPrice);
  });

  it("removes seed deals that were later dropped, but only on a version bump", () => {
    const gone: Deal = { ...userDeal, id: REMOVED_SEED_IDS[0], targetTicker: "MG" };
    const old = refresh({ seedVersion: SEED_VERSION - 1, deals: [gone, userDeal] }, TODAY);
    expect(old.deals.map((d) => d.id)).not.toContain(REMOVED_SEED_IDS[0]);
    expect(old.deals.map((d) => d.id)).toContain("user-1");
    // Already current: the user's list is not touched.
    const same = refresh(current([gone, userDeal]), TODAY);
    expect(same.deals.map((d) => d.id)).toContain(REMOVED_SEED_IDS[0]);
  });

  it("regenerates a demo deal that is past or close to its expected close date", () => {
    const stale: Deal = { ...createDemoDeals(TODAY)[2], expectedCloseDate: "2026-10-01" };
    const soon: Deal = { ...createDemoDeals(TODAY)[0], expectedCloseDate: "2026-11-10" }; // 6 days
    const { deals, changed } = refresh(current([stale, soon]), TODAY);
    expect(changed).toBe(true);
    for (const d of deals) expect(daysBetween(TODAY, d.expectedCloseDate)!).toBeGreaterThan(7);
  });

  it("keeps a demo deal that still has time left, including the user's edits to it", () => {
    const edited: Deal = { ...createDemoDeals(TODAY)[1], offerPrice: 99 };
    const { deals, changed } = refresh(current([edited]), TODAY);
    expect(changed).toBe(false);
    expect(deals[0].offerPrice).toBe(99);
  });

  it("never touches user-added deals, even past their close date", () => {
    const overdue = { ...userDeal, expectedCloseDate: "2026-01-01" };
    const { deals } = refresh(current([overdue]), TODAY);
    expect(deals).toEqual([overdue]);
  });
});

describe("seed data", () => {
  it("is valid, has unique ids, and is never on the removed list", () => {
    const ids = seeds.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const d of seeds) {
      expect(isDeal(d)).toBe(true);
      expect(d.isDemo).toBe(false);
      expect(REMOVED_SEED_IDS).not.toContain(d.id);
    }
  });

  it("has sensible dates and source links on every real deal", () => {
    for (const d of seeds) {
      expect(d.expectedCloseDate > d.announceDate).toBe(true);
      if (d.unaffectedDate) expect(d.unaffectedDate < d.announceDate).toBe(true);
      expect(d.offerPrice).toBeGreaterThan(0);
      expect(d.sourceUrl).toMatch(/^https:\/\/www\.sec\.gov\//);
    }
  });
});
