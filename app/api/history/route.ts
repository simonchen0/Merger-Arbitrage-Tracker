// GET /api/history?symbol=AAPL&from=2026-01-15
// → { symbol, history: [{ date: "YYYY-MM-DD", close }] }  (daily closes, oldest first)
import { cacheLife } from "next/cache";
import YahooFinance from "yahoo-finance2";
import { daysBetween, todayInNewYork, type PricePoint } from "@/lib/calc";

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

const SYMBOL_RE = /^[A-Z0-9.\-^=]{1,15}$/;
const MAX_HISTORY_DAYS = 5 * 366;

async function fetchHistory(symbol: string, from: string): Promise<PricePoint[] | null> {
  "use cache";
  cacheLife({ stale: 3600, revalidate: 43200, expire: 86400 });

  try {
    const chart = await yf.chart(symbol, { period1: from, interval: "1d" });
    return chart.quotes.map((bar) => ({
      // Bars are timestamped at the market open; convert to the New York trading date.
      date: todayInNewYork(bar.date),
      // Yahoo returns float noise (343.9100036621094); 4 decimals is plenty.
      close: typeof bar.close === "number" ? Math.round(bar.close * 1e4) / 1e4 : null,
    }));
  } catch (err) {
    // Yahoo throws "No data found" for unknown or delisted symbols.
    if (err instanceof Error && /no data found/i.test(err.message)) return null;
    throw err;
  }
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const symbol = (params.get("symbol") ?? "").trim().toUpperCase();
  const from = params.get("from") ?? "";

  if (!SYMBOL_RE.test(symbol)) {
    return Response.json({ error: "Provide a valid ?symbol=" }, { status: 400 });
  }
  const today = todayInNewYork();
  const age = daysBetween(from, today); // days from `from` to today
  if (age === null) {
    return Response.json({ error: "Provide ?from=YYYY-MM-DD" }, { status: 400 });
  }
  // Bound the range: deals are recent, and an open-ended `from` makes this an open Yahoo proxy.
  if (age < 0) {
    return Response.json({ error: "?from can't be in the future" }, { status: 400 });
  }
  if (age > MAX_HISTORY_DAYS) {
    return Response.json({ error: "?from can be at most 5 years back" }, { status: 400 });
  }

  try {
    const history = await fetchHistory(symbol, from);
    if (history === null) {
      return Response.json({ error: `No price history for ${symbol}` }, { status: 404 });
    }
    return Response.json({ symbol, history });
  } catch (err) {
    console.error("History fetch failed:", err);
    return Response.json({ error: "Price data unavailable" }, { status: 502 });
  }
}
