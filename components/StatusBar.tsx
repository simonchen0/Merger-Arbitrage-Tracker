"use client";

import { DEALS_AS_OF, resetDeals } from "@/lib/deals";
import { useRumours } from "@/lib/rumours";
import { Badge } from "./Badge";

// "2026-11-05" → "Nov 5, 2026" (UTC, so the date doesn't shift with the viewer's time zone)
const asOf = new Date(`${DEALS_AS_OF}T00:00:00Z`).toLocaleDateString("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

/** Persistent bottom bar: where the data comes from, what the badges mean, and reset. */
export function StatusBar() {
  const hasRumours = (useRumours()?.length ?? 0) > 0;

  function handleReset() {
    if (confirm("Replace all deals with the starting deals? Deals you added or edited will be lost.")) resetDeals();
  }

  return (
    <footer className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-bg/85 backdrop-blur">
      <div className="mx-auto flex h-10 max-w-[88rem] items-center gap-x-5 overflow-hidden px-4 text-xs text-muted">
        <span className="flex shrink-0 items-center gap-2">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-up shadow-[0_0_6px_var(--up)]" />
          <span>
            Yahoo Finance<span className="hidden sm:inline"> · delayed ~15 min</span>
          </span>
        </span>

        <span className="hidden shrink-0 items-center gap-2 md:flex">
          <Badge kind="est" /> estimated break price
        </span>
        {hasRumours && (
          <span className="hidden shrink-0 items-center gap-2 lg:flex">
            <Badge kind="ind" /> unconfirmed reported terms
          </span>
        )}

        <span className="hidden shrink-0 lg:inline" title="When the deal terms were last checked against company filings">
          Deal terms as of {asOf}
        </span>

        <button onClick={handleReset} className="ml-auto shrink-0 transition-colors hover:text-text">
          Reset to the starting deals
        </button>
      </div>
    </footer>
  );
}
