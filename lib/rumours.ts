// Rumoured deals live in the browser (localStorage), separate from announced deals. Rumours are
// added only by hand (the form) or by Claude on request, into data/seed-rumours.json (shared).
// Nothing finds or adds rumours automatically.
//
// Same pattern as lib/deals.ts: useRumours() subscribes components to the stored list, and
// every change re-renders the subscribers (including other open tabs).
import { useMemo, useSyncExternalStore } from "react";
import seedRumours from "@/data/seed-rumours.json";
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

/** True if a rumour for this ticker ships with the site (a visitor's own row for it would stay hidden). */
export function isSharedTicker(ticker: string, shared: Rumour[] = SHARED_RUMOURS): boolean {
  return shared.some((r) => r.targetTicker.toUpperCase() === ticker.toUpperCase());
}

/**
 * The saved rumours (invalid entries dropped), or an empty list if none or unreadable. An earlier
 * version added "auto-found" rows from a headline scan; that feature was removed and those rows
 * were never checked by a person, so they are dropped here.
 */
export function readStoredRumours(): Rumour[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x) => isRumour(x) && !(x as { autoFound?: unknown }).autoFound);
  } catch {
    return [];
  }
}

/** Removes the leftover state of the removed headline scan (when it last ran, dismissed tickers). */
function clearScanLeftovers(): void {
  try {
    localStorage.removeItem("merger-arb-rumour-scan-v1");
  } catch {
    // Storage blocked: nothing to clean.
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
  if (cache === null) {
    cache = readStoredRumours();
    clearScanLeftovers();
  }
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

/** Rumours shipped with the site, from data/seed-rumours.json (invalid entries ignored). */
export const SHARED_RUMOURS: Rumour[] = (seedRumours as unknown[]).filter(isRumour);

/**
 * The shared rumours (marked `shared`) followed by the visitor's own. If the visitor tracks a
 * ticker that is also shared, the shared row wins and theirs stays hidden in storage.
 */
export function mergeShared(stored: Rumour[], shared: Rumour[] = SHARED_RUMOURS): Rumour[] {
  const sharedTickers = new Set(shared.map((r) => r.targetTicker.toUpperCase()));
  return [
    ...shared.map((r) => ({ ...r, shared: true as const })),
    ...stored.filter((r) => !sharedTickers.has(r.targetTicker.toUpperCase())),
  ];
}

/** The shared and stored rumours, or null during server render (before the browser takes over). */
export function useRumours(): Rumour[] | null {
  const stored = useSyncExternalStore(subscribe, getRumours, () => null);
  return useMemo(() => (stored === null ? null : mergeShared(stored)), [stored]);
}
