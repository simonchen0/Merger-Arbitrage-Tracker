# Merger Arbitrage Tracker

A dashboard for tracking announced **all-cash** M&A deals from an event-driven/merger-arb perspective: spread, annualized return, downside if the deal breaks, break-even probability, and spread history. It is a resume/interview project, so a polished, working, correct app matters more than feature count.

@AGENTS.md

## Stack
- Next.js 16 (App Router) + TypeScript + Tailwind v4. Read `node_modules/next/dist/docs/` before using unfamiliar Next APIs, since this version differs from older ones.
- `yahoo-finance2` v4 for prices (free, unofficial). Use the v4 style `new YahooFinance()`, and only call it on the server (API routes).
- Recharts for the spread chart.
- Vitest for tests.
- Deals persist in `localStorage`, seeded from `data/seed-deals.json`. No database, no auth.
- Deploy on Vercel.

## Architecture
```
app/page.tsx               Dashboard (sortable/filterable deal table)
app/deals/[id]/page.tsx    Deal detail (metrics, editable break price, spread chart)
app/not-found.tsx, error.tsx   Themed 404 and error pages (the Next defaults are white)
app/api/quotes/route.ts    Latest prices for a list of tickers
app/api/history/route.ts   Daily closes for one ticker
lib/types.ts               Deal type
lib/validate.ts            Add/edit form validation (pure) + validate.test.ts
lib/calc.ts                ALL financial math (pure functions) + calc.test.ts
lib/deals.ts               localStorage store (v2 key, seedVersion): useDeals() hook, setDeals(), resetDeals(); syncs across tabs; refreshes demo deals nearing close
lib/demo.ts                Demo deals (dates relative to when generated) + deterministic fake prices
lib/dealRow.ts             buildRow(): deal + market data → price, break price, metrics (table + detail)
lib/format.ts              Display formatting (usd, pct, sign colors, as-of time)
lib/useMarketData.ts       Client hook: live quotes + unaffected prices for real deals, refresh()
components/                DealTable, DealDetail, DealForm, SpreadChart, Badge, StatusBar (bottom bar), ui.tsx (cardClass/buttonClass helpers, logo)
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

Rules:
- Every formula lives in `lib/calc.ts` as a pure function. Components never do financial math inline.
- Every calc change needs a test with hand-checked numbers. Reference case: P=48, O=50, B=40, d=120 → 4.17%, 12.67% annualized, −16.67% downside, 80% break-even.
- Handle edge cases explicitly: d ≤ 0 → annualized "—"; negative spread is valid; B ≥ P or P > O → break-even "n/a"; a missing price → "unavailable". Never show NaN or Infinity.
- Treat dates as `YYYY-MM-DD` UTC calendar dates to avoid off-by-one day counts.
- Store percentages as decimals (0.0417) and format only at display time.

## Data labeling (required)
- Demo deals: **DEMO** badge, fake names/tickers, generated prices, never call Yahoo.
- Estimates (default break price and anything derived from it): **EST** tag in amber (`text-est`).
- Market prices show an "as of" timestamp. Deal terms are entered manually from a press release or 8-K, with a source link.

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
- v1 (11 phases) is done and live at https://merger-arbitrage-tracker.vercel.app (Vercel, auto-deploys on push to `main`). Post-review fixes and tests (67) are done; MISTRAS was dropped from the seed deals.
- UI redesign v2 is in progress (plan in `~/.claude/plans/`): violet accent, Magic Eden-inspired. R0 (tokens, header, bottom status bar, shared helpers) is built; next R1 (summary strip, pill tabs, search), R2 (table, phone cards), R3 (detail page: payoff ladder, slider), R4 (chart, forms), R5 (QA, docs, screenshots).
- Fixed: Yahoo returns an empty close for today's daily bar after hours, so the detail page appends the latest quote (`withLatestQuote` in `lib/calc.ts`) and the chart ends on the same day as the headline numbers.
