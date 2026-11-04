"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { DealRow } from "@/lib/dealRow";
import { pct, signClass, usd } from "@/lib/format";
import type { Deal } from "@/lib/types";
import { Badge } from "./Badge";

type SortKey =
  | "target"
  | "acquirer"
  | "price"
  | "offer"
  | "spreadDollars"
  | "spreadPct"
  | "annualized"
  | "downside"
  | "breakEven"
  | "daysToClose";

// hideSm: dropped on phones to leave room for the key metrics (all of it is on the detail page)
const COLUMNS: { key: SortKey; label: string; align: "left" | "right"; hideSm?: boolean }[] = [
  { key: "target", label: "Target", align: "left" },
  { key: "acquirer", label: "Acquirer", align: "left", hideSm: true },
  { key: "price", label: "Price", align: "right" },
  { key: "offer", label: "Offer", align: "right", hideSm: true },
  { key: "spreadDollars", label: "Spread $", align: "right", hideSm: true },
  { key: "spreadPct", label: "Spread %", align: "right" },
  { key: "annualized", label: "Ann. Return", align: "right" },
  { key: "downside", label: "Downside", align: "right" },
  { key: "breakEven", label: "Break-even", align: "right" },
  { key: "daysToClose", label: "Exp. Close", align: "right" },
];

function sortValue(row: DealRow, key: SortKey): string | number | null {
  switch (key) {
    case "target":
      return row.deal.targetTicker;
    case "acquirer":
      return row.deal.acquirerName;
    case "price":
      return row.price;
    case "offer":
      return row.deal.offerPrice;
    default:
      return row.metrics[key];
  }
}

function sortRows(rows: DealRow[], key: SortKey, dir: "asc" | "desc"): DealRow[] {
  return [...rows].sort((a, b) => {
    const va = sortValue(a, key);
    const vb = sortValue(b, key);
    // Missing values always sort last, whatever the direction.
    if (va === null && vb === null) return 0;
    if (va === null) return 1;
    if (vb === null) return -1;
    const cmp = typeof va === "string" ? va.localeCompare(vb as string) : va - (vb as number);
    return dir === "asc" ? cmp : -cmp;
  });
}

const td = "px-3 py-2 text-right num whitespace-nowrap";

function breakEvenCell(row: DealRow) {
  const { metrics, breakPrice, price } = row;
  if (metrics.breakEven !== null) return pct(metrics.breakEven, "—", 1);
  if (price === null || breakPrice === null) return "—";
  const reason =
    price > row.deal.offerPrice
      ? "Trading above the offer: the market expects a higher bid"
      : "Break price is at or above the current price";
  return (
    <span title={reason} className="cursor-help underline decoration-dotted">
      n/a
    </span>
  );
}

function closeCell(row: DealRow) {
  const days = row.metrics.daysToClose;
  return (
    <div>
      <div>{row.deal.expectedCloseDate}</div>
      <div className={`text-xs ${days !== null && days <= 0 ? "text-down" : "text-muted"}`}>
        {days === null ? "—" : days <= 0 ? "past expected close" : `${days}d`}
      </div>
    </div>
  );
}

export function DealTable({
  rows,
  onEdit,
  onDelete,
}: {
  rows: DealRow[];
  onEdit: (deal: Deal) => void;
  onDelete: (deal: Deal) => void;
}) {
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "annualized", dir: "desc" });

  function toggleSort(key: SortKey) {
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : // Text columns start A→Z; number columns start highest first.
          { key, dir: key === "target" || key === "acquirer" || key === "daysToClose" ? "asc" : "desc" },
    );
  }

  const router = useRouter();
  const sorted = sortRows(rows, sort.key, sort.dir);

  return (
    // `relative` keeps the sr-only header cell inside this scroll box; otherwise it
    // escapes the clipping and makes the whole page scroll sideways on phones.
    <div className="relative overflow-x-auto rounded border border-border bg-panel">
      <table className="w-full min-w-[760px] text-sm md:min-w-[1000px]">
        <thead className="border-b border-border text-xs uppercase tracking-wide text-muted">
          <tr>
            {COLUMNS.map((c) => {
              const active = sort.key === c.key;
              return (
                <th
                  key={c.key}
                  aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                  className={`px-3 py-2 font-medium ${c.align === "left" ? "text-left" : "text-right"} ${
                    // Ticker stays pinned while the metrics scroll.
                    c.key === "target" ? "sticky left-0 z-10 bg-panel" : c.hideSm ? "hidden md:table-cell" : ""
                  }`}
                >
                  <button
                    onClick={() => toggleSort(c.key)}
                    className={`whitespace-nowrap uppercase tracking-wide hover:text-text ${active ? "text-accent" : ""}`}
                  >
                    {c.label}
                    <span className="ml-1 inline-block w-2">{active ? (sort.dir === "asc" ? "▲" : "▼") : ""}</span>
                  </button>
                </th>
              );
            })}
            <th className="px-3 py-2">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => {
            const { deal, metrics: m } = row;
            return (
              <tr
                key={deal.id}
                onClick={() => router.push(`/deals/${deal.id}`)}
                className="cursor-pointer border-b border-border/60 last:border-0 hover:bg-white/[0.03]"
              >
                <td className="sticky left-0 z-10 bg-panel px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/deals/${deal.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="font-mono font-semibold hover:text-accent"
                    >
                      {deal.targetTicker}
                    </Link>
                    {deal.isDemo && <Badge kind="demo" title="Fictional deal with simulated prices" />}
                  </div>
                  <div className="max-w-[6.5rem] truncate text-xs text-muted md:max-w-none">{deal.targetName}</div>
                </td>
                <td className="hidden px-3 py-2 text-muted md:table-cell">{deal.acquirerName}</td>
                <td className={td}>
                  <div>{usd(row.price)}</div>
                  <div className="text-xs text-muted">{row.priceNote}</div>
                </td>
                <td className={`${td} hidden md:table-cell`}>{usd(deal.offerPrice)}</td>
                <td className={`${td} hidden md:table-cell ${signClass(m.spreadDollars)}`}>{usd(m.spreadDollars)}</td>
                <td className={`${td} ${signClass(m.spreadPct)}`}>{pct(m.spreadPct)}</td>
                <td className={`${td} ${signClass(m.annualized)}`}>{pct(m.annualized)}</td>
                <td className={`${td} ${row.breakIsEstimate ? "text-est" : signClass(m.downside)}`}>
                  {pct(m.downside)}
                </td>
                <td className={`${td} ${row.breakIsEstimate ? "text-est" : ""}`}>{breakEvenCell(row)}</td>
                <td className={td}>{closeCell(row)}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap text-xs" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => onEdit(deal)} className="text-muted hover:text-accent">
                    Edit
                  </button>
                  <button onClick={() => onDelete(deal)} className="ml-3 text-muted hover:text-down">
                    Delete
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
