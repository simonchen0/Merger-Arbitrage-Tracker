// GET /api/quotes?symbols=AAPL,MSFT
// → { quotes: [{ symbol, name, price, asOf }], missing: ["BADTICKER"] }
// Prices are Yahoo's regular-market price (delayed ~15 min), cached briefly on the server.
import { cacheLife } from "next/cache";
import YahooFinance from "yahoo-finance2";

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

const SYMBOL_RE = /^[A-Z0-9.\-^=]{1,15}$/;
const MAX_SYMBOLS = 50;

export type Quote = { symbol: string; name: string | null; price: number; asOf: string };

async function fetchQuotes(symbols: string[]): Promise<Quote[]> {
  "use cache";
  cacheLife({ stale: 60, revalidate: 120, expire: 600 });

  const results = await yf.quote(symbols);
  return results
    .filter((q) => typeof q.regularMarketPrice === "number" && q.regularMarketTime)
    .map((q) => ({
      symbol: q.symbol,
      name: q.longName ?? q.shortName ?? null,
      price: q.regularMarketPrice!,
      asOf: q.regularMarketTime!.toISOString(),
    }));
}

export async function GET(request: Request) {
  const param = new URL(request.url).searchParams.get("symbols") ?? "";
  // Sorted and de-duplicated so the same set of tickers shares one cache entry.
  const symbols = [...new Set(param.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean))].sort();

  if (symbols.length === 0) {
    return Response.json({ error: "Provide ?symbols=AAA,BBB" }, { status: 400 });
  }
  if (symbols.length > MAX_SYMBOLS) {
    return Response.json({ error: `At most ${MAX_SYMBOLS} symbols per request` }, { status: 400 });
  }
  const invalid = symbols.filter((s) => !SYMBOL_RE.test(s));
  if (invalid.length) {
    return Response.json({ error: `Invalid symbol: ${invalid.join(", ")}` }, { status: 400 });
  }

  try {
    const quotes = await fetchQuotes(symbols);
    const found = new Set(quotes.map((q) => q.symbol));
    return Response.json({ quotes, missing: symbols.filter((s) => !found.has(s)) });
  } catch (err) {
    console.error("Quote fetch failed:", err);
    return Response.json({ error: "Price data unavailable" }, { status: 502 });
  }
}
