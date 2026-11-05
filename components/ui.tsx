// Shared styling helpers, so buttons and cards look the same everywhere.
// Class-string helpers (not wrapper components) keep the markup at each call site plain.

/** Surface for a section or panel. */
export function cardClass(extra = ""): string {
  return `rounded-2xl border border-border bg-panel ${extra}`.trim();
}

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const base =
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-medium " +
  "transition-[color,background-color,border-color,filter,transform] duration-150 " +
  "active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100";

const sizes: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
};

const variants: Record<Variant, string> = {
  // The one loud action on a screen.
  primary: "bg-accent-strong text-white hover:brightness-110",
  secondary: "border border-border bg-panel-2 text-text hover:border-accent/60 hover:text-accent disabled:hover:border-border disabled:hover:text-text",
  ghost: "text-muted hover:bg-panel-2 hover:text-text",
  // Destructive actions stay quiet until hovered.
  danger: "border border-border bg-panel-2 text-muted hover:border-down/60 hover:text-down",
};

export function buttonClass(variant: Variant = "secondary", size: Size = "sm"): string {
  return `${base} ${sizes[size]} ${variants[variant]}`;
}

/** Two chevrons; the one for the active sort direction is solid, the other faded. */
export function SortIcon({ dir }: { dir: "asc" | "desc" | null }) {
  return (
    <svg aria-hidden viewBox="0 0 8 12" className="h-3 w-2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 4.5 4 1.5l3 3" opacity={dir === "asc" ? 1 : 0.3} />
      <path d="M1 7.5l3 3 3-3" opacity={dir === "desc" ? 1 : 0.3} />
    </svg>
  );
}

export function PencilIcon({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m4 16 .7-3.2L13 4.5a1.5 1.5 0 0 1 2.1 0l.4.4a1.5 1.5 0 0 1 0 2.1l-8.3 8.3L4 16Z" />
      <path d="m12 5.5 2.5 2.5" />
    </svg>
  );
}

export function TrashIcon({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4 6h12M8 6V4.5h4V6M5.5 6l.7 9.2a1 1 0 0 0 1 .8h5.6a1 1 0 0 0 1-.8L14.5 6M8.5 9v4M11.5 9v4" />
    </svg>
  );
}

export function CloseIcon({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className={className}>
      <path d="m5.5 5.5 9 9M14.5 5.5l-9 9" />
    </svg>
  );
}

/** One look for every "nothing here" screen: no deals, deal not found, 404, error. */
export function EmptyState({
  title,
  children,
  actions,
}: {
  title: string;
  children?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className={cardClass("px-6 py-14 text-center")}>
      <h2 className="text-lg font-semibold">{title}</h2>
      {children && <p className="mx-auto mt-1.5 max-w-md text-sm text-muted">{children}</p>}
      {actions && <div className="mt-5 flex flex-wrap items-center justify-center gap-3">{actions}</div>}
    </div>
  );
}
