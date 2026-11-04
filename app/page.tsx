"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/Badge";
import { DealForm } from "@/components/DealForm";
import { DealTable, type DealRow } from "@/components/DealTable";
import { computeMetrics, todayInNewYork, unaffectedPrice } from "@/lib/calc";
import { deleteDeal, resetDeals, saveDeal, useDeals } from "@/lib/deals";
import { demoHistory } from "@/lib/demo";
import { asOfLabel } from "@/lib/format";
import type { Deal, Quote } from "@/lib/types";
import { unaffectedKey, useMarketData } from "@/lib/useMarketData";

type Filter = "all" | "real" | "demo";

function buildRow(
  deal: Deal,
  today: string,
  quotes: Record<string, Quote>,
  unaffected: Record<string, number | null>,
  loading: boolean,
): DealRow {
  let price: number | null;
  let priceNote: string;
  let unaffectedClose: number | null;

  if (deal.isDemo) {
    const history = demoHistory(deal, today);
    price = history.at(-1)?.close ?? null;
    priceNote = "simulated";
    unaffectedClose = unaffectedPrice(history, deal.announceDate);
  } else {
    const quote = quotes[deal.targetTicker];
    price = quote?.price ?? null;
    priceNote = quote ? asOfLabel(quote.asOf) : loading ? "loading…" : "unavailable";
    unaffectedClose = unaffected[unaffectedKey(deal)] ?? null;
  }

  const breakPrice = deal.breakPrice ?? unaffectedClose;
  return {
    deal,
    price,
    priceNote,
    breakPrice,
    breakIsEstimate: deal.breakPrice === undefined && unaffectedClose !== null,
    metrics: computeMetrics({
      price,
      offer: deal.offerPrice,
      breakPrice,
      expectedCloseDate: deal.expectedCloseDate,
      today,
    }),
  };
}

export default function Dashboard() {
  const deals = useDeals();
  const market = useMarketData(deals);
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<Deal | "new" | null>(null);
  const { quotes, unaffected, loading } = market;

  function handleDelete(deal: Deal) {
    if (confirm(`Delete ${deal.targetTicker} (${deal.targetName})?`)) deleteDeal(deal.id);
  }

  function handleReset() {
    if (confirm("Replace all deals with the sample data? Your added and edited deals will be lost.")) resetDeals();
  }

  const rows = useMemo(() => {
    if (deals === null) return null; // server render: storage isn't available yet
    const today = todayInNewYork();
    return deals
      .filter((d) => filter === "all" || (filter === "demo") === d.isDemo)
      .map((d) => buildRow(d, today, quotes, unaffected, loading));
  }, [deals, filter, quotes, unaffected, loading]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h1 className="text-lg font-semibold">Deals</h1>
          {rows && <span className="text-sm text-muted">{rows.length} shown</span>}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded border border-border text-xs" role="group" aria-label="Filter deals">
            {(["all", "real", "demo"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                aria-pressed={filter === f}
                className={`px-3 py-1.5 capitalize ${filter === f ? "bg-accent/15 text-accent" : "text-muted hover:text-text"}`}
              >
                {f}
              </button>
            ))}
          </div>

          <span className="text-xs text-muted num">
            {market.lastUpdated
              ? `Updated ${market.lastUpdated.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
              : ""}
          </span>
          <button
            onClick={market.refresh}
            disabled={!market.hasRealDeals || loading}
            title={market.hasRealDeals ? "Fetch latest prices" : "No real deals to refresh"}
            className="rounded border border-border px-3 py-1.5 text-xs hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border disabled:hover:text-text"
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
          <button
            onClick={() => setEditing("new")}
            className="rounded border border-accent bg-accent/15 px-3 py-1.5 text-xs text-accent hover:bg-accent/25"
          >
            + Add deal
          </button>
        </div>
      </div>

      {market.error && (
        <p className="rounded border border-down/40 bg-down/10 px-3 py-2 text-sm text-down">
          Couldn&apos;t refresh prices ({market.error}). Showing the last prices loaded.
        </p>
      )}

      {rows === null ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="rounded border border-border bg-panel px-3 py-6 text-center text-sm text-muted">
          No {filter === "all" ? "" : `${filter} `}deals yet.
        </p>
      ) : (
        <DealTable rows={rows} onEdit={setEditing} onDelete={handleDelete} />
      )}

      {editing && (
        <DealForm
          deal={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSave={(deal) => {
            saveDeal(deal);
            setEditing(null);
          }}
        />
      )}

      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <span>
          <Badge kind="demo" /> fictional deal, simulated prices
        </span>
        <span>
          <Badge kind="est" /> <span className="text-est">amber</span> = uses the estimated break price
          (unaffected close before announcement)
        </span>
        <span>Ann. return = spread % × 365 / days to close · Real prices from Yahoo Finance, delayed ~15 min</span>
        <button onClick={handleReset} className="ml-auto underline decoration-dotted hover:text-text">
          Reset to sample data
        </button>
      </p>
    </div>
  );
}
