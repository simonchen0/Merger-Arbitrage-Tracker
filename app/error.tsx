"use client";

import Link from "next/link";

export default function ErrorPage({ retry }: { error: unknown; retry: () => void }) {
  return (
    <div className="space-y-3 py-20 text-center">
      <p className="text-lg font-semibold">Something went wrong</p>
      <p className="text-sm text-muted">The page hit an unexpected error. Your saved deals are not affected.</p>
      <div className="flex justify-center gap-3 text-sm">
        <button onClick={() => retry()} className="rounded border border-border px-3 py-1.5 hover:border-accent hover:text-accent">
          Try again
        </button>
        <Link href="/" className="px-3 py-1.5 text-accent hover:underline">
          ← All deals
        </Link>
      </div>
    </div>
  );
}
