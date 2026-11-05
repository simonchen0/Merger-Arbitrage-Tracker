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
