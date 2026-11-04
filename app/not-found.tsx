import Link from "next/link";

export default function NotFound() {
  return (
    <div className="space-y-3 py-20 text-center">
      <p className="num text-4xl font-semibold text-muted">404</p>
      <p className="text-sm text-muted">That page doesn&apos;t exist.</p>
      <Link href="/" className="inline-block text-sm text-accent hover:underline">
        ← All deals
      </Link>
    </div>
  );
}
