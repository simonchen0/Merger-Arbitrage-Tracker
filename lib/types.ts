export type Deal = {
  id: string;
  targetName: string;
  targetTicker: string;
  acquirerName: string;
  offerPrice: number; // cash per share, from the press release / 8-K
  announceDate: string; // YYYY-MM-DD
  expectedCloseDate: string; // YYYY-MM-DD
  unaffectedDate?: string; // YYYY-MM-DD: last day before deal rumors, if news leaked pre-announcement
  breakPrice?: number; // user override; otherwise the unaffected price is used (estimate)
  sourceUrl?: string;
};

/**
 * A deal reported by the press but not announced. Everything except the target and the source is
 * optional, because a report often leaves terms out: missing fields display as "Not disclosed".
 * The publisher isn't stored; it's derived from sourceUrl (lib/sources.ts).
 */
export type Rumour = {
  id: string;
  targetTicker: string;
  targetName: string;
  acquirerName?: string; // potential acquirer, if the report names one
  sourceUrl: string; // link to the report, on a news site (not social media); see lib/sources.ts
  reportDate: string; // YYYY-MM-DD, when the report was published
  reportedPrice?: number; // cash per share, only if the report states one
  reportedCloseDate?: string; // YYYY-MM-DD, only if the report gives a timeframe (end of window)
};

/** Latest market price from /api/quotes. */
export type Quote = { symbol: string; name: string | null; price: number; asOf: string };
