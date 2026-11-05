// Picks possible rumoured-deal headlines out of a news feed. Pure functions, no I/O.
//
// A headline is only a *candidate*: it tells us a ticker, a link and a date, never the terms.
// Deliberately conservative: a headline names the target and the acquirer alike, so anything
// with more than one ticker is skipped rather than guessed at. See the plan in the README.
import { todayInNewYork } from "./calc";
import { publisherFor } from "./sources";

/** The parts of a Yahoo news item we use. */
export type NewsItem = {
  title: string;
  publisher: string;
  link: string;
  providerPublishTime: Date | number | string;
  relatedTickers?: string[];
};

export type Candidate = {
  ticker: string;
  headline: string;
  publisher: string;
  link: string;
  date: string; // YYYY-MM-DD (New York), when the headline was published
};

/** Headline wording that reports talks, an approach or a sale process that is still open. */
const RUMOUR_WORDS =
  /\b(in talks|takeover (talks|bid|offer|interest|approach)|(explores?|exploring|weighs?|weighing|considers?|considering) (a )?sale|nears deal|buyout (offer|talks|interest|bid)|take[- ]private|go(ing)? private)\b/i;

/** A deal that is finished, dead or declined: not an open rumour. */
const FINISHED_WORDS =
  /\b(agrees?|agreed|completes?|completed|announces?|announced|signs?|signed|definitive|denies|denied|rejects?|rejected|rejecting|rebuffed|rebuffs?|spurns?|turns? down|ends?|ended|terminates?|terminated|abandons?|collapses?|collapsed|walks? away|halts?|halted|withdraws?)\b/i;

/** Not a takeover of a company: asset or unit sales, employee buyouts, tender-offer paperwork, roundups. */
const NOT_A_TAKEOVER =
  /\b(sale of|employees?|workers?|staff|voluntary|tender offer|acceptance|clearance|closing|roundup|and more|stocks? to watch|market chatter|what to know)\b|top (money|stories|news)/i;

/** True if the headline reads like an open takeover rumour. */
export function isRumourHeadline(title: string): boolean {
  return RUMOUR_WORDS.test(title) && !FINISHED_WORDS.test(title) && !NOT_A_TAKEOVER.test(title);
}

/**
 * The one ticker a headline is about, or null. Futures, indices, crypto and private-company
 * symbols are ignored; if two or more tickers remain we can't tell target from acquirer, so null.
 */
export function targetTicker(related: string[] | undefined): string | null {
  const symbols = [
    ...new Set(
      (related ?? [])
        .map((s) => s.trim().toUpperCase())
        .filter((s) => s && !s.startsWith("^") && !s.includes("=") && !s.endsWith(".PVT") && !s.includes("-USD")),
    ),
  ];
  return symbols.length === 1 ? symbols[0] : null;
}

function toDate(t: Date | number | string): Date {
  // Epoch seconds as well as milliseconds, in case a feed sends either.
  return typeof t === "number" && t < 1e12 ? new Date(t * 1000) : new Date(t);
}

/**
 * Candidates from a list of news items: open-rumour headlines from the last `maxAgeDays` days that
 * name exactly one ticker, on a news site, for a ticker not in `excludeTickers`. One per ticker
 * (the earliest report), newest first.
 */
export function pickCandidates(
  news: NewsItem[],
  opts: { now: Date; excludeTickers?: Iterable<string>; maxAgeDays?: number },
): Candidate[] {
  const maxAge = (opts.maxAgeDays ?? 21) * 86_400_000;
  const exclude = new Set([...(opts.excludeTickers ?? [])].map((s) => s.toUpperCase()));
  const earliest = new Map<string, { at: number; c: Candidate }>();

  for (const n of news) {
    const published = toDate(n.providerPublishTime);
    const at = published.getTime();
    if (Number.isNaN(at) || opts.now.getTime() - at > maxAge || at > opts.now.getTime() + 86_400_000) continue;
    if (!isRumourHeadline(n.title)) continue;
    const ticker = targetTicker(n.relatedTickers);
    if (!ticker || exclude.has(ticker) || publisherFor(n.link) === null) continue;

    const prev = earliest.get(ticker);
    if (!prev || at < prev.at) {
      earliest.set(ticker, {
        at,
        c: { ticker, headline: n.title.trim(), publisher: n.publisher, link: n.link, date: todayInNewYork(published) },
      });
    }
  }
  return [...earliest.values()].sort((a, b) => b.at - a.at).map((e) => e.c);
}
