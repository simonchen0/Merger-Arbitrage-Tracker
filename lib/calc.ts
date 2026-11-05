// All financial math for the tracker. Pure functions, no I/O.
//
// Notation: P = current target price, O = cash offer per share,
//           B = break price (where the target trades if the deal fails),
//           d = calendar days until expected close.
//
// Percentages are returned as decimals (0.0417 = 4.17%).
// Any metric that can't be computed meaningfully returns null, never NaN or Infinity.

export type PricePoint = { date: string; close: number | null };

const DAY_MS = 86_400_000;

function isPositive(x: number | null | undefined): x is number {
  return typeof x === "number" && Number.isFinite(x) && x > 0;
}

/** Spread in dollars (O − P) and percent of current price ((O − P) / P). */
export function spread(price: number, offer: number): { dollars: number; pct: number } | null {
  if (!isPositive(price) || !isPositive(offer)) return null;
  const dollars = offer - price;
  return { dollars, pct: dollars / price };
}

/** Simple annualized return if the deal closes: (O − P) / P × 365 / d. Null once d ≤ 0. */
export function annualizedReturn(price: number, offer: number, days: number): number | null {
  const s = spread(price, offer);
  if (!s || !Number.isFinite(days) || days <= 0) return null;
  return (s.pct * 365) / days;
}

/** Return if the deal breaks and the target falls to the break price: (B − P) / P. */
export function downside(price: number, breakPrice: number): number | null {
  if (!isPositive(price) || !isPositive(breakPrice)) return null;
  return (breakPrice - price) / price;
}

/**
 * Completion probability at which the trade's expected value is zero:
 *   p·O + (1 − p)·B = P  →  p = (P − B) / (O − B)
 * This is also the probability implied by the market price.
 * Null if B ≥ P (no downside to price), O ≤ B (no upside relative to break),
 * or P > O (target trades above the offer, so the market expects a higher bid
 * and the formula would exceed 100%).
 */
export function breakEvenProbability(price: number, offer: number, breakPrice: number): number | null {
  if (!isPositive(price) || !isPositive(offer) || !isPositive(breakPrice)) return null;
  if (breakPrice >= price || offer <= breakPrice || price > offer) return null;
  return (price - breakPrice) / (offer - breakPrice);
}

/** Parses a strict YYYY-MM-DD string to a UTC timestamp, or null if invalid. */
function parseDate(s: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = Date.UTC(y, mo - 1, d);
  const check = new Date(t);
  // Rejects rollovers like 2026-02-30 → 2026-03-02
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return null;
  return t;
}

/**
 * Range for the break-price slider: from a quarter of the current price (a deep drop) up to one
 * cent below the price and the offer (the highest break price that still means a loss).
 * Null when there is no room for a range or the inputs are unusable.
 */
export function breakPriceRange(price: number, offer: number): { min: number; max: number } | null {
  if (!isPositive(price) || !isPositive(offer)) return null;
  const cents = (x: number) => Math.round(x * 100) / 100;
  const min = Math.max(0.01, cents(price * 0.25));
  const max = cents(Math.min(price, offer) - 0.01);
  return max > min ? { min, max } : null;
}

