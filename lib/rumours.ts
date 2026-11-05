// Rumoured deals live in the browser (localStorage), separate from announced deals.
// There is no seed list: rumours go stale fast and each one needs checking against its source,
// so the list starts empty and the user adds what they've verified.
//
// Same pattern as lib/deals.ts: useRumours() subscribes components to the stored list, and
// every change re-renders the subscribers (including other open tabs).
import { useSyncExternalStore } from "react";
import type { Rumour } from "./types";

const STORAGE_KEY = "merger-arb-rumours-v1";

let cache: Rumour[] | null = null;
const listeners = new Set<() => void>();
let storageBound = false;

const optional = (v: unknown, type: "string" | "number") => v === undefined || typeof v === type;

/** Guards against hand-edited or damaged storage: a bad entry would otherwise crash the page. */
export function isRumour(x: unknown): x is Rumour {
  if (typeof x !== "object" || x === null) return false;
  const r = x as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    typeof r.targetTicker === "string" &&
    typeof r.targetName === "string" &&
    typeof r.sourceUrl === "string" &&
    typeof r.reportDate === "string" &&
    optional(r.acquirerName, "string") &&
    optional(r.reportedPrice, "number") &&
    optional(r.reportedCloseDate, "string")
  );
}

/** The saved rumours (invalid entries dropped), or an empty list if none or unreadable. */
export function readStoredRumours(): Rumour[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed.filter(isRumour) : [];
  } catch {
    return [];
  }
}

function persist(rumours: Rumour[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rumours));
  } catch {
    // Storage blocked (e.g. private mode): the app still works for this session.
  }
}

function getRumours(): Rumour[] {
  if (cache === null) cache = readStoredRumours();
  return cache;
}

function setRumours(rumours: Rumour[]): void {
  cache = rumours;
  persist(rumours);
  listeners.forEach((l) => l());
}

/** Adds a new rumour, or replaces the existing one with the same id. */
export function saveRumour(rumour: Rumour): void {
  const list = getRumours();
  const exists = list.some((r) => r.id === rumour.id);
  setRumours(exists ? list.map((r) => (r.id === rumour.id ? rumour : r)) : [...list, rumour]);
}

export function deleteRumour(id: string): void {
  setRumours(getRumours().filter((r) => r.id !== id));
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

/** The stored rumours, or null during server render (before the browser takes over). */
export function useRumours(): Rumour[] | null {
  return useSyncExternalStore(subscribe, getRumours, () => null);
}
