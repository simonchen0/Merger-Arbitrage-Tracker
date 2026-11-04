// Demo deals: fictional companies with simulated prices. They never call Yahoo.
//
// Prices are deterministic: the same deal always produces the same price on the
// same date, so the demo looks identical on every reload and history doesn't
// change as days pass.
import type { PricePoint } from "./calc";
import type { Deal } from "./types";

const DAY_MS = 86_400_000;

function toTime(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function toDate(t: number): string {
  return new Date(t).toISOString().slice(0, 10);
}

function addDays(date: string, days: number): string {
  return toDate(toTime(date) + days * DAY_MS);
}

/** Demo deals with dates relative to `today`, so they never go stale. */
export function createDemoDeals(today: string): Deal[] {
  return [
    {
      id: "demo-northwind",
      isDemo: true,
      targetName: "Northwind Biotherapeutics",
      targetTicker: "NWBX",
      acquirerName: "Halcyon Pharma",
      offerPrice: 62,
      announceDate: addDays(today, -75),
      expectedCloseDate: addDays(today, 105),
    },
    {
      id: "demo-brightline",
      isDemo: true,
      targetName: "Brightline Software",
      targetTicker: "BLSX",
      acquirerName: "Summit Equity Partners",
      offerPrice: 28.5,
      announceDate: addDays(today, -30),
      expectedCloseDate: addDays(today, 150),
    },
    {
      id: "demo-coastal",
      isDemo: true,
      targetName: "Coastal Grid Utilities",
      targetTicker: "CGUX",
      acquirerName: "Meridian Infrastructure Fund",
      offerPrice: 45,
      announceDate: addDays(today, -200),
      expectedCloseDate: addDays(today, 40),
    },
  ];
}

// Small seeded PRNG (mulberry32) so simulated prices are reproducible.
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(s: string): number {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

/**
 * Simulated daily closes (weekdays) from ~6 weeks before the announcement to `today`.
 * Before the announcement the stock random-walks; on announcement it jumps to near
 * the offer, then the spread narrows toward ~0.5% by the expected close, with noise.
 */
export function demoHistory(deal: Deal, today: string): PricePoint[] {
  const rand = rng(hash(deal.id));
  const normal = () => Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand());

  const premium = 0.25 + rand() * 0.2; // 25–45% takeover premium
  const startSpread = 0.03 + rand() * 0.05; // 3–8% spread right after announcement
  const endSpread = 0.005;

  const start = toTime(deal.announceDate) - 42 * DAY_MS;
  const announce = toTime(deal.announceDate);
  const close = toTime(deal.expectedCloseDate);
  const end = toTime(today);

  const points: PricePoint[] = [];
  let price = deal.offerPrice / (1 + premium);
  let noise = 0;

  for (let t = start; t <= end; t += DAY_MS) {
    const weekday = new Date(t).getUTCDay();
    if (weekday === 0 || weekday === 6) continue;

    if (t < announce) {
      price *= 1 + normal() * 0.012;
    } else {
      const progress = Math.min(1, (t - announce) / Math.max(DAY_MS, close - announce));
      noise = 0.8 * noise + normal() * 0.003;
      const s = Math.max(-0.005, startSpread + (endSpread - startSpread) * progress + noise);
      price = deal.offerPrice / (1 + s);
    }
    points.push({ date: toDate(t), close: Math.round(price * 100) / 100 });
  }
  return points;
}