/** Median of the finite numbers in `values` (null, undefined, NaN and Infinity are skipped); null if none. */
export function median(values: (number | null | undefined)[]): number | null {
  const v = values.filter((x): x is number => typeof x === "number" && Number.isFinite(x)).sort((a, b) => a - b);
  if (v.length === 0) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 === 1 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

/** True for a real calendar date in strict YYYY-MM-DD form. */
export function isValidDate(s: string): boolean {
  return parseDate(s) !== null;
}

/** Calendar days from one YYYY-MM-DD date to another (negative if `to` is earlier). */
export function daysBetween(from: string, to: string): number | null {
  const a = parseDate(from);
  const b = parseDate(to);
  if (a === null || b === null) return null;
  return Math.round((b - a) / DAY_MS);
}

/** Today's date (YYYY-MM-DD) in New York, the US market's calendar. */
export function todayInNewYork(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function validSorted(history: PricePoint[]): { date: string; close: number }[] {
  return history
    .filter((p): p is { date: string; close: number } => isPositive(p.close))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Unaffected price: the close on the last trading day before the announcement date.
 *
 * When news leaked before the announcement, that close already includes the run-up.
 * Pass `unaffectedDate` (the last day before the rumors, as stated in the company's
 * filing) to use the close on or before that date instead. A date that isn't before
 * the announcement is ignored.
 */
export function unaffectedPrice(
  history: PricePoint[],
  announceDate: string,
  unaffectedDate?: string,
): number | null {
  const cutoff = unaffectedDate && unaffectedDate < announceDate ? unaffectedDate : null;
  const before = validSorted(history).filter((p) => (cutoff ? p.date <= cutoff : p.date < announceDate));
  return before.length ? before[before.length - 1].close : null;
}

/**
 * Makes sure the history ends with the latest quote. Yahoo's daily bar for today can have an
 * empty close after hours, which would leave the chart a day behind the headline numbers.
 * The quote fills that day only when history has no real close for it; older quotes and bad
 * prices are ignored. Returns a new array.
 */
export function withLatestQuote(history: PricePoint[], quoteDate: string, price: number): PricePoint[] {
  if (!isPositive(price)) return history;
  const newest = validSorted(history).at(-1);
  if (newest && newest.date >= quoteDate) return history; // already has a real close for that day or later
  return [...history.filter((p) => p.date !== quoteDate), { date: quoteDate, close: price }];
}

export type SpreadPoint = { date: string; close: number; spreadPct: number };

/** Daily spread % ((O − close) / close) from the announcement date onward, sorted by date. */
export function spreadHistory(history: PricePoint[], offer: number, announceDate: string): SpreadPoint[] {
  if (!isPositive(offer)) return [];
  return validSorted(history)
    .filter((p) => p.date >= announceDate)
    .map((p) => ({ date: p.date, close: p.close, spreadPct: (offer - p.close) / p.close }));
}

export type DealMetrics = {
  daysToClose: number | null;
  spreadDollars: number | null;
  spreadPct: number | null;
  annualized: number | null;
  downside: number | null; // (B − P) / P
  downsideDollars: number | null; // B − P per share
  breakEven: number | null;
};

/** All dashboard metrics for one deal. Missing inputs produce null metrics. */
export function computeMetrics(input: {
  price: number | null;
  offer: number;
  breakPrice: number | null;
  expectedCloseDate: string;
  today: string;
}): DealMetrics {
  const { price, offer, breakPrice, expectedCloseDate, today } = input;
  const daysToClose = daysBetween(today, expectedCloseDate);
  const s = price === null ? null : spread(price, offer);
  const hasBreak = price !== null && breakPrice !== null;
  const down = hasBreak ? downside(price, breakPrice) : null;

  return {
    daysToClose,
    spreadDollars: s?.dollars ?? null,
    spreadPct: s?.pct ?? null,
    annualized: price === null || daysToClose === null ? null : annualizedReturn(price, offer, daysToClose),
    downside: down,
    downsideDollars: down !== null && hasBreak ? breakPrice - price : null,
    breakEven: hasBreak ? breakEvenProbability(price, offer, breakPrice) : null,
  };
}

export type IndicativeMetrics = {
  daysToClose: number | null;
  spreadDollars: number | null;
  spreadPct: number | null;
  annualized: number | null;
};

/**
 * Metrics for a rumoured deal, from a price reported in the press (not agreed terms), so they are
 * indicative only. No reported price → all null. Annualized only when the report gives a closing
 * timeframe; it's never assumed. No downside or break-even: a rumour has no agreed terms.
 */
export function indicativeMetrics(input: {
  price: number | null;
  reportedPrice?: number;
  reportedCloseDate?: string;
  today: string;
}): IndicativeMetrics {
  const { price, reportedPrice, reportedCloseDate, today } = input;
  const daysToClose = reportedCloseDate ? daysBetween(today, reportedCloseDate) : null;
  if (price === null || reportedPrice === undefined) {
    return { daysToClose, spreadDollars: null, spreadPct: null, annualized: null };
  }
  const s = spread(price, reportedPrice);
  return {
    daysToClose,
    spreadDollars: s?.dollars ?? null,
    spreadPct: s?.pct ?? null,
    annualized: daysToClose === null ? null : annualizedReturn(price, reportedPrice, daysToClose),
  };
}
