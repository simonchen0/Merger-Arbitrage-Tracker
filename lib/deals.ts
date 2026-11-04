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

function load(): Deal[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as Deal[];
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

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The stored deals, or null during server render (before the browser takes over). */
export function useDeals(): Deal[] | null {
  return useSyncExternalStore(subscribe, getDeals, () => null);
}
