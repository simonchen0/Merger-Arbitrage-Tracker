// Deals live in the browser (localStorage). On first visit they're seeded with
// the real deals from data/seed-deals.json plus generated demo deals.
//
// useDeals() subscribes components to the stored list; setDeals() saves and
// re-renders every subscriber. No state library needed.
import { useSyncExternalStore } from "react";
import seedDeals from "@/data/seed-deals.json";
import { todayInNewYork } from "./calc";
import { createDemoDeals } from "./demo";
import type { Deal } from "./types";

const STORAGE_KEY = "merger-arb-deals-v1";

let cache: Deal[] | null = null;
const listeners = new Set<() => void>();

function seed(): Deal[] {
  return [...(seedDeals as Deal[]), ...createDemoDeals(todayInNewYork())];
}

/** Guards against hand-edited or damaged storage: a bad entry would otherwise crash the page. */
function isDeal(x: unknown): x is Deal {
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

function load(): Deal[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Keep the valid deals and drop the rest.
      if (Array.isArray(parsed)) return parsed.filter(isDeal);
    }
  } catch {
    // Unreadable or corrupt storage: fall through to the seed data.
  }
  const deals = seed();
  persist(deals);
  return deals;
}

function persist(deals: Deal[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(deals));
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
  return () => listeners.delete(listener);
}

/** The stored deals, or null during server render (before the browser takes over). */
export function useDeals(): Deal[] | null {
  return useSyncExternalStore(subscribe, getDeals, () => null);
}
