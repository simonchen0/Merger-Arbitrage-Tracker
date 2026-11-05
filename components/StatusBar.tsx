"use client";

import { resetDeals } from "@/lib/deals";
import { useRumours } from "@/lib/rumours";
import { Badge } from "./Badge";

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
          <Badge kind="est" /> uses the estimated break price
        </span>
        {hasRumours && (
          <span className="hidden shrink-0 items-center gap-2 lg:flex">
            <Badge kind="ind" /> based on unconfirmed reported terms
          </span>
        )}
        <span className="hidden shrink-0 xl:inline">Ann. return = spread % × 365 / days to close</span>

        <button onClick={handleReset} className="ml-auto shrink-0 transition-colors hover:text-text">
          Reset to the starting deals
        </button>
      </div>
    </footer>
  );
}
