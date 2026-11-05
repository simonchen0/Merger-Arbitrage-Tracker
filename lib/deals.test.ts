import { afterEach, describe, expect, it, vi } from "vitest";
import seedDeals from "@/data/seed-deals.json";
import { isValidDate, todayInNewYork } from "./calc";
import { DEALS_AS_OF, REMOVED_SEED_IDS, SEED_VERSION, isDeal, readStored, refresh, type Stored } from "./deals";
import type { Deal } from "./types";

const seeds = seedDeals as Deal[];

const userDeal: Deal = {
  id: "user-1",
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

  it("still accepts deals saved by older versions, which carried an extra isDemo field", () => {
    expect(isDeal({ ...userDeal, isDemo: false })).toBe(true);
  });

  it("rejects non-objects", () => {
    for (const bad of [null, undefined, "junk", 5, true, []]) expect(isDeal(bad)).toBe(false);
  });

  it("rejects a deal missing a required field or with a wrong type", () => {
    const noId: Partial<Deal> = { ...userDeal };
    delete noId.id;
    expect(isDeal(noId)).toBe(false);
    expect(isDeal({ ...userDeal, offerPrice: "50" })).toBe(false);
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
  const demoDeal = (id: string): Deal => ({ ...userDeal, id, targetTicker: "DEMO" });

  it("leaves an up-to-date list alone", () => {
    const { deals, changed } = refresh(current([...seeds, userDeal]));
    expect(changed).toBe(false);
    expect(deals).toEqual([...seeds, userDeal]);
  });

  it("adds the seeded deals for an old stored version and keeps the user's own", () => {
    const { deals, changed } = refresh({ seedVersion: 0, deals: [userDeal] });
    expect(changed).toBe(true);
    expect(deals.map((d) => d.id)).toContain("user-1");
    for (const s of seeds) expect(deals.map((d) => d.id)).toContain(s.id);
  });

  it("replaces a stored seed deal with the new seed version of it", () => {
    const edited = { ...seeds[0], offerPrice: 1 };
    const { deals } = refresh({ seedVersion: 0, deals: [edited] });
    expect(deals.find((d) => d.id === seeds[0].id)?.offerPrice).toBe(seeds[0].offerPrice);
  });

  it("removes seed deals that were later dropped, but only on a version bump", () => {
    const gone = demoDeal(REMOVED_SEED_IDS[0]);
    const old = refresh({ seedVersion: SEED_VERSION - 1, deals: [gone, userDeal] });
    expect(old.deals.map((d) => d.id)).not.toContain(REMOVED_SEED_IDS[0]);
    expect(old.deals.map((d) => d.id)).toContain("user-1");
    // Already current: the user's list is not touched.
    const same = refresh(current([gone, userDeal]));
    expect(same.deals.map((d) => d.id)).toContain(REMOVED_SEED_IDS[0]);
  });

  it("removes the old fictional demo deals from browsers that saved them", () => {
    const stored: Stored = {
      seedVersion: 2,
      deals: [demoDeal("demo-northwind"), demoDeal("demo-brightline"), demoDeal("demo-coastal"), seeds[0], userDeal],
    };
    const { deals, changed } = refresh(stored);
    expect(changed).toBe(true);
    expect(deals.map((d) => d.id).filter((id) => id.startsWith("demo-"))).toEqual([]);
    expect(deals.map((d) => d.id)).toContain("user-1");
    expect(deals.map((d) => d.id)).toContain(seeds[0].id);
  });

  it("never touches user-added deals, even past their close date", () => {
    const overdue = { ...userDeal, expectedCloseDate: "2026-01-01" };
    expect(refresh(current([overdue])).deals).toEqual([overdue]);
    expect(refresh({ seedVersion: 0, deals: [overdue] }).deals).toContain(overdue);
  });
});

describe("seed data", () => {
  it("is valid, has unique ids, and is never on the removed list", () => {
    const ids = seeds.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const d of seeds) {
      expect(isDeal(d)).toBe(true);
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

describe("DEALS_AS_OF", () => {
  it("is a real date that isn't in the future", () => {
    expect(isValidDate(DEALS_AS_OF)).toBe(true);
    expect(DEALS_AS_OF <= todayInNewYork()).toBe(true);
  });

  it("is not earlier than the newest announcement in the seed deals", () => {
    const newest = seeds.map((d) => d.announceDate).sort().at(-1)!;
    expect(DEALS_AS_OF >= newest).toBe(true);
  });
});
