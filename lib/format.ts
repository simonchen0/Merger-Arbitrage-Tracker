// Display formatting only. Values come in as numbers/decimals from lib/calc.ts.
const MINUS = "−";

export function usd(x: number | null | undefined, empty = "—"): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return empty;
  const s = Math.abs(x).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${x < 0 ? MINUS : ""}$${s}`;
}

/** 0.0417 → "4.17%". */
export function pct(x: number | null | undefined, empty = "—", digits = 2): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return empty;
  const s = Math.abs(x * 100).toFixed(digits);
  return `${x < 0 && Number(s) !== 0 ? MINUS : ""}${s}%`;
}

/** Tailwind text color for a signed value. */
export function signClass(x: number | null | undefined): string {
  if (x === null || x === undefined || x === 0) return "text-text";
  return x > 0 ? "text-up" : "text-down";
}
