"use client";

import { useMemo } from "react";
import { Badge } from "@/components/Badge";
import { DealTable, type DealRow } from "@/components/DealTable";
import { computeMetrics, todayInNewYork, unaffectedPrice } from "@/lib/calc";
import { useDeals } from "@/lib/deals";
import { demoHistory } from "@/lib/demo";
import type { Deal } from "@/lib/types";

function buildRow(deal: Deal, today: string): DealRow {
  // Phase 4: only demo deals have prices. Live prices for real deals come in Phase 5.
  const history = deal.isDemo ? demoHistory(deal, today) : [];
  const last = history.at(-1)?.close ?? null;
  const unaffected = unaffectedPrice(history, deal.announceDate);
  const breakPrice = deal.breakPrice ?? unaffected;

  return {
    deal,
    price: last,
    priceNote: deal.isDemo ? "simulated" : "unavailable",
    breakPrice,
    breakIsEstimate: deal.breakPrice === undefined && unaffected !== null,
    metrics: computeMetrics({
      price: last,
      offer: deal.offerPrice,
      breakPrice,
      expectedCloseDate: deal.expectedCloseDate,
      today,
    }),
  };
}

export default function Dashboard() {
  const deals = useDeals();
  const rows = useMemo(() => {
    if (deals === null) return null; // server render: storage isn't available yet
    const today = todayInNewYork();
    return deals.map((d) => buildRow(d, today));
  }, [deals]);

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-lg font-semibold">Deals</h1>
        {rows && <span className="text-sm text-muted">{rows.length} tracked</span>}
      </div>

      {rows === null ? <p className="text-sm text-muted">Loading…</p> : <DealTable rows={rows} />}

      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <span>
          <Badge kind="demo" /> fictional deal, simulated prices
        </span>
        <span>
          <Badge kind="est" /> <span className="text-est">amber</span> = uses the estimated break price
          (unaffected close before announcement)
        </span>
        <span>Ann. return = spread % × 365 / days to close</span>
      </p>
    </div>
  );
}
