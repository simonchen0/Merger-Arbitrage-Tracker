"use client";

import { Area, AreaChart, CartesianGrid, ReferenceLine, Tooltip, XAxis, YAxis } from "recharts";
import type { SpreadPoint } from "@/lib/calc";
import { pct, usd } from "@/lib/format";

// Chart colors follow the app theme (app/globals.css). Single series, so no legend:
// the section title names it. Grid and axes are recessive solid hairlines, and the line gets
// a soft wash of the same color that fades toward the zero line.
const LINE = "var(--accent)";
const GRID = "var(--border)";
const AXIS_TEXT = "var(--muted)";
const ZERO = "var(--muted)";

/** Clean y-axis ticks (steps of 1, 2, or 5 × 10ⁿ) covering [min, max], always including 0. */
function niceTicks(min: number, max: number): { ticks: number[]; digits: number } {
  const lo0 = Math.min(0, min);
  const hi0 = Math.max(0, max);
  const rough = (hi0 - lo0 || 0.01) / 4;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= rough)!;
  const lo = Math.floor(lo0 / step);
  const hi = Math.ceil(hi0 / step);
  const ticks = Array.from({ length: hi - lo + 1 }, (_, i) => Number(((lo + i) * step).toFixed(10)));
  // Decimal places needed to show the step in percent (2% → 0, 0.5% → 1)
  const digits = Math.max(0, -Math.floor(Math.log10(step * 100) + 1e-9));
  return { ticks, digits };
}

function shortDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function longDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: SpreadPoint }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-xl border border-border bg-panel-2 px-3 py-2 text-xs shadow-lg shadow-black/40">
      {/* Value leads, label follows */}
      <div className="num text-sm font-semibold text-text">{pct(p.spreadPct)}</div>
      <div className="text-muted">spread · close {usd(p.close)}</div>
      <div className="text-muted">{longDate(p.date)}</div>
    </div>
  );
}

export function SpreadChart({ points }: { points: SpreadPoint[] }) {
  if (points.length < 2) {
    return <p className="py-10 text-center text-sm text-muted">Not enough trading days since the announcement to chart yet.</p>;
  }

  const last = points[points.length - 1];
  const values = points.map((p) => p.spreadPct);
  // 0 is always on the axis so the reader can see whether the target trades above or below the offer.
  const { ticks, digits } = niceTicks(Math.min(...values), Math.max(...values));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-xs text-muted">
          (Offer − close) / close, daily since announcement · Yahoo Finance daily closes
        </div>
        <div className="text-xs text-muted">
          Latest <span className="num text-sm text-text">{pct(last.spreadPct)}</span> on {shortDate(last.date)}
        </div>
      </div>

      <AreaChart
        responsive
        data={points}
        margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
        style={{ width: "100%", height: 280 }}
        accessibilityLayer
      >
        <defs>
          <linearGradient id="spread-wash" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={LINE} stopOpacity={0.2} />
            <stop offset="100%" stopColor={LINE} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={GRID} strokeWidth={1} />
        <XAxis
          dataKey="date"
          tickFormatter={shortDate}
          minTickGap={40}
          tick={{ fill: AXIS_TEXT, fontSize: 11 }}
          axisLine={{ stroke: GRID }}
          tickLine={false}
        />
        <YAxis
          domain={[ticks[0], ticks[ticks.length - 1]]}
          ticks={ticks}
          interval={0}
          tickFormatter={(v: number) => pct(v, "", digits)}
          tick={{ fill: AXIS_TEXT, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={52}
        />
        <ReferenceLine y={0} stroke={ZERO} strokeWidth={1} />
        <Tooltip content={<ChartTooltip />} cursor={{ stroke: AXIS_TEXT, strokeWidth: 1 }} isAnimationActive={false} />
        <Area
          type="linear"
          dataKey="spreadPct"
          baseValue={0}
          stroke={LINE}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          fill="url(#spread-wash)"
          isAnimationActive={false}
          // Mark only the latest point; the header carries its value.
          dot={(props: { cx?: number; cy?: number; index?: number }) =>
            props.index === points.length - 1 ? (
              <circle key="last" cx={props.cx} cy={props.cy} r={4} fill={LINE} stroke="var(--panel)" strokeWidth={2} />
            ) : (
              <g key={props.index} />
            )
          }
          activeDot={{ r: 4, fill: LINE, stroke: "var(--panel)", strokeWidth: 2 }}
        />
      </AreaChart>

      {/* Table view: every value is reachable without hovering */}
      <details className="group text-xs">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-muted transition-colors hover:text-text [&::-webkit-details-marker]:hidden">
          <svg aria-hidden viewBox="0 0 8 12" className="h-3 w-2 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="m2 2 4 4-4 4" />
          </svg>
          View data ({points.length} days)
        </summary>
        <div className="mt-2 max-h-64 overflow-y-auto rounded-xl border border-border">
          <table className="w-full">
            <thead className="sticky top-0 bg-panel text-[11px] uppercase tracking-wider text-muted">
              <tr>
                <th className="px-3 py-1.5 text-left font-medium">Date</th>
                <th className="px-3 py-1.5 text-right font-medium">Close</th>
                <th className="px-3 py-1.5 text-right font-medium">Spread</th>
              </tr>
            </thead>
            <tbody className="num">
              {[...points].reverse().map((p) => (
                <tr key={p.date} className="border-t border-border/60">
                  <td className="px-3 py-1">{p.date}</td>
                  <td className="px-3 py-1 text-right">{usd(p.close)}</td>
                  <td className="px-3 py-1 text-right">{pct(p.spreadPct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
