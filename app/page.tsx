"use client";

import { useMemo, useState } from "react";
import { DealForm } from "@/components/DealForm";
import { DealTable } from "@/components/DealTable";
import { SummaryStrip } from "@/components/SummaryStrip";
import { buttonClass, cardClass, EmptyState } from "@/components/ui";
import { todayInNewYork } from "@/lib/calc";
import { buildRow, summarize } from "@/lib/dealRow";
import { deleteDeal, resetDeals, saveDeal, useDeals } from "@/lib/deals";
import type { Deal } from "@/lib/types";
import { useMarketData } from "@/lib/useMarketData";

/** Placeholder shown for the instant before saved deals load, so the page doesn't jump. */
function Skeleton() {
  return (
    <div aria-hidden className="animate-pulse space-y-6">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={cardClass("h-[108px]")} />
        ))}
      </div>
      <div className={cardClass("h-72")} />
    </div>
  );
}

export default function Dashboard() {
  const deals = useDeals();
  const market = useMarketData(deals);
  const [editing, setEditing] = useState<Deal | "new" | null>(null);
  const { quotes, unaffected, loading } = market;

  function handleDelete(deal: Deal) {
    if (confirm(`Delete ${deal.targetTicker} (${deal.targetName})?`)) deleteDeal(deal.id);
  }

  const rows = useMemo(() => {
    if (deals === null) return null; // server render: storage isn't available yet
    const today = todayInNewYork();
    return deals.map((d) => buildRow(d, today, quotes, unaffected, loading));
  }, [deals, quotes, unaffected, loading]);

  const summary = useMemo(() => (rows ? summarize(rows) : null), [rows]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Deals</h1>
          {rows && <span className="text-sm text-muted">{rows.length} tracked</span>}
        </div>

        <div className="flex items-center gap-3">
          <span className="num text-xs text-muted">
            {market.lastUpdated
              ? `Updated ${market.lastUpdated.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
              : ""}
          </span>
          <button
            onClick={market.refresh}
            disabled={!market.hasDeals || loading}
            title={market.hasDeals ? "Fetch latest prices" : "No deals to refresh"}
            className={buttonClass("secondary")}
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
          <button onClick={() => setEditing("new")} className={buttonClass("primary")}>
            + Add deal
          </button>
        </div>
      </div>

      {summary && summary.dealCount > 0 && <SummaryStrip summary={summary} loading={loading} />}

      {market.error && (
        <p className="rounded-xl border border-down/40 bg-down/10 px-3 py-2 text-sm text-down">
          Couldn&apos;t refresh prices ({market.error}). Showing the last prices loaded.
        </p>
      )}

      {rows === null ? (
        <Skeleton />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No deals tracked yet"
          actions={
            <>
              <button onClick={() => setEditing("new")} className={buttonClass("primary", "md")}>
                + Add a deal
              </button>
              <button onClick={resetDeals} className={buttonClass("secondary", "md")}>
                Load the starting deals
              </button>
            </>
          }
        >
          Add an announced all-cash deal to track its spread, or load the starting deals to see how it works.
        </EmptyState>
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
    </div>
  );
}
