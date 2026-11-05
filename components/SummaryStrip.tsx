import Link from "next/link";
import type { DealSummary } from "@/lib/dealRow";
import { pct, signClass } from "@/lib/format";
import { Badge } from "./Badge";
import { cardClass } from "./ui";

function Stat({ label, children, sub }: { label: string; children: React.ReactNode; sub: React.ReactNode }) {
  return (
    <div className={cardClass("p-4")}>
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted">{label}</div>
      <div className="num mt-1.5 text-2xl font-semibold">{children}</div>
      <div className="mt-1 text-xs text-muted">{sub}</div>
    </div>
  );
}

/** Four headline numbers across the tracked deals. */
export function SummaryStrip({ summary, loading }: { summary: DealSummary; loading: boolean }) {
  const { dealCount, pricedCount, medianAnnualized, widest, medianBreakEven, breakEvenIsEstimate } = summary;

  return (
    <section aria-label="Summary of deals" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Stat label="Deals tracked" sub={loading ? "loading prices…" : `${pricedCount} with a market price`}>
        {dealCount}
      </Stat>

      <Stat label="Median annualized return" sub="if every deal closes on schedule">
        <span className={signClass(medianAnnualized)}>{pct(medianAnnualized)}</span>
      </Stat>

      <Stat
        label="Widest spread"
        sub={
          widest ? (
            <Link href={`/deals/${widest.id}`} className="font-mono text-accent hover:underline">
              {widest.ticker}
            </Link>
          ) : (
            "no priced deals"
          )
        }
      >
        <span className={signClass(widest?.spreadPct)}>{pct(widest?.spreadPct)}</span>
      </Stat>

      <Stat label="Median implied completion" sub="what the market prices in">
        <span className="inline-flex items-center gap-2">
          <span className={breakEvenIsEstimate ? "text-est" : ""}>{pct(medianBreakEven, "—", 1)}</span>
          {breakEvenIsEstimate && <Badge kind="est" title="Uses the estimated break price" />}
        </span>
      </Stat>
    </section>
  );
}
