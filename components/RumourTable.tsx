"use client";

import type { RumourRow } from "@/lib/dealRow";
import { pct, usd } from "@/lib/format";
import type { Rumour } from "@/lib/types";
import { Badge } from "./Badge";
import { cardClass, PencilIcon, TrashIcon } from "./ui";

// Rumoured deals: reported in the press, not announced. Anything the report doesn't state shows
// "Not disclosed"; numbers computed from a reported price are amber and tagged INDICATIVE.

const NOT_DISCLOSED = "Not disclosed";
const INDICATIVE_TITLE = "Indicative: based on unconfirmed terms reported in the press";

/** Newest report first. */
function byReportDate(rows: RumourRow[]): RumourRow[] {
  return [...rows].sort((a, b) => b.rumour.reportDate.localeCompare(a.rumour.reportDate));
}

/** Why a metric is blank, as a tooltip: the report didn't give the input it needs. */
function blankReason(row: RumourRow, needsTimeframe: boolean): string {
  if (row.rumour.reportedPrice === undefined) return "No price reported";
  if (row.price === null) return "No market price";
  if (needsTimeframe && !row.rumour.reportedCloseDate) return "No timeframe reported";
  return "";
}

function Indicative({ value, row, needsTimeframe = false }: { value: number | null; row: RumourRow; needsTimeframe?: boolean }) {
  if (value === null) {
    return (
      <span title={blankReason(row, needsTimeframe)} className="cursor-help text-muted">
        —
      </span>
    );
  }
  return (
    <span title={INDICATIVE_TITLE} className="text-est">
      {pct(value)}
    </span>
  );
}

function Source({ row }: { row: RumourRow }) {
  return (
    <a
      href={row.rumour.sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="text-accent transition-colors hover:underline"
    >
      {row.publisher ?? "Source"} ↗
    </a>
  );
}

const iconButton = "grid h-8 w-8 place-items-center rounded-lg text-muted transition-colors hover:bg-bg";

export function RumourTable({
  rows,
  onEdit,
  onDelete,
  showNote = true,
}: {
  rows: RumourRow[];
  onEdit: (rumour: Rumour) => void;
  onDelete: (rumour: Rumour) => void;
  showNote?: boolean; // per-row "as of" time; off when the page shows one shared time
}) {
  const sorted = byReportDate(rows);
  const th = "px-2.5 py-3 font-medium whitespace-nowrap";

  return (
    <>
      {/* Wide screens: table */}
      <div className={cardClass("relative hidden overflow-x-auto xl:block")}>
        <table className="w-full min-w-[960px] text-sm">
          <thead className="border-b border-border text-[11px] uppercase tracking-wider text-muted">
            <tr>
              <th className={`${th} text-left`}>Target</th>
              <th className={`${th} text-left`}>Potential acquirer</th>
              <th className={`${th} text-left`}>Source</th>
              <th className={`${th} text-right`}>Price</th>
              <th className={`${th} text-right`}>Reported price</th>
              <th className={`${th} text-right`}>
                <span className="inline-flex items-center gap-1.5">
                  Spread <Badge kind="ind" title={INDICATIVE_TITLE} />
                </span>
              </th>
              <th className={`${th} text-right`}>
                <span className="inline-flex items-center gap-1.5">
                  Ann. return <Badge kind="ind" title={INDICATIVE_TITLE} />
                </span>
              </th>
              <th className="px-1 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => {
              const { rumour: r, metrics: m } = row;
              const td = "px-2.5 py-3.5 text-right num whitespace-nowrap";
              return (
                <tr key={r.id} className="group border-b border-border/60 transition-colors last:border-0 hover:bg-panel-2">
                  <td className="px-3 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="min-w-0">
                        <div className="font-mono font-semibold">{r.targetTicker}</div>
                        <div className="max-w-[10rem] truncate text-xs text-muted">{r.targetName}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-2.5 py-3.5">
                    <div className={`max-w-[10rem] truncate ${r.acquirerName ? "text-muted" : "italic text-muted"}`} title={r.acquirerName}>
                      {r.acquirerName ?? NOT_DISCLOSED}
                    </div>
                  </td>
                  <td className="px-2.5 py-3.5 whitespace-nowrap">
                    <Source row={row} />
                    <div className="num text-xs text-muted">{r.reportDate}</div>
                  </td>
                  <td className={td}>
                    <div className="font-medium">{usd(row.price)}</div>
                    {showNote && <div className="text-xs text-muted">{row.priceNote}</div>}
                  </td>
                  <td className={td}>
                    {r.reportedPrice !== undefined ? (
                      <span className="font-medium">{usd(r.reportedPrice)}</span>
                    ) : (
                      <span className="font-sans italic text-muted">{NOT_DISCLOSED}</span>
                    )}
                  </td>
                  <td className={td}>
                    <div className="font-medium">
                      <Indicative value={m.spreadPct} row={row} />
                    </div>
                    {m.spreadDollars !== null && <div className="text-xs text-est">{usd(m.spreadDollars)}</div>}
                  </td>
                  <td className={td}>
                    <div className="font-medium">
                      <Indicative value={m.annualized} row={row} needsTimeframe />
                    </div>
                    {r.reportedCloseDate && <div className="text-xs text-muted">by {r.reportedCloseDate}</div>}
                  </td>
                  <td className="px-1 py-3.5">
                    {/* Hidden until the row is hovered or focused; always shown on touch screens. */}
                    <div className="flex justify-end gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
                      <button onClick={() => onEdit(r)} aria-label={`Edit ${r.targetTicker} rumour`} title="Edit" className={`${iconButton} hover:text-accent`}>
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      <button onClick={() => onDelete(r)} aria-label={`Delete ${r.targetTicker} rumour`} title="Delete" className={`${iconButton} hover:text-down`}>
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

      {/* Phones and tablets: one card per rumour (two columns on tablets) */}
      <div className="grid gap-3 md:grid-cols-2 xl:hidden">
        {sorted.map((row) => (
          <RumourCard key={row.rumour.id} row={row} onEdit={onEdit} onDelete={onDelete} showNote={showNote} />
        ))}
      </div>
    </>
  );
}

function CardStat({ label, children, sub }: { label: React.ReactNode; children: React.ReactNode; sub?: string }) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-muted">{label}</dt>
      <dd className="num mt-0.5 font-medium">{children}</dd>
      {sub && <div className="truncate text-[11px] text-muted">{sub}</div>}
    </div>
  );
}

