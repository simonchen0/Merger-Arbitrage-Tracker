const kinds = {
  // An estimate (the default break price and anything derived from it).
  est: { label: "EST", cls: "border-est/40 bg-est/10 text-est" },
  // Computed from terms reported in the press, not agreed ones. Amber like EST: both are estimates.
  ind: { label: "INDICATIVE", cls: "border-est/40 bg-est/10 text-est" },
  // A deal that has been reported but not announced.
  rumour: { label: "UNCONFIRMED", cls: "border-muted/50 bg-panel-2 text-muted" },
};

export function Badge({ kind, title }: { kind: keyof typeof kinds; title?: string }) {
  const { label, cls } = kinds[kind];
  return (
    <span
      title={title}
      className={`inline-block rounded border px-1 py-px font-mono text-[10px] font-semibold leading-none tracking-wider ${cls}`}
    >
      {label}
    </span>
  );
}
