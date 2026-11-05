"use client";

import { useMemo, useState } from "react";
import { DealForm } from "@/components/DealForm";
import { DealTable } from "@/components/DealTable";
import { SummaryStrip } from "@/components/SummaryStrip";
import { buttonClass } from "@/components/ui";
import { todayInNewYork } from "@/lib/calc";
import { buildRow, summarize } from "@/lib/dealRow";
import { deleteDeal, resetDeals, saveDeal, useDeals } from "@/lib/deals";
import type { Deal } from "@/lib/types";
import { useMarketData } from "@/lib/useMarketData";

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

      {summary && <SummaryStrip summary={summary} loading={loading} />}

      {market.error && (
        <p className="rounded-xl border border-down/40 bg-down/10 px-3 py-2 text-sm text-down">
          Couldn&apos;t refresh prices ({market.error}). Showing the last prices loaded.
        </p>
      )}

      {rows === null ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="space-y-3 rounded-2xl border border-border bg-panel px-3 py-10 text-center text-sm text-muted">
          <p>No deals tracked yet.</p>
          <div className="flex justify-center gap-4 text-xs">
            <button onClick={() => setEditing("new")} className="text-accent hover:underline">
              + Add a deal
            </button>
            <button onClick={resetDeals} className="text-accent hover:underline">
              Load the starting deals
            </button>
          </div>
        </div>
      ) : (
        <>
          <DealTable rows={rows} onEdit={setEditing} onDelete={handleDelete} />
          <p className="text-xs text-muted md:hidden">
            Swipe the table sideways for annualized return, downside, break-even, and close date.
          </p>
        </>
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
