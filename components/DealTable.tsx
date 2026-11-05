"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { DealRow } from "@/lib/dealRow";
import { pct, signClass, usd } from "@/lib/format";
import type { Deal } from "@/lib/types";
import { buttonClass, cardClass, PencilIcon, SortIcon, TrashIcon } from "./ui";

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

const COLUMNS: { key: SortKey; label: string; align: "left" | "right" }[] = [
  { key: "target", label: "Target", align: "left" },
  { key: "acquirer", label: "Acquirer", align: "left" },
  { key: "price", label: "Price", align: "right" },
  { key: "offer", label: "Offer", align: "right" },
  { key: "spreadDollars", label: "Spread $", align: "right" },
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

/** Text columns start A→Z, the close date soonest first, and number columns highest first. */
function defaultDir(key: SortKey): "asc" | "desc" {
  return key === "target" || key === "acquirer" || key === "daysToClose" ? "asc" : "desc";
}

/** A thin horizontal bar, `fraction` (0 to 1) full. Decorative: the number beside it carries the value. */
function Bar({ fraction, tone }: { fraction: number; tone: string }) {
  const width = `${Math.round(Math.min(1, Math.max(0, fraction)) * 100)}%`;
  return (
    <div aria-hidden className="h-1 w-16 overflow-hidden rounded-full bg-border">
      <div className={`h-full rounded-full ${tone}`} style={{ width }} />
    </div>
  );
}

function breakEvenText(row: DealRow) {
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

function daysText(days: number | null): string {
  return days === null ? "—" : days <= 0 ? "past expected close" : `${days}d`;
}

const iconButton = "grid h-8 w-8 place-items-center rounded-lg text-muted transition-colors hover:bg-bg";

export function DealTable({
  rows,
  onEdit,
  onDelete,
  showNote = true,
}: {
  rows: DealRow[];
  onEdit: (deal: Deal) => void;
  onDelete: (deal: Deal) => void;
  showNote?: boolean; // per-row "as of" time; off when the page shows one shared time
}) {
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "annualized", dir: "desc" });
  const router = useRouter();

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: defaultDir(key) }));
  }

  const sorted = sortRows(rows, sort.key, sort.dir);
  // Bars show each deal's annualized return relative to the best one on screen.
  const maxAnnualized = Math.max(0, ...rows.map((r) => r.metrics.annualized ?? 0));

  return (
    <>
      {/* Wide screens (1280px and up, where every column fits): table */}
      {/* `relative` keeps the sr-only header cell inside this scroll box; otherwise it
          escapes the clipping and makes the whole page scroll sideways. */}
      <div className={cardClass("relative hidden overflow-x-auto xl:block")}>
        <table className="w-full min-w-[960px] text-sm">
          <thead className="border-b border-border text-[11px] uppercase tracking-wider text-muted">
            <tr>
              {COLUMNS.map((c) => {
                const active = sort.key === c.key;
                return (
                  <th
                    key={c.key}
                    aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                    className={`px-2.5 py-3 font-medium ${c.align === "left" ? "text-left" : "text-right"} ${
                      // The ticker stays pinned if the table scrolls sideways on a narrow screen.
                      c.key === "target" ? "sticky left-0 z-10 bg-panel" : ""
                    }`}
                  >
                    <button
                      onClick={() => toggleSort(c.key)}
                      className={`inline-flex items-center gap-1 whitespace-nowrap uppercase tracking-wider transition-colors hover:text-text ${
                        active ? "text-accent" : ""
                      }`}
                    >
                      {c.label}
                      <SortIcon dir={active ? sort.dir : null} />
                    </button>
                  </th>
                );
              })}
              <th className="px-1 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => {
              const { deal, metrics: m } = row;
              const td = "px-2.5 py-3.5 text-right num whitespace-nowrap";
              return (
                <tr
                  key={deal.id}
                  onClick={() => router.push(`/deals/${deal.id}`)}
                  className="group cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-panel-2"
                >
                  <td className="sticky left-0 z-10 bg-panel px-3 py-3.5 transition-colors before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-accent before:opacity-0 before:transition-opacity group-hover:bg-panel-2 group-hover:before:opacity-100">
                    <div className="flex items-center gap-2.5">
                      <div className="min-w-0">
                        <Link
                          href={`/deals/${deal.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="font-mono font-semibold transition-colors hover:text-accent"
                        >
                          {deal.targetTicker}
                        </Link>
                        <div className="max-w-[9rem] truncate text-xs text-muted">{deal.targetName}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-2.5 py-3.5 text-muted">
                    <div className="max-w-[8rem] truncate" title={deal.acquirerName}>
                      {deal.acquirerName}
                    </div>
                  </td>
                  <td className={td}>
                    <div className="font-medium">{usd(row.price)}</div>
                    {showNote && <div className="text-xs text-muted">{row.priceNote}</div>}
                  </td>
                  <td className={`${td} font-medium`}>{usd(deal.offerPrice)}</td>
                  <td className={`${td} ${signClass(m.spreadDollars)}`}>{usd(m.spreadDollars)}</td>
                  <td className={`${td} font-medium ${signClass(m.spreadPct)}`}>{pct(m.spreadPct)}</td>
                  <td className={td}>
                    <div className={`font-medium ${signClass(m.annualized)}`}>{pct(m.annualized)}</div>
                    {m.annualized !== null && m.annualized > 0 && maxAnnualized > 0 && (
                      <div className="mt-1.5 flex justify-end">
                        <Bar fraction={m.annualized / maxAnnualized} tone="bg-up" />
                      </div>
                    )}
                  </td>
                  <td className={`${td} ${row.breakIsEstimate ? "text-est" : signClass(m.downside)}`}>{pct(m.downside)}</td>
                  <td className={`${td} ${row.breakIsEstimate ? "text-est" : ""}`}>
                    <div className="font-medium">{breakEvenText(row)}</div>
                    {m.breakEven !== null && (
                      <div className="mt-1.5 flex justify-end">
                        <Bar fraction={m.breakEven} tone={row.breakIsEstimate ? "bg-est" : "bg-accent"} />
                      </div>
                    )}
                  </td>
                  <td className={td}>
                    <div className="font-medium">{deal.expectedCloseDate}</div>
                    <div className={`text-xs ${m.daysToClose !== null && m.daysToClose <= 0 ? "text-down" : "text-muted"}`}>
                      {daysText(m.daysToClose)}
                    </div>
                  </td>
                  <td className="px-1 py-3.5" onClick={(e) => e.stopPropagation()}>
                    {/* Hidden until the row is hovered or focused; always shown on touch screens. */}
                    <div className="flex justify-end gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
                      <button
                        onClick={() => onEdit(deal)}
                        aria-label={`Edit ${deal.targetTicker}`}
                        title="Edit"
                        className={`${iconButton} hover:text-accent`}
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => onDelete(deal)}
                        aria-label={`Delete ${deal.targetTicker}`}
                        title="Delete"
                        className={`${iconButton} hover:text-down`}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Phones and tablets: one card per deal (two columns on tablets), with a sort control in place of the table headers */}
      <div className="space-y-3 xl:hidden">
        <div className="flex items-center gap-2">
          <label htmlFor="sort-deals" className="sr-only">
            Sort deals by
          </label>
          <select
            id="sort-deals"
            value={sort.key}
            onChange={(e) => setSort({ key: e.target.value as SortKey, dir: defaultDir(e.target.value as SortKey) })}
            className="min-w-0 flex-1 rounded-lg border border-border bg-panel-2 px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          >
            {COLUMNS.map((c) => (
              <option key={c.key} value={c.key}>
                Sort: {c.label}
              </option>
            ))}
          </select>
          <button
            onClick={() => setSort((s) => ({ ...s, dir: s.dir === "asc" ? "desc" : "asc" }))}
            aria-label={sort.dir === "asc" ? "Ascending, tap for descending" : "Descending, tap for ascending"}
            className={buttonClass("secondary", "md")}
          >
            {sort.dir === "asc" ? "↑ Asc" : "↓ Desc"}
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {sorted.map((row) => (
            <DealCard key={row.deal.id} row={row} onEdit={onEdit} onDelete={onDelete} showNote={showNote} />
          ))}
        </div>
      </div>
    </>
  );
}

function CardStat({ label, children, sub, className = "" }: { label: string; children: React.ReactNode; sub?: string; className?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-medium uppercase tracking-wider text-muted">{label}</dt>
      <dd className={`num mt-0.5 font-medium ${className}`}>{children}</dd>
      {sub && <div className="truncate text-[11px] text-muted">{sub}</div>}
    </div>
  );
}

function DealCard({
  row,
  onEdit,
  onDelete,
  showNote,
}: {
  row: DealRow;
  onEdit: (deal: Deal) => void;
  onDelete: (deal: Deal) => void;
  showNote: boolean;
}) {
  const { deal, metrics: m } = row;
  const est = row.breakIsEstimate;

  return (
    <div className={cardClass("flex flex-col overflow-hidden")}>
      <Link href={`/deals/${deal.id}`} className="block flex-1 p-4 transition-colors active:bg-panel-2">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="font-mono font-semibold">{deal.targetTicker}</div>
            <div className="truncate text-xs text-muted">{deal.targetName}</div>
            <div className="truncate text-xs text-muted">→ {deal.acquirerName}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-medium uppercase tracking-wider text-muted">Ann. return</div>
            <div className={`num text-2xl font-semibold ${signClass(m.annualized)}`}>{pct(m.annualized)}</div>
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-3 gap-x-3 gap-y-3 text-sm">
          <CardStat label="Price" sub={showNote ? row.priceNote : undefined}>
            {usd(row.price)}
          </CardStat>
          <CardStat label="Offer">{usd(deal.offerPrice)}</CardStat>
          <CardStat label="Spread" className={signClass(m.spreadPct)} sub={usd(m.spreadDollars)}>
            {pct(m.spreadPct)}
          </CardStat>
          <CardStat label="Downside" className={est ? "text-est" : signClass(m.downside)}>
            {pct(m.downside)}
          </CardStat>
          <CardStat label="Break-even" className={est ? "text-est" : ""}>
            {breakEvenText(row)}
          </CardStat>
          <CardStat label="Closes" sub={daysText(m.daysToClose)}>
            {deal.expectedCloseDate}
          </CardStat>
        </dl>
      </Link>

      <div className="flex divide-x divide-border border-t border-border text-xs">
        <button onClick={() => onEdit(deal)} className="flex-1 py-2.5 text-muted transition-colors hover:text-accent">
          Edit
        </button>
        <button onClick={() => onDelete(deal)} className="flex-1 py-2.5 text-muted transition-colors hover:text-down">
          Delete
        </button>
      </div>
    </div>
  );
}
