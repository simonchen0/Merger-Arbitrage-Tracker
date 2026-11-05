"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { breakPriceRange, spreadHistory, todayInNewYork, withLatestQuote, type PricePoint } from "@/lib/calc";
import { buildRow, type DealRow } from "@/lib/dealRow";
import { deleteDeal, saveDeal, useDeals } from "@/lib/deals";
import { pct, signClass, usd } from "@/lib/format";
import type { Deal } from "@/lib/types";
import { fetchHistory, useMarketData } from "@/lib/useMarketData";
import { Badge } from "./Badge";
import { DealForm } from "./DealForm";
import { PayoffLadder } from "./PayoffLadder";
import { SpreadChart } from "./SpreadChart";
import { buttonClass, cardClass, EmptyState, PencilIcon, TrashIcon } from "./ui";

export function DealDetail({ id }: { id: string }) {
  const router = useRouter();
  const deals = useDeals();
  const deal = deals?.find((d) => d.id === id) ?? null;
  const dealList = useMemo(() => (deal ? [deal] : null), [deal]);
  const market = useMarketData(dealList);
  const [editing, setEditing] = useState(false);
  // Break price being typed or dragged (null = not editing, show the saved value).
  const [draft, setDraft] = useState<string | null>(null);

  // Daily closes since announcement.
  const historyKey = deal ? `${deal.targetTicker}|${deal.announceDate}` : null;
  const [history, setHistory] = useState<{ key: string; points: PricePoint[] | null } | null>(null);
  useEffect(() => {
    if (!historyKey) return;
    let cancelled = false;
    const [ticker, from] = historyKey.split("|");
    fetchHistory(ticker, from).then((points) => {
      if (!cancelled) setHistory({ key: historyKey, points });
    });
    return () => {
      cancelled = true;
    };
  }, [historyKey]);

  if (deals === null) return <p className="text-sm text-muted">Loading…</p>;
  if (!deal) {
    return (
      <EmptyState
        title="Deal not found"
        actions={
          <Link href="/" className={buttonClass("primary", "md")}>
            Back to deals
          </Link>
        }
      >
        This deal doesn&apos;t exist. It may have been deleted.
      </EmptyState>
    );
  }

  const today = todayInNewYork();
  const saved = buildRow(deal, today, market.quotes, market.unaffected, market.loading);

  // A valid draft overrides the break price for a live what-if; it's saved only on "Save".
  const draftValue = draft !== null && draft.trim() !== "" ? Number(draft) : null;
  const draftError =
    draftValue === null
      ? null
      : !Number.isFinite(draftValue) || draftValue <= 0
        ? "Enter a price above 0"
        : draftValue >= deal.offerPrice
          ? "Break price should be below the offer"
          : null;
  const usingDraft = draftValue !== null && draftError === null;
  const row = usingDraft
    ? buildRow({ ...deal, breakPrice: draftValue }, today, market.quotes, market.unaffected, market.loading)
    : saved;

  function saveBreak(breakPrice: number | undefined) {
    const next: Deal = { ...deal! };
    if (breakPrice === undefined) delete next.breakPrice;
    else next.breakPrice = breakPrice;
    saveDeal(next);
    setDraft(null);
  }

  function handleDelete() {
    if (confirm(`Delete ${deal!.targetTicker} (${deal!.targetName})?`)) {
      deleteDeal(deal!.id);
      router.push("/");
    }
  }

  // undefined = still loading, null = unavailable
  const loaded = history?.key === historyKey ? history.points : undefined;
  const quote = market.quotes[deal.targetTicker];
  // End the chart on the latest quote, so it matches the headline spread even when Yahoo's
  // daily bar for today has no close yet (after hours).
  const closes: PricePoint[] | null | undefined =
    loaded && quote ? withLatestQuote(loaded, todayInNewYork(new Date(quote.asOf)), quote.price) : loaded;
  const spreadPoints = closes ? spreadHistory(closes, deal.offerPrice, deal.announceDate) : [];

  const m = row.metrics;
  const est = row.breakIsEstimate;
  const pastClose = m.daysToClose !== null && m.daysToClose <= 0;
  const closeText = m.daysToClose === null ? "—" : pastClose ? "past expected close" : `${m.daysToClose} days`;

  // Slider for the break price: only when there's a price to measure against.
  const range = row.price !== null ? breakPriceRange(row.price, deal.offerPrice) : null;
  const sliderBase = (usingDraft ? draftValue : saved.breakPrice) ?? range?.min ?? 0;
  const sliderValue = range ? Math.min(range.max, Math.max(range.min, sliderBase)) : 0;

  return (
    <div className="space-y-6">
      <Link href="/" className="inline-block text-sm text-muted transition-colors hover:text-accent">
        ← All deals
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-mono text-3xl font-semibold leading-tight">{deal.targetTicker}</h1>
          <p className="text-muted">{deal.targetName}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setEditing(true)} className={buttonClass("secondary", "md")}>
            <PencilIcon className="h-4 w-4" /> Edit deal
          </button>
          <button onClick={handleDelete} className={buttonClass("danger", "md")}>
            <TrashIcon className="h-4 w-4" /> Delete
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-base text-muted">
          <span className="text-text">{deal.acquirerName}</span> acquiring for{" "}
          <span className="num text-text">{usd(deal.offerPrice)}</span> cash per share
        </span>
        <Chip>Announced {deal.announceDate}</Chip>
        <Chip tone={pastClose ? "text-down" : ""}>
          Closes {deal.expectedCloseDate} · {closeText}
        </Chip>
      </div>

      <PayoffLadder row={row} />

      {/* The two outcomes */}
      <div className="grid gap-4 md:grid-cols-2">
        <section className={cardClass("p-5")}>
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted">If it closes</h2>
          <div className={`num mt-2 text-3xl font-semibold ${signClass(m.annualized)}`}>{pct(m.annualized)}</div>
          <div className="text-sm text-muted">
            annualized return{m.daysToClose !== null && m.daysToClose > 0 ? ` over ${m.daysToClose} days` : " · past expected close"}
          </div>
          <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-border pt-4">
            <Metric label="Spread" value={pct(m.spreadPct)} valueClass={signClass(m.spreadPct)} sub={`${usd(m.spreadDollars)} per share`} />
            <Metric label="Offer" value={usd(deal.offerPrice)} sub="per share" />
          </dl>
        </section>

        <section className={cardClass("p-5")}>
          <h2 className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-muted">
            If it breaks {est && <Badge kind="est" title="Uses the estimated break price" />}
          </h2>
          <div className={`num mt-2 text-3xl font-semibold ${est ? "text-est" : signClass(m.downside)}`}>{pct(m.downside)}</div>
          <div className="text-sm text-muted">
            {usd(m.downsideDollars)} per share{row.breakPrice !== null ? `, falling to ${usd(row.breakPrice)}` : ""}
          </div>
          <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-border pt-4">
            <Metric
              label="Break-even probability"
              value={breakEvenText(row)}
              valueClass={est ? "text-est" : ""}
              sub="deal must close at least this often"
            />
            <Metric label="Price now" value={usd(row.price)} sub={row.priceNote} />
          </dl>
        </section>
      </div>

      {/* Spread history */}
      <section className={cardClass("space-y-2 p-5")}>
        <h2 className="text-base font-semibold">Spread history</h2>
        {closes === undefined ? (
          <p className="py-10 text-center text-sm text-muted">Loading price history…</p>
        ) : closes === null ? (
          <p className="py-10 text-center text-sm text-muted">Price history unavailable for {deal.targetTicker}.</p>
        ) : (
          <SpreadChart points={spreadPoints} />
        )}
      </section>

      {/* Break-price scenario and the deal's terms */}
      <div className="grid gap-4 lg:grid-cols-3">
        <section className={cardClass("flex flex-col p-5 lg:col-span-2")}>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold">Break-price scenario</h2>
            {est && <Badge kind="est" title="Estimated: unaffected close before the announcement" />}
          </div>

          {/* The controls sit centered in whatever height the neighbouring terms card gives this one. */}
          <div className="my-auto space-y-4 py-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  aria-label="Break price"
                  value={draft ?? (saved.breakPrice !== null ? saved.breakPrice.toFixed(2) : "")}
                  onChange={(e) => setDraft(e.target.value)}
                  // A focused number input changes value on the mouse wheel, which would silently
                  // change the scenario while scrolling the page. Blur it so the page scrolls instead.
                  onWheel={(e) => e.currentTarget.blur()}
                  className={`w-32 rounded-lg border bg-panel-2 py-1.5 pl-6 pr-2 text-sm outline-none transition-colors num [color-scheme:dark] focus:border-accent ${
                    draftError ? "border-down" : "border-border"
                  } ${est && draft === null ? "text-est" : ""}`}
                />
              </div>
              <button
                onClick={() => saveBreak(draftValue!)}
                disabled={!usingDraft || draftValue === deal.breakPrice}
                className={buttonClass("primary")}
              >
                Save
              </button>
              {/* Always laid out (hidden when there's nothing to reset), so it appearing never reflows the card. */}
              <button
                onClick={() => saveBreak(undefined)}
                className={`${buttonClass("secondary")} ${deal.breakPrice !== undefined || draft !== null ? "" : "invisible"}`}
              >
                Reset to unaffected{row.unaffected !== null ? ` (${usd(row.unaffected)})` : ""}
              </button>
            </div>

            <div>
              <input
                type="range"
                aria-label="Break price slider"
                min={range?.min ?? 0}
                max={range?.max ?? 1}
                step={0.01}
                value={sliderValue}
                disabled={!range}
                onChange={(e) => setDraft(Number(e.target.value).toFixed(2))}
                className="h-2 w-full cursor-pointer accent-accent disabled:cursor-not-allowed disabled:opacity-40"
              />
              {range && (
                <div className="num mt-1 flex justify-between text-sm text-muted">
                  <span>{usd(range.min)}</span>
                  <span>{usd(range.max)}</span>
                </div>
              )}
            </div>

            {/* Always rendered, so an error appearing or clearing never moves the controls. */}
            <p aria-live="polite" className="min-h-5 text-sm text-down">
              {draftError}
            </p>
          </div>
        </section>

        <section className={cardClass("p-5")}>
          <h2 className="text-base font-semibold">Deal terms</h2>
          <dl className="mt-3 space-y-3">
            <Term label="Announced" value={deal.announceDate} />
            <Term
              label="Expected close"
              value={
                <>
                  {deal.expectedCloseDate} <span className={pastClose ? "text-down" : "text-muted"}>({closeText})</span>
                </>
              }
            />
            <Term
              label="Unaffected price"
              value={
                <>
                  <span className="text-est">{usd(row.unaffected)}</span>{" "}
                  <span className="text-sm text-muted">
                    {deal.unaffectedDate
                      ? `close on ${deal.unaffectedDate}, before news leaked`
                      : "close before announcement"}
                  </span>
                </>
              }
            />
            <Term
              label="Source"
              value={
                // Only http(s) links are rendered, whatever is in storage.
                deal.sourceUrl && /^https?:\/\//i.test(deal.sourceUrl) ? (
                  <a href={deal.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                    Announcement ↗
                  </a>
                ) : (
                  <span className="text-muted">Not provided</span>
                )
              }
            />
          </dl>
        </section>
      </div>

      {editing && (
        <DealForm
          deal={deal}
          onClose={() => setEditing(false)}
          onSave={(d) => {
            saveDeal(d);
            setEditing(false);
            setDraft(null);
          }}
        />
      )}
    </div>
  );
}

function breakEvenText(row: DealRow): string {
  if (row.metrics.breakEven !== null) return pct(row.metrics.breakEven, "—", 1);
  return row.price === null || row.breakPrice === null ? "—" : "n/a";
}

function Chip({ children, tone = "" }: { children: React.ReactNode; tone?: string }) {
  return (
    <span className={`rounded-full border border-border bg-panel-2 px-3 py-1 num text-muted ${tone}`}>{children}</span>
  );
}

function Term({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="num text-base">{value}</dd>
    </div>
  );
}

function Metric({ label, value, sub, valueClass = "" }: { label: string; value: string; sub: string; valueClass?: string }) {
  return (
    <div>
      <dt className="text-sm text-muted">{label}</dt>
      <dd className={`num mt-0.5 text-xl font-semibold ${valueClass}`}>{value}</dd>
      <div className="text-sm text-muted">{sub}</div>
    </div>
  );
}
