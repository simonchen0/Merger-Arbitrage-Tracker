import Link from "next/link";
import { buttonClass, EmptyState } from "@/components/ui";

export default function NotFound() {
  return (
    <EmptyState
      title="Page not found"
      actions={
        <Link href="/" className={buttonClass("primary", "md")}>
          Back to deals
        </Link>
      }
    >
      That page doesn&apos;t exist.
    </EmptyState>
  );
}
