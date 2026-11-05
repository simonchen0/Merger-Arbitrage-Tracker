// Deals live in the browser (localStorage). On first visit they're seeded with
// the real deals from data/seed-deals.json plus generated demo deals.
//
// useDeals() subscribes components to the stored list; setDeals() saves and
// re-renders every subscriber. No state library needed.
import { useSyncExternalStore } from "react";
import seedDeals from "@/data/seed-deals.json";
import { daysBetween, todayInNewYork } from "./calc";
import { createDemoDeals } from "./demo";
import type { Deal } from "./types";

const STORAGE_KEY = "merger-arb-deals-v2";
const LEGACY_STORAGE_KEY = "merger-arb-deals-v1"; // plain array, before seed versions

/** Bump when data/seed-deals.json changes, so returning visitors pick the changes up. */
export const SEED_VERSION = 2;

/**
 * Ids of seeded deals that were later removed from data/seed-deals.json. Browsers that saved
 * them drop them on the next seed version bump. (Add an id here whenever you delete a seed deal.)
 */
export const REMOVED_SEED_IDS = ["mg-hig"];

/** A demo deal this close to its expected close date (or past it) gets fresh dates. */
const DEMO_REFRESH_DAYS = 7;

export type Stored = { seedVersion: number; deals: Deal[] };

let cache: Deal[] | null = null;
const listeners = new Set<() => void>();
let storageBound = false;

function seed(): Deal[] {
  return [...(seedDeals as Deal[]), ...createDemoDeals(todayInNewYork())];
}

/** Guards against hand-edited or damaged storage: a bad entry would otherwise crash the page. */
export function isDeal(x: unknown): x is Deal {
  if (typeof x !== "object" || x === null) return false;
  const d = x as Record<string, unknown>;
  return (
    typeof d.id === "string" &&
    typeof d.isDemo === "boolean" &&
    typeof d.targetTicker === "string" &&
    typeof d.targetName === "string" &&
    typeof d.acquirerName === "string" &&
    typeof d.offerPrice === "number" &&
    typeof d.announceDate === "string" &&
    typeof d.expectedCloseDate === "string"
  );
}

export function readStored(): Stored | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.deals) && typeof parsed.seedVersion === "number") {
        // Keep the valid deals and drop the rest.
        return { seedVersion: parsed.seedVersion, deals: parsed.deals.filter(isDeal) };
      }
    }
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) {
      const parsed = JSON.parse(legacy);
      if (Array.isArray(parsed)) return { seedVersion: 0, deals: parsed.filter(isDeal) };
    }
  } catch {
    // Unreadable or corrupt storage: fall through to the seed data.
  }
  return null;
}

/**
 * Brings stored deals up to date without touching the user's own changes:
 *  - a newer seed version adds/replaces the seeded real deals (by id) and drops removed ones; user-added deals stay
 *  - demo deals about to pass their close date get regenerated dates, so the demo never reads "past expected close"
 */
export function refresh(stored: Stored, today = todayInNewYork()): { deals: Deal[]; changed: boolean } {
  let deals = stored.deals;
  let changed = stored.seedVersion !== SEED_VERSION;

  if (stored.seedVersion < SEED_VERSION) {
    const fresh = seedDeals as Deal[];
    const replaced = new Set([...fresh.map((d) => d.id), ...REMOVED_SEED_IDS]);
    deals = [...deals.filter((d) => !replaced.has(d.id)), ...fresh];
  }

  const freshDemos = new Map(createDemoDeals(today).map((d) => [d.id, d]));
  deals = deals.map((d) => {
    const fresh = d.isDemo ? freshDemos.get(d.id) : undefined;
    if (!fresh) return d;
    const left = daysBetween(today, d.expectedCloseDate);
    if (left !== null && left > DEMO_REFRESH_DAYS) return d;
    changed = true;
    return fresh;
  });

  return { deals, changed };
}

function load(): Deal[] {
  const stored = readStored();
  if (!stored) {
    const deals = seed();
    persist(deals);
    return deals;
  }
  const { deals, changed } = refresh(stored);
  if (changed) persist(deals);
  return deals;
}

function persist(deals: Deal[]): void {
  try {
    const stored: Stored = { seedVersion: SEED_VERSION, deals };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // Storage blocked (e.g. private mode): the app still works for this session.
  }
}

export function getDeals(): Deal[] {
  if (cache === null) cache = load();
  return cache;
}

export function setDeals(deals: Deal[]): void {
  cache = deals;
  persist(deals);
  listeners.forEach((l) => l());
}

export function resetDeals(): void {
  setDeals(seed());
}

/** Adds a new deal, or replaces the existing deal with the same id. */
export function saveDeal(deal: Deal): void {
  const deals = getDeals();
  const exists = deals.some((d) => d.id === deal.id);
  setDeals(exists ? deals.map((d) => (d.id === deal.id ? deal : d)) : [...deals, deal]);
}

export function deleteDeal(id: string): void {
  setDeals(getDeals().filter((d) => d.id !== id));
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Another tab changed the stored list: drop our copy so we don't overwrite its changes later.
  if (!storageBound) {
    storageBound = true;
    window.addEventListener("storage", (e) => {
      if (e.key !== null && e.key !== STORAGE_KEY) return;
      cache = null;
      listeners.forEach((l) => l());
    });
  }
  return () => listeners.delete(listener);
}

/** The stored deals, or null during server render (before the browser takes over). */
export function useDeals(): Deal[] | null {
  return useSyncExternalStore(subscribe, getDeals, () => null);
}
