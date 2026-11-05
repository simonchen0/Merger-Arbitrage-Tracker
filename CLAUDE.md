# Merger Arbitrage Tracker

A dashboard for tracking announced **all-cash** M&A deals from an event-driven/merger-arb perspective: spread, annualized return, downside if the deal breaks, break-even probability, and spread history. It also tracks **rumoured** deals (reported by WSJ, Bloomberg, Reuters and similar, not announced) in a separate section. It is a resume/interview project, so a polished, working, correct app matters more than feature count.

@AGENTS.md

## Stack
- Next.js 16 (App Router) + TypeScript + Tailwind v4. Read `node_modules/next/dist/docs/` before using unfamiliar Next APIs, since this version differs from older ones.
- `yahoo-finance2` v4 for prices (free, unofficial). Use the v4 style `new YahooFinance()`, and only call it on the server (API routes).
- Recharts for the spread chart.
- Vitest for tests.
- Deals persist in `localStorage`, seeded from `data/seed-deals.json`. Rumours: the visitor's own (and auto-found) ones persist under their own key; shared ones ship in `data/seed-rumours.json`. No database, no auth.
- Deploy on Vercel.

## Architecture
```
app/page.tsx               Dashboard (sortable deal table, then the rumoured-deals section)
app/deals/[id]/page.tsx    Deal detail (metrics, editable break price, spread chart)
app/not-found.tsx, error.tsx   Themed 404 and error pages (the Next defaults are white)
app/api/quotes/route.ts    Latest prices for a list of tickers
app/api/history/route.ts   Daily closes for one ticker
lib/types.ts               Deal and Rumour types
lib/validate.ts            Add/edit form validation (pure): validateDeal, validateRumour + validate.test.ts
lib/calc.ts                ALL financial math (pure functions, plus median, withLatestQuote, breakPriceRange, indicativeMetrics for rumours) + calc.test.ts
lib/deals.ts               localStorage store (v2 key, seedVersion): useDeals() hook, setDeals(), resetDeals(); syncs across tabs; seed version updates and removed-deal list
lib/rumours.ts             Rumours store (merger-arb-rumours-v1): useRumours() (shared + own), saveRumour(), deleteRumour(), mergeShared(), isSharedTicker(); drops legacy auto-found rows; syncs across tabs
data/seed-rumours.json     Shared rumours added by Claude after reading sources (read-only for visitors; see "Finding rumours" below)
lib/sources.ts             publisherFor(url): known outlets get a short name, other news sites their own domain, social media/forums are rejected; isKnownPublisher()
lib/dealRow.ts             buildRow(): deal + market data → price, break price, metrics (table + detail); buildRumourRow(); summarize() headline numbers (announced deals only)
lib/format.ts              Display formatting (usd, pct, sign colors, as-of time)
lib/closedDeals.ts         findClosed(): a deal is closed only if its ticker is missing from quotes AND /api/history has no data (outage guard: all of 3+ missing → none) + tests
lib/useClosedDeals.ts      Client hook: after a good price refresh, removes closed deals via deleteDeal() and shows a dismissible notice
lib/useMarketData.ts       Client hook: live quotes (deals + extra tickers such as rumours) and unaffected prices for deals, refresh()
components/                DealTable (table at 1280px+, cards below), DealDetail, PayoffLadder (break → price → offer bar), DealForm, RumourTable, RumourForm, SpreadChart, SummaryStrip, Badge (EST / INDICATIVE / UNCONFIRMED), StatusBar (bottom bar), ui.tsx (cardClass/buttonClass helpers, Segmented pill tabs)
data/seed-deals.json       Real deals seeded on first visit. When you change this file, bump SEED_VERSION in lib/deals.ts so returning visitors get the changes (user-added deals are kept). When you delete a seed deal, also add its id to REMOVED_SEED_IDS there. Terms come from SEC 8-K exhibits; expected close = end of the company-guided window.
scripts/check-data.ts      Manual Yahoo data check
vitest.config.mts          Test config (adds the `@/` alias); tests sit next to the code as *.test.ts
```

## Financial calculations
P = current price, O = cash offer, B = break price, d = calendar days to expected close.
- Spread = O − P and (O − P) / P
- Annualized return = (O − P) / P × 365 / d (simple, calendar days)
- Downside = (B − P) / P
- Break-even probability = (P − B) / (O − B)
- Default break price = the unaffected price (close on the last trading day before announcement). If news leaked first, the deal's optional `unaffectedDate` (the last day before rumors, per the company's filing) is used instead.
- Rumoured deals (`indicativeMetrics`): spread uses the reported per-share price as O, only if the report states one. Annualized only if the report gives a timeframe (never assumed). No downside or break-even, because there are no agreed terms.