function RumourCard({
  row,
  onEdit,
  onDelete,
  showNote,
}: {
  row: RumourRow;
  onEdit: (r: Rumour) => void;
  onDelete: (r: Rumour) => void;
  showNote: boolean;
}) {
  const { rumour: r, metrics: m } = row;

  return (
    <div className={cardClass("flex flex-col overflow-hidden")}>
      <div className="flex-1 p-4">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="font-mono font-semibold">{r.targetTicker}</div>
            <div className="truncate text-xs text-muted">{r.targetName}</div>
            <div className="truncate text-xs text-muted">
              → {r.acquirerName ?? <span className="italic">Acquirer not disclosed</span>}
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center justify-end gap-1 text-[10px] font-medium uppercase tracking-wider text-muted">
              Spread <Badge kind="ind" title={INDICATIVE_TITLE} />
            </div>
            <div className="num text-2xl font-semibold">
              <Indicative value={m.spreadPct} row={row} />
            </div>
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-3 gap-x-3 gap-y-3 text-sm">
          <CardStat label="Price" sub={showNote ? row.priceNote : undefined}>
            {usd(row.price)}
          </CardStat>
          <CardStat label="Reported">
            {r.reportedPrice !== undefined ? usd(r.reportedPrice) : <span className="font-sans text-xs italic text-muted">{NOT_DISCLOSED}</span>}
          </CardStat>
          <CardStat label="Ann. return" sub={r.reportedCloseDate ? `by ${r.reportedCloseDate}` : undefined}>
            <Indicative value={m.annualized} row={row} needsTimeframe />
          </CardStat>
        </dl>

        <div className="mt-3 text-xs">
          <Source row={row} /> <span className="num text-muted">· {r.reportDate}</span>
        </div>
      </div>

      <div className="flex divide-x divide-border border-t border-border text-xs">
        <button onClick={() => onEdit(r)} className="flex-1 py-2.5 text-muted transition-colors hover:text-accent">
          Edit
        </button>
        <button onClick={() => onDelete(r)} className="flex-1 py-2.5 text-muted transition-colors hover:text-down">
          Delete
        </button>
      </div>
    </div>
  );
}
