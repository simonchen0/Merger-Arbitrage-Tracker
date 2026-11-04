export type Deal = {
  id: string;
  isDemo: boolean;
  targetName: string;
  targetTicker: string;
  acquirerName: string;
  offerPrice: number; // cash per share, from the press release / 8-K
  announceDate: string; // YYYY-MM-DD
  expectedCloseDate: string; // YYYY-MM-DD
  breakPrice?: number; // user override; otherwise the unaffected price is used (estimate)
  sourceUrl?: string;
};

/** Latest market price from /api/quotes. */
export type Quote = { symbol: string; name: string | null; price: number; asOf: string };
