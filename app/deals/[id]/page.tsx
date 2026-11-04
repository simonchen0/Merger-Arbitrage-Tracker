import { Suspense } from "react";
import { DealDetail } from "@/components/DealDetail";

// Deals live in the browser, so the id is only known at request time.
// With Cache Components, reading params must happen inside a Suspense boundary.
export default function DealPage({ params }: PageProps<"/deals/[id]">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
      {params.then(({ id }) => (
        <DealDetail id={id} />
      ))}
    </Suspense>
  );
}
