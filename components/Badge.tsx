const styles = {
  demo: "border-accent/40 bg-accent/10 text-accent",
  est: "border-est/40 bg-est/10 text-est",
};

export function Badge({ kind, title }: { kind: keyof typeof styles; title?: string }) {
  return (
    <span
      title={title}
      className={`inline-block rounded border px-1 py-px font-mono text-[10px] font-semibold leading-none tracking-wider ${styles[kind]}`}
    >
      {kind.toUpperCase()}
    </span>
  );
}
