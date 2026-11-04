import type { DealMetrics } from "@/lib/calc";
import { pct, signClass, usd } from "@/lib/format";
import type { Deal } from "@/lib/types";
import { Badge } from "./Badge";

export type DealRow = {
  deal: Deal;
  price: number | null;
  priceNote: string; // "simulated", "as of 4:00 PM", "unavailable"
  breakPrice: number | null;
  breakIsEstimate: boolean;
  metrics: DealMetrics;
};

const th = "px-3 py-2 text-right font-medium";
const td = "px-3 py-2 text-right num";

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

export function DealTable({ rows }: { rows: DealRow[] }) {
  return (
    <div className="overflow-x-auto rounded border border-border bg-panel">
      <table className="w-full min-w-[1000px] text-sm">
        <thead className="border-b border-border text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Target</th>
            <th className="px-3 py-2 text-left font-medium">Acquirer</th>
            <th className={th}>Price</th>
            <th className={th}>Offer</th>
            <th className={th}>Spread $</th>
            <th className={th}>Spread %</th>
            <th className={th}>Ann. Return</th>
            <th className={th}>Downside</th>
            <th className={th}>Break-even</th>
            <th className={th}>Exp. Close</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const { deal, metrics: m } = row;
            const estClass = row.breakIsEstimate ? "text-est" : "";
            return (
              <tr key={deal.id} className="border-b border-border/60 last:border-0 hover:bg-white/[0.03]">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold">{deal.targetTicker}</span>
                    {deal.isDemo && <Badge kind="demo" title="Fictional deal with simulated prices" />}
                  </div>
                  <div className="text-xs text-muted">{deal.targetName}</div>
                </td>
                <td className="px-3 py-2 text-muted">{deal.acquirerName}</td>
                <td className={td}>
                  <div>{usd(row.price, "—")}</div>
                  <div className="text-xs text-muted">{row.priceNote}</div>
                </td>
                <td className={td}>{usd(deal.offerPrice)}</td>
                <td className={`${td} ${signClass(m.spreadDollars)}`}>{usd(m.spreadDollars)}</td>
                <td className={`${td} ${signClass(m.spreadPct)}`}>{pct(m.spreadPct)}</td>
                <td className={`${td} ${signClass(m.annualized)}`}>{pct(m.annualized)}</td>
                <td className={`${td} ${row.breakIsEstimate ? "text-est" : signClass(m.downside)}`}>
                  {pct(m.downside)}
                </td>
                <td className={`${td} ${estClass}`}>{breakEvenCell(row)}</td>
                <td className={td}>{closeCell(row)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
