// Rumoured deals live in the browser (localStorage), separate from announced deals.
// There is no seed list; the headline scan (lib/useRumourScan.ts) adds unverified "auto-found"
// rows, which are labelled as such and expire after 30 days unless the user edits them.
//
// Same pattern as lib/deals.ts: useRumours() subscribes components to the stored list, and
// every change re-renders the subscribers (including other open tabs).
import { useMemo, useSyncExternalStore } from "react";
import seedRumours from "@/data/seed-rumours.json";
import { daysBetween, todayInNewYork } from "./calc";
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
    optional(r.reportedCloseDate, "string") &&
    optional(r.headline, "string") &&
    (r.autoFound === undefined || r.autoFound === true)
  );
}

/** Auto-found rumours stop being shown this many days after their report date. */
export const AUTO_FOUND_MAX_AGE_DAYS = 30;

/**
 * Drops auto-found rumours that have gone stale. Rumours the user added or edited are kept
 * however old they are.
 */
export function dropStale(rumours: Rumour[], today: string): Rumour[] {
  return rumours.filter((r) => {
    if (!r.autoFound) return true;
    const age = daysBetween(r.reportDate, today);
    return age === null || age <= AUTO_FOUND_MAX_AGE_DAYS;
  });
}

// What the headline scan remembers between visits: when it last ran, and which tickers the user
// deleted so the scan doesn't add them back. A dismissal lapses after DISMISS_DAYS: by then the
// headline that triggered it is too old to be picked up again, and a new story about the same
// company deserves to show.
const SCAN_KEY = "merger-arb-rumour-scan-v1";
export const DISMISS_DAYS = 30;
export type Dismissal = { ticker: string; at: number };
export type ScanState = { lastScan: number; dismissed: Dismissal[] };

export function parseScanState(raw: string | null, now: number = Date.now()): ScanState {
  const fresh: ScanState = { lastScan: 0, dismissed: [] };
  try {
    const p = raw ? JSON.parse(raw) : null;
    if (!p || typeof p !== "object") return fresh;
    const dismissed: Dismissal[] = [];
    for (const d of Array.isArray(p.dismissed) ? p.dismissed : []) {
      // Older versions stored bare ticker strings; treat those as dismissed just now.
      const entry =
        typeof d === "string"
          ? { ticker: d, at: now }
          : d && typeof d.ticker === "string" && Number.isFinite(d.at)
            ? { ticker: d.ticker, at: d.at as number }
            : null;
      if (entry && now - entry.at <= DISMISS_DAYS * 86_400_000) dismissed.push(entry);
    }
    return { lastScan: Number.isFinite(p.lastScan) ? p.lastScan : 0, dismissed };
  } catch {
    return fresh;
  }
}

export function readScanState(): ScanState {
  try {
    return parseScanState(localStorage.getItem(SCAN_KEY));
  } catch {
    return { lastScan: 0, dismissed: [] };
  }
}

export function writeScanState(state: ScanState): void {
  try {
    localStorage.setItem(SCAN_KEY, JSON.stringify(state));
  } catch {
    // Storage blocked: the scan just runs again next visit.
  }
}

/** The state with `ticker` dismissed as of `now` (replacing any earlier dismissal of it). */
export function withDismissed(state: ScanState, ticker: string, now: number = Date.now()): ScanState {
  const t = ticker.toUpperCase();
  return { ...state, dismissed: [...state.dismissed.filter((d) => d.ticker.toUpperCase() !== t), { ticker: t, at: now }] };
}

/** True if a rumour for this ticker ships with the site (a visitor's own row for it would stay hidden). */
export function isSharedTicker(ticker: string, shared: Rumour[] = SHARED_RUMOURS): boolean {
  return shared.some((r) => r.targetTicker.toUpperCase() === ticker.toUpperCase());
}

/** The saved rumours (invalid entries dropped), or an empty list if none or unreadable. */
export function readStoredRumours(): Rumour[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? dropStale(parsed.filter(isRumour), todayInNewYork()) : [];
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

/** Adds several rumours at once (the headline scan's results). */
export function saveRumours(added: Rumour[]): void {
  if (added.length === 0) return;
  const list = getRumours();
  const ids = new Set(added.map((r) => r.id));
  setRumours([...list.filter((r) => !ids.has(r.id)), ...added]);
}

/** Everything currently shown: shared rumours plus the visitor's own. */
export function getRumourList(): Rumour[] {
  return mergeShared(getRumours());
}

/**
 * Deleting a rumour also dismisses its ticker for a while, so the next scan doesn't add it back
 * (this covers an auto-found row the user has since edited, as well as one added by hand).
 */
export function deleteRumour(id: string): void {
  const list = getRumours();
  const gone = list.find((r) => r.id === id);
  if (gone) writeScanState(withDismissed(readScanState(), gone.targetTicker));
  setRumours(list.filter((r) => r.id !== id));
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