Rules:
- Every formula lives in `lib/calc.ts` as a pure function. Components never do financial math inline.
- Every calc change needs a test with hand-checked numbers. Reference case: P=48, O=50, B=40, d=120 → 4.17%, 12.67% annualized, −16.67% downside, 80% break-even.
- Handle edge cases explicitly: d ≤ 0 → annualized "—"; negative spread is valid; B ≥ P or P > O → break-even "n/a"; a missing price → "unavailable". Never show NaN or Infinity.
- Treat dates as `YYYY-MM-DD` UTC calendar dates to avoid off-by-one day counts.
- Store percentages as decimals (0.0417) and format only at display time.

## Data labeling (required)
- The tracker shows real deals only: there are no demo or fictional deals (they were removed at the owner's request; don't re-add them).
- Estimates (default break price and anything derived from it): **EST** tag in amber (`text-est`).
- Market prices show an "as of" timestamp. Deal terms are entered manually from a press release or 8-K, with a source link.
- Rumoured deals: never fabricate or assume terms. Each one needs a link to a report on a news site (`lib/sources.ts`): any news site is accepted (owner's choice), social media and forums are rejected, and the publisher label is always derived from the link, never typed. Anything the report doesn't state shows "Not disclosed". Numbers from reported terms are amber with an **INDICATIVE** tag, and the section carries an **UNCONFIRMED** tag. Rumours stay out of the summary strip.
- **Rumours are added only on purpose, never automatically** (owner's request): no scan, no auto-add, no "Scan for rumours" button, no AUTO-FOUND rows. They come from the add form or from Claude when the owner says to find them (shared file). An automatic headline scan was built, then removed; don't rebuild it. Legacy auto-found rows saved in old browsers are dropped on load.
- Finding rumours on request ("find new rumours"): search any source (web search, press digests, filings). For each candidate: (1) confirm it hasn't become an announced deal and isn't already in `data/seed-deals.json`; (2) read the article or a filing; if it's paywalled or blocked, don't use it as the basis for terms and don't try to get around the block; (3) add to `data/seed-rumours.json` with id `shared-TICKER`, the *original* report date, and a link to the best source; (4) fill acquirer, per-share price and closing date only if the text states them (a range or a total dollar value is not a per-share price: leave blank); (5) check the ticker is a USD equity (`/api/quotes`); (6) skip anything older than about 30 days, rejected, or dead; (7) run `npm test` (it validates this file). Say plainly which sources couldn't be read. Don't commit until the owner says so.

## Updating the deals (adding new, removing closed)
Closed deals are removed **automatically in the app** (`lib/closedDeals.ts`, see above). New deals are added by **a person-reviewed update to `data/seed-deals.json`**: either "update the deals" in a session, or the weekly scheduled routine, which opens a pull request and never pushes to `main`. A pattern matcher must not add deals: filings name buyers and targets alike, and these numbers drive every figure.
For each candidate:
1. **Find:** SEC full-text search of 8-Ks from the last 14 days (`https://efts.sec.gov/LATEST/search-index?q="per share in cash"&forms=8-K&dateRange=custom&startdt=…&enddt=…`, use `curl` with a generic User-Agent such as `merger-arb-tracker-research`, never an email address), plus news search. The search returns ~50 filings per fortnight and most are not take-outs (earnings, buyers, funds), so every candidate must be read. Hits list each exhibit by `_id` (`adsh:filename`); build the URL as `https://www.sec.gov/Archives/edgar/data/<cik>/<adsh-no-dashes>/<filename>`.
2. **Read** the actual press release (EX-99.1) and 8-K on sec.gov. `curl` is blocked on `sec.gov/Archives` ("Undeclared Automated Tool", an identical ~4,000-character page): read those pages through the web-fetch tool/agent instead, a batch of ~10 URLs per agent, asking only for verbatim facts. If a page can't be read (paywall, 403), don't take terms from it, and say so. Don't work around a block. The 8-K body often lacks the closing window; look for the EX-99.1 or EX-99.2 press release before skipping.
3. **Qualify, all must hold:** the target is a US-listed, USD-priced stock; a **definitive** agreement is signed (not a proposal or talks); consideration is **all cash** (no stock, election or CVR); a per-share price is stated; the filing states an expected closing window.
4. **Fill in:** `offerPrice` as stated; `announceDate`; `expectedCloseDate` = end of the company-guided window; `unaffectedDate` only if the filing says news leaked earlier; `sourceUrl` = the filing. Every field must trace to a sentence in the source.
5. **Skip and list with the reason:** stock, mixed or CVR deals, proposals only, no closing window, foreign listings, asset purchases, deals already completed, the filer being the acquirer, anything unreadable, **and amended or re-priced deals or ones with only a VWAP premium and no undisturbed price** (the default break price would be misleading; the owner already dropped MISTRAS for this). A fiscal-year closing window ("fiscal year 2028") needs the company's year-end: use it only if certain, and flag it as derived.
5b. **Check against the price history** (`/api/history`) before adding: the jump to the offer should fall on the announcement date, and the stated premium should equal offer ÷ the close on the stated "unaffected" date. If the jump comes a day after the release (released after the close), set `unaffectedDate` to the date the filing names. Check `/api/quotes` has the ticker.
6. **Remove closed deals from the file:** delete from `seed-deals.json` and add the id to `REMOVED_SEED_IDS` in `lib/deals.ts` (closing confirmed by Yahoo delisting and the Item 2.01 8-K).
7. Bump `SEED_VERSION` and `DEALS_AS_OF` (both in `lib/deals.ts`; `DEALS_AS_OF` is the date shown as "Deal terms as of …" in the status bar), then run `npm test` (validates the seed file), `npm run lint` and `npm run build`.
In a pull request, include a table of added deals (price, close, unaffected date, source links), the deals removed, and the skipped candidates with reasons. Don't commit to `main` unless the owner says so.

## Conventions
- Keep it simple: no new dependencies, abstractions, state libraries, or features beyond the plan without asking first. Deferred: dividends, offer bumps, import/export, closed-deal case studies.
- Small, focused components. Plain `fetch` and `useState`/`useEffect`; no data-fetching libraries.
- Styling: use the theme tokens in `app/globals.css` (`bg`, `panel`, `panel-2`, `border`, `text`, `muted`, `accent`, `accent-strong`, `up`, `down`, `est`) and the `.num` class for numbers. Dark indigo theme with a violet accent; `up`/`down`/`est` keep their meaning (gain/loss/estimate) and the accent never replaces them. Buttons use `buttonClass()` and cards use `rounded-2xl` / `cardClass()` from `components/ui.tsx`. Keep text contrast at 4.5:1 or better.
- API routes return clean JSON errors; the UI degrades gracefully when Yahoo fails.

## Workflow
- Build incrementally, one phase at a time (see plan). Finish and verify each phase before starting the next.
- Only change files related to the current task. No drive-by refactors or reformatting.
- Test every change before calling it done:
  - `npm test` (Vitest): calculations, form validation, the saved-deals store, seed data
  - `npm run lint` and `npm run build` must be clean
  - `npm run dev` and check the affected page or route in the browser (or with `curl` for API routes)
- Don't commit unless asked.

## Status
Finished and live at https://merger-arbitrage-tracker.vercel.app (Vercel, auto-deploys on push to `main`). The owner has stopped adding features: only fixes and polish from here. 148 tests; lint and build clean.

**Built:** dashboard with summary strip and sortable table (cards below 1280px); deal detail with risk/reward ladder, if-it-closes / if-it-breaks cards, spread chart, and an editable break-price scenario; add/edit/delete deals; 12 real all-cash deals in `data/seed-deals.json` (SEED_VERSION 4, `DEALS_AS_OF` 2026-11-05); automatic removal of closed deals; a rumoured-deals section (own rows via the form, shared rows in `data/seed-rumours.json` that expire after 60 days); themed 404/error pages; README with screenshots.

**Deliberately removed, do not re-add:** search box, All/Real/Demo tabs and demo deals, ticker monogram tiles, the "trade in one paragraph" section, per-row "as of" times (shown once in the header), and the automatic rumour scan (rumours are added only when the owner asks). Deferred and still not built: dividends, offer bumps, import/export, closed-deal case studies.

**Maintenance:** a weekly cloud routine ("Merger Arb Tracker: weekly deal update", id `trig_01PNbbrfbqk9HLFDjCahzrgN`, manage at https://claude.ai/code/routines) runs every Tuesday at 14:00 UTC (6am Vancouver in winter). It follows the "Updating the deals" procedure above and opens a pull request for the owner to review; it never pushes to `main`, never touches rumours, and opens no PR when nothing qualifies. It checks out `main`, so procedure changes only take effect once pushed. Created 2026-11-05; its first run is 2026-11-10 and has not been reviewed yet. Rumours stay manual: the owner says "find new rumours".

**Known gaps:** dividends are not modelled (Penske trades above its offer for that reason); a deal's closing window is the end of the company-guided window, and Braze's is derived from Salesforce's fiscal year; SEC blocks plain `curl` on `sec.gov/Archives`; the Yahoo data is unofficial and can change.

**Fixed along the way:** Yahoo returns an empty close for today's daily bar after hours, so the detail page appends the latest quote (`withLatestQuote` in `lib/calc.ts`); a focused number input no longer changes with the mouse wheel.
