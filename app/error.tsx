"use client";

import Link from "next/link";
import { buttonClass, EmptyState } from "@/components/ui";

export default function ErrorPage({ retry }: { error: unknown; retry: () => void }) {
  return (
    <EmptyState
      title="Something went wrong"
      actions={
        <>
          <button onClick={() => retry()} className={buttonClass("primary", "md")}>
            Try again
          </button>
          <Link href="/" className={buttonClass("secondary", "md")}>
            Back to deals
          </Link>
        </>
      }
    >
      The page hit an unexpected error. Your saved deals are not affected.
    </EmptyState>
  );
}
