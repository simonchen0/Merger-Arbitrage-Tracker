"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/Badge";
import { DealForm } from "@/components/DealForm";
import { DealTable } from "@/components/DealTable";
import { RumourForm } from "@/components/RumourForm";
import { RumourTable } from "@/components/RumourTable";
import { SummaryStrip } from "@/components/SummaryStrip";
import { buttonClass, cardClass, EmptyState } from "@/components/ui";
import { todayInNewYork } from "@/lib/calc";
import { buildRow, buildRumourRow, sharedPriceNote, summarize } from "@/lib/dealRow";
import { deleteDeal, resetDeals, saveDeal, useDeals } from "@/lib/deals";
import { deleteRumour, saveRumour, useRumours } from "@/lib/rumours";
import type { Deal, Rumour } from "@/lib/types";
import { useClosedDeals } from "@/lib/useClosedDeals";
import { useMarketData } from "@/lib/useMarketData";
import { useRumourScan } from "@/lib/useRumourScan";

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
  const rumours = useRumours();
  const rumourTickers = useMemo(() => (rumours ?? []).map((r) => r.targetTicker), [rumours]);
  const market = useMarketData(deals, rumourTickers);
  const announcedTickers = useMemo(() => (deals ?? []).map((d) => d.targetTicker), [deals]);
  const closedDeals = useClosedDeals(deals, market.missing, market.lastUpdated);
  const rumourScan = useRumourScan(deals !== null && rumours !== null, announcedTickers);
  const [editing, setEditing] = useState<Deal | "new" | null>(null);
  const [editingRumour, setEditingRumour] = useState<Rumour | "new" | null>(null);
  const { quotes, unaffected, loading } = market;

  function handleDelete(deal: Deal) {
    if (confirm(`Delete ${deal.targetTicker} (${deal.targetName})?`)) deleteDeal(deal.id);
  }

  function handleDeleteRumour(rumour: Rumour) {
    if (confirm(`Delete the ${rumour.targetTicker} (${rumour.targetName}) rumour?`)) deleteRumour(rumour.id);
  }

  const rumourRows = useMemo(() => {
    if (rumours === null) return null;
    const today = todayInNewYork();
    return rumours.map((r) => buildRumourRow(r, today, quotes, loading));
  }, [rumours, quotes, loading]);

  const rows = useMemo(() => {
    if (deals === null) return null; // server render: storage isn't available yet
    const today = todayInNewYork();
    return deals.map((d) => buildRow(d, today, quotes, unaffected, loading));
  }, [deals, quotes, unaffected, loading]);

  const summary = useMemo(() => (rows ? summarize(rows) : null), [rows]);
  // One "as of" time for the page, when every priced row shares it (otherwise rows keep their own).
  const sharedNote = useMemo(() => sharedPriceNote([...(rows ?? []), ...(rumourRows ?? [])]), [rows, rumourRows]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Deals</h1>
        </div>

        <div className="flex items-center gap-3">
          <span className="num text-xs text-muted">
            {sharedNote ??
              (market.lastUpdated
                ? `Updated ${market.lastUpdated.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
                : "")}
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

      {closedDeals.removed.length > 0 && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-border bg-panel px-3 py-2 text-sm">
          <ul className="space-y-0.5">
            {closedDeals.removed.map((d) => (
              <li key={d.id}>
                <span className="font-mono font-semibold">{d.targetTicker}</span> is no longer listed (the deal has likely
                closed), so it was removed.
              </li>
            ))}
          </ul>
          <button onClick={closedDeals.dismiss} className="shrink-0 text-muted transition-colors hover:text-text">
            Dismiss
          </button>
        </div>
      )}

      {summary && summary.dealCount > 0 && <SummaryStrip summary={summary} />}

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
        <DealTable rows={rows} onEdit={setEditing} onDelete={handleDelete} showNote={sharedNote === null} />
      )}

      {/* Rumoured deals: kept apart from announced ones, and out of the summary strip */}
      {rumourRows && (
        <section aria-labelledby="rumours-heading" className="space-y-3 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h2 id="rumours-heading" className="text-xl font-semibold tracking-tight">
                Rumoured deals
              </h2>
              <span className="text-sm text-muted">{rumourRows.length} tracked</span>
              <Badge kind="rumour" title="Reported in the press, not announced by the companies" />
            </div>
            <div className="flex items-center gap-3">
              {rumourScan.status && <span className="text-xs text-muted">{rumourScan.status}</span>}
              <button onClick={rumourScan.scan} disabled={rumourScan.scanning} className={buttonClass("secondary")}>
                {rumourScan.scanning ? "Scanning…" : "Scan for rumours"}
              </button>
              <button onClick={() => setEditingRumour("new")} className={buttonClass("secondary")}>
                + Add rumour
              </button>
            </div>
          </div>
          {rumourRows.some((r) => r.rumour.autoFound) && (
            <p className="text-sm text-muted">
              Auto-found rows come from a headline scan and may be wrong. Open the source to check, then edit to confirm.
            </p>
          )}
          {rumourRows.length === 0 ? (
            <div className={cardClass("px-5 py-6 text-center text-sm text-muted")}>
              No deals yet.
            </div>
          ) : (
            <RumourTable rows={rumourRows} onEdit={setEditingRumour} onDelete={handleDeleteRumour} showNote={sharedNote === null} />
          )}
        </section>
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

      {editingRumour && (
        <RumourForm
          rumour={editingRumour === "new" ? null : editingRumour}
          onClose={() => setEditingRumour(null)}
          onSave={(rumour) => {
            saveRumour(rumour);
            setEditingRumour(null);
          }}
        />
      )}
    </div>
  );
}
