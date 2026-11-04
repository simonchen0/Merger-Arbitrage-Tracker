"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { todayInNewYork } from "@/lib/calc";
import { buildRow, type DealRow } from "@/lib/dealRow";
import { deleteDeal, saveDeal, useDeals } from "@/lib/deals";
import { pct, signClass, usd } from "@/lib/format";
import type { Deal } from "@/lib/types";
import { useMarketData } from "@/lib/useMarketData";
import { Badge } from "./Badge";
import { DealForm } from "./DealForm";

export function DealDetail({ id }: { id: string }) {
  const router = useRouter();
  const deals = useDeals();
  const deal = deals?.find((d) => d.id === id) ?? null;
  const dealList = useMemo(() => (deal ? [deal] : null), [deal]);
  const market = useMarketData(dealList);
  const [editing, setEditing] = useState(false);
  // Break price being typed (null = not editing, show the saved value).
  const [draft, setDraft] = useState<string | null>(null);

  if (deals === null) return <p className="text-sm text-muted">Loading…</p>;
  if (!deal) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted">This deal doesn&apos;t exist. It may have been deleted.</p>
        <Link href="/" className="text-sm text-accent hover:underline">
          ← All deals
        </Link>
      </div>
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

  const m = row.metrics;
  const est = row.breakIsEstimate;

  return (
    <div className="space-y-6">
      <Link href="/" className="text-sm text-muted hover:text-accent">
        ← All deals
      </Link>

      {deal.isDemo && (
        <p className="rounded border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent">
          Demo deal: fictional companies and simulated prices, for illustration only.
        </p>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-2xl font-semibold">{deal.targetTicker}</h1>
            {deal.isDemo && <Badge kind="demo" />}
          </div>
          <p className="text-text">{deal.targetName}</p>
          <p className="text-sm text-muted">
            Acquired by <span className="text-text">{deal.acquirerName}</span> for{" "}
            <span className="num text-text">{usd(deal.offerPrice)}</span> cash per share
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setEditing(true)}
            className="rounded border border-border px-3 py-1.5 text-xs hover:border-accent hover:text-accent"
          >
            Edit deal
          </button>
          <button
            onClick={handleDelete}
            className="rounded border border-border px-3 py-1.5 text-xs text-muted hover:border-down hover:text-down"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Terms */}
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded border border-border bg-panel p-4 text-sm sm:grid-cols-4">
        <Term label="Announced" value={deal.announceDate} />
        <Term
          label="Expected close"
          value={
            <>
              {deal.expectedCloseDate}{" "}
              <span className={m.daysToClose !== null && m.daysToClose <= 0 ? "text-down" : "text-muted"}>
                ({m.daysToClose === null ? "—" : m.daysToClose <= 0 ? "past expected close" : `${m.daysToClose} days`})
              </span>
            </>
          }
        />
        <Term label="Unaffected price" value={<span className="text-est">{usd(row.unaffected)}</span>} />
        <Term
          label="Source"
          value={
            deal.sourceUrl ? (
              <a href={deal.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                Announcement ↗
              </a>
            ) : (
              <span className="text-muted">{deal.isDemo ? "n/a (demo)" : "Not provided"}</span>
            )
          }
        />
      </dl>

      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Target price" value={usd(row.price)} sub={row.priceNote} />
        <StatCard label="Offer" value={usd(deal.offerPrice)} sub="cash per share" />
        <StatCard
          label="Spread"
          value={pct(m.spreadPct)}
          valueClass={signClass(m.spreadPct)}
          sub={`${usd(m.spreadDollars)} per share`}
        />
        <StatCard
          label="Annualized return"
          value={pct(m.annualized)}
          valueClass={signClass(m.annualized)}
          sub={m.daysToClose !== null && m.daysToClose > 0 ? `over ${m.daysToClose} days` : "past expected close"}
        />
        <StatCard
          label="Downside if deal breaks"
          value={pct(m.downside)}
          valueClass={est ? "text-est" : signClass(m.downside)}
          sub={`${usd(m.downsideDollars)} per share`}
          est={est}
        />
        <StatCard
          label="Break-even probability"
          value={breakEvenText(row)}
          valueClass={est ? "text-est" : ""}
          sub="deal must close at least this often"
          est={est}
        />
      </div>

      {/* Break price + scenario */}
      <div className="grid gap-4 md:grid-cols-2">
        <section className="space-y-3 rounded border border-border bg-panel p-4">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">Break price</h2>
            {est && <Badge kind="est" title="Estimated: unaffected close before the announcement" />}
          </div>
          <p className="text-xs text-muted">
            Where the target would likely trade if the deal fell apart. Defaults to the unaffected price (the close
            before the announcement). Type a different price to see the effect.
          </p>
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
                className={`w-32 rounded border bg-bg py-1.5 pl-6 pr-2 text-sm outline-none num [color-scheme:dark] focus:border-accent ${
                  draftError ? "border-down" : "border-border"
                } ${est && draft === null ? "text-est" : ""}`}
              />
            </div>
            <button
              onClick={() => saveBreak(draftValue!)}
              disabled={!usingDraft || draftValue === deal.breakPrice}
              className="rounded border border-accent bg-accent/15 px-3 py-1.5 text-xs text-accent hover:bg-accent/25 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Save
            </button>
            {(deal.breakPrice !== undefined || draft !== null) && (
              <button
                onClick={() => saveBreak(undefined)}
                className="rounded border border-border px-3 py-1.5 text-xs text-muted hover:text-text"
              >
                Use unaffected price{row.unaffected !== null ? ` (${usd(row.unaffected)})` : ""}
              </button>
            )}
          </div>
          {draftError && <p className="text-xs text-down">{draftError}</p>}
          {usingDraft && draftValue !== deal.breakPrice && (
            <p className="text-xs text-muted">Showing a what-if. Save to keep this break price.</p>
          )}
        </section>

        <section className="space-y-2 rounded border border-border bg-panel p-4 text-sm">
          <h2 className="text-sm font-semibold">The trade in one paragraph</h2>
          <Scenario row={row} />
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

function Scenario({ row }: { row: DealRow }) {
  const { deal, price, breakPrice, metrics: m } = row;
  if (price === null) return <p className="text-muted">Waiting for a market price.</p>;

  return (
    <div className="space-y-2 leading-relaxed text-muted">
      <p>
        Buying {deal.targetTicker} at <span className="num text-text">{usd(price)}</span>{" "}
        {m.spreadDollars !== null && m.spreadDollars >= 0 ? (
          <>
            earns <span className="num text-up">{usd(m.spreadDollars)}</span> per share (
            <span className="num text-up">{pct(m.spreadPct)}</span>) if the deal closes at{" "}
            <span className="num text-text">{usd(deal.offerPrice)}</span>
            {m.annualized !== null && (
              <>
                , or <span className="num text-up">{pct(m.annualized)}</span> annualized over {m.daysToClose} days
              </>
            )}
            .
          </>
        ) : (
          <>
            costs more than the <span className="num text-text">{usd(deal.offerPrice)}</span> offer, so it loses{" "}
            <span className="num text-down">{usd(m.spreadDollars)}</span> per share if the deal closes on current terms.
            The market is pricing in a higher bid.
          </>
        )}
      </p>
      {breakPrice !== null && m.downsideDollars !== null && (
        <p>
          If the deal breaks and the stock falls to{" "}
          <span className={`num ${row.breakIsEstimate ? "text-est" : "text-text"}`}>{usd(breakPrice)}</span>, the loss
          is <span className="num text-down">{usd(Math.abs(m.downsideDollars))}</span> per share (
          <span className="num text-down">{pct(m.downside)}</span>).
        </p>
      )}
      {m.breakEven !== null && (
        <p>
          The trade breaks even if the deal closes with probability{" "}
          <span className="num text-text">{pct(m.breakEven, "—", 1)}</span>. That&apos;s also the probability the
          market is implying. If you think the deal is more likely than that to close, the spread is attractive.
        </p>
      )}
    </div>
  );
}

function Term({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="num">{value}</dd>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  valueClass = "",
  est = false,
}: {
  label: string;
  value: string;
  sub: string;
  valueClass?: string;
  est?: boolean;
}) {
  return (
    <div className="space-y-1 rounded border border-border bg-panel p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted">{label}</span>
        {est && <Badge kind="est" title="Uses the estimated break price" />}
      </div>
      <div className={`text-xl num ${valueClass}`}>{value}</div>
      <div className="text-xs text-muted">{sub}</div>
    </div>
  );
}
