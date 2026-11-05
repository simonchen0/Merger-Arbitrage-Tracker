# Merger Arbitrage Tracker

A dashboard for tracking announced **all-cash** M&A deals from an event-driven/merger-arb perspective: spread, annualized return, downside if the deal breaks, break-even probability, and spread history. It also tracks **rumoured** deals (reported by WSJ, Bloomberg, Reuters and similar, not announced) in a separate section. It is a resume/interview project, so a polished, working, correct app matters more than feature count.

@AGENTS.md

## Stack
- Next.js 16 (App Router) + TypeScript + Tailwind v4. Read `node_modules/next/dist/docs/` before using unfamiliar Next APIs, since this version differs from older ones.
- `yahoo-finance2` v4 for prices (free, unofficial). Use the v4 style `new YahooFinance()`, and only call it on the server (API routes).
- Recharts for the spread chart.
- Vitest for tests.
- Deals persist in `localStorage`, seeded from `data/seed-deals.json`. Rumours persist under their own key with no seed. No database, no auth.
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
lib/rumours.ts             Rumours store (merger-arb-rumours-v1, no seed): useRumours(), saveRumour(), deleteRumour(); syncs across tabs
lib/sources.ts             publisherFor(url): known outlets get a short name, other news sites their own domain, social media/forums are rejected; isKnownPublisher()
lib/dealRow.ts             buildRow(): deal + market data → price, break price, metrics (table + detail); buildRumourRow(); summarize() headline numbers (announced deals only)
lib/format.ts              Display formatting (usd, pct, sign colors, as-of time)
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
- Rumoured deals: never fabricate or assume terms. Each one needs a link to a report on a news site (`lib/sources.ts`): any news site is accepted (owner's choice, not just WSJ/Bloomberg/Reuters), social media and forums are rejected, and the publisher label is always derived from the link, never typed. Anything the report doesn't state shows "Not disclosed". Numbers from reported terms are amber with an **INDICATIVE** tag, and the section carries an **UNCONFIRMED** tag. Rumours stay out of the summary strip. There are no seeded rumours: don't add any unless the owner supplies verified ones.
- Rumours are added by hand. Automated discovery was investigated and dropped: Yahoo's news search links only to Yahoo-hosted copies (never the original reuters.com/bloomberg.com/wsj.com article), and the outlets themselves have no free API (see README).

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

## Status (update at the end of each phase)
- v1 (11 phases) is done and live at https://merger-arbitrage-tracker.vercel.app (Vercel, auto-deploys on push to `main`). Post-review fixes and tests (84) are done; MISTRAS was dropped from the seed deals.
- UI redesign v2 is in progress (plan in `~/.claude/plans/`): violet accent, Magic Eden-inspired. R0 (tokens, header, bottom status bar, shared helpers) and R1 (summary strip) R2 (table with monogram tiles, bars, icon actions; card list below 1280px, two columns on tablets) and R3 (detail page: risk/reward ladder, if-it-closes / if-it-breaks cards, break-price slider, terms card) and R4 (area chart with gradient wash, restyled add/edit dialog, shared EmptyState for no-deals / deal-not-found / 404 / error, dashboard loading skeleton) are built; the search box and the All/Real/Demo tabs were removed at the owner's request, so don't re-add them. Demo deals were removed entirely (real deals only); next R5 (QA, README screenshots, docs) (detail page: payoff ladder, slider), R4 (chart, forms), R5 (QA, docs, screenshots).
- R4 is committed and pushed. R5 (QA and docs) is done: layout checked at 1440/1024/768/390px with no horizontal overflow, keyboard focus ring and reduced-motion verified, README screenshots retaken (dev badge and fixed bar hidden), README text updated. The redesign is complete.
- Rumoured deals (plan in `~/.claude/plans/`): phase 1 (model, allowlist, indicative metrics, store, validation) and phase 2 (dashboard section, add/edit form, badges) are pushed. Phase 3 (assisted news lookup) was dropped after a spike showed Yahoo links are all Yahoo-hosted; manual entry only, at the owner's choice. Phase 4 (docs, QA) is in progress.
- Text trim (owner's request): removed the ticker monogram tiles (PT, VR), the detail page's "The trade in one paragraph" section, the summary strip subtitles, per-row "as of" times (shown once in the header when shared), and the rumours intro paragraph. Don't re-add them.
- Fixed: Yahoo returns an empty close for today's daily bar after hours, so the detail page appends the latest quote (`withLatestQuote` in `lib/calc.ts`) and the chart ends on the same day as the headline numbers.
