// GET /api/rumours/scan
// → { candidates: [{ ticker, name, headline, publisher, link, date }] }
// Possible rumoured deals from Yahoo's news search: open takeover-talk headlines about one
// USD-listed company (see lib/rumourScan.ts). Headlines only, so no deal terms. The caller drops
// tickers it already tracks. Cached briefly on the server so many visitors share one scan.
import { cacheLife } from "next/cache";
import YahooFinance from "yahoo-finance2";
import { pickCandidates, type Candidate, type NewsItem } from "@/lib/rumourScan";

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

const QUERIES = [
  "takeover talks",
  "in talks to acquire",
  "exploring sale",
  "buyout offer",
  "takeover bid",
  "explores sale",
  "nears deal to acquire",
  "take-private talks",
];
const MAX_CANDIDATES = 30;

export type ScanCandidate = Candidate & { name: string };

async function scan(): Promise<ScanCandidate[]> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 900, expire: 3600 });

  // validateResult is off because Yahoo's news items sometimes miss fields the strict schema wants.
  const searches = await Promise.allSettled(
    QUERIES.map(
      (q) =>
        yf.search(q, { newsCount: 20, quotesCount: 0 }, { validateResult: false }) as Promise<{ news?: NewsItem[] }>,
    ),
  );
  const ok = searches.flatMap((s) => (s.status === "fulfilled" ? [s.value] : []));
  // One failed query is fine; if every query failed, Yahoo is down.
  if (ok.length === 0) throw new Error("All news searches failed");

  const byLink = new Map<string, NewsItem>();
  for (const result of ok) for (const n of result.news ?? []) byLink.set(n.link, n);

  const candidates = pickCandidates([...byLink.values()], { now: new Date() }).slice(0, MAX_CANDIDATES);
  if (candidates.length === 0) return [];

  // Keep only USD-priced equities, so a later spread against a reported price makes sense, and
  // take the company name from the quote rather than the headline.
  const quotes = await yf.quote(candidates.map((c) => c.ticker));
  const equities = new Map(
    quotes
      .filter((q) => q.quoteType === "EQUITY" && q.currency === "USD")
      .map((q) => [q.symbol, q.longName ?? q.shortName ?? q.symbol] as const),
  );
  return candidates.filter((c) => equities.has(c.ticker)).map((c) => ({ ...c, name: equities.get(c.ticker)! }));
}

export async function GET() {
  try {
    return Response.json({ candidates: await scan() });
  } catch (err) {
    console.error("Rumour scan failed:", err);
    return Response.json({ error: "News search unavailable" }, { status: 502 });
  }
}
