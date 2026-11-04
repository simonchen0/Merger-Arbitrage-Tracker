"use client";

import { useEffect, useRef, useState } from "react";
import { isValidDate, todayInNewYork } from "@/lib/calc";
import { usd } from "@/lib/format";
import type { Deal, Quote } from "@/lib/types";
import { fetchUnaffectedPrice } from "@/lib/useMarketData";

type Fields = {
  targetTicker: string;
  targetName: string;
  acquirerName: string;
  offerPrice: string;
  announceDate: string;
  expectedCloseDate: string;
  breakPrice: string;
  sourceUrl: string;
};
type Errors = Partial<Record<keyof Fields, string>>;

type TickerCheck =
  | { status: "idle" | "checking" | "missing" | "error"; ticker: string }
  | { status: "ok"; ticker: string; quote: Quote };

const SYMBOL_RE = /^[A-Z0-9.\-^=]{1,15}$/;

function toFields(deal: Deal | null): Fields {
  return {
    targetTicker: deal?.targetTicker ?? "",
    targetName: deal?.targetName ?? "",
    acquirerName: deal?.acquirerName ?? "",
    offerPrice: deal ? String(deal.offerPrice) : "",
    announceDate: deal?.announceDate ?? "",
    expectedCloseDate: deal?.expectedCloseDate ?? "",
    breakPrice: deal?.breakPrice !== undefined ? String(deal.breakPrice) : "",
    sourceUrl: deal?.sourceUrl ?? "",
  };
}

function validate(f: Fields, today: string): Errors {
  const e: Errors = {};
  const ticker = f.targetTicker.trim().toUpperCase();
  const offer = Number(f.offerPrice);

  if (!SYMBOL_RE.test(ticker)) e.targetTicker = "Enter a ticker, e.g. ABC";
  if (!f.targetName.trim()) e.targetName = "Required";
  if (!f.acquirerName.trim()) e.acquirerName = "Required";
  if (!f.offerPrice.trim() || !Number.isFinite(offer) || offer <= 0) e.offerPrice = "Enter a cash price per share above 0";

  if (!isValidDate(f.announceDate)) e.announceDate = "Enter a valid date";
  else if (f.announceDate > today) e.announceDate = "Announcement can't be in the future";

  if (!isValidDate(f.expectedCloseDate)) e.expectedCloseDate = "Enter a valid date";
  else if (isValidDate(f.announceDate) && f.expectedCloseDate <= f.announceDate)
    e.expectedCloseDate = "Must be after the announcement date";

  if (f.breakPrice.trim()) {
    const b = Number(f.breakPrice);
    if (!Number.isFinite(b) || b <= 0) e.breakPrice = "Enter a price above 0, or leave blank";
    else if (Number.isFinite(offer) && offer > 0 && b >= offer) e.breakPrice = "Break price should be below the offer";
  }

  if (f.sourceUrl.trim() && !/^https?:\/\/\S+$/i.test(f.sourceUrl.trim())) e.sourceUrl = "Enter a full http(s) link";
  return e;
}

async function lookupTicker(ticker: string): Promise<TickerCheck> {
  try {
    const res = await fetch(`/api/quotes?symbols=${encodeURIComponent(ticker)}`);
    if (!res.ok) return { status: "error", ticker };
    const body: { quotes: Quote[] } = await res.json();
    const quote = body.quotes.find((q) => q.symbol === ticker);
    return quote ? { status: "ok", ticker, quote } : { status: "missing", ticker };
  } catch {
    return { status: "error", ticker };
  }
}

export function DealForm({
  deal,
  onSave,
  onClose,
}: {
  deal: Deal | null; // null = new deal
  onSave: (deal: Deal) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [fields, setFields] = useState<Fields>(() => toFields(deal));
  const [errors, setErrors] = useState<Errors>({});
  const [check, setCheck] = useState<TickerCheck>({ status: "idle", ticker: "" });
  const [suggestedBreak, setSuggestedBreak] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const isDemo = deal?.isDemo ?? false;

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  // Editing a field clears its error until the next submit.
  function update(key: keyof Fields, value: string) {
    setFields((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }
  const set = (key: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement>) => update(key, e.target.value);

  async function checkTicker(): Promise<TickerCheck> {
    const ticker = fields.targetTicker.trim().toUpperCase();
    if (isDemo || !SYMBOL_RE.test(ticker)) return { status: "idle", ticker };
    if (check.ticker === ticker && check.status !== "checking") return check;

    setCheck({ status: "checking", ticker });
    const result = await lookupTicker(ticker);
    setCheck(result);
    if (result.status === "ok" && !fields.targetName.trim() && result.quote.name) {
      update("targetName", result.quote.name);
    }
    if (result.status === "ok") void suggestBreak(ticker, fields.announceDate);
    return result;
  }

  async function suggestBreak(ticker: string, announceDate: string) {
    if (isDemo || !isValidDate(announceDate)) return;
    setSuggestedBreak(await fetchUnaffectedPrice(ticker, announceDate));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const found = validate(fields, todayInNewYork());
    setErrors(found);
    if (Object.keys(found).length) return;

    setSaving(true);
    const result = await checkTicker();
    setSaving(false);
    if (result.status === "missing") {
      setErrors({ targetTicker: `No market data found for ${result.ticker}` });
      return;
    }
    // If Yahoo is down ("error"), allow saving: the price will show as unavailable.

    const breakPrice = fields.breakPrice.trim() ? Number(fields.breakPrice) : undefined;
    const sourceUrl = fields.sourceUrl.trim() || undefined;
    onSave({
      id: deal?.id ?? crypto.randomUUID(),
      isDemo,
      targetTicker: fields.targetTicker.trim().toUpperCase(),
      targetName: fields.targetName.trim(),
      acquirerName: fields.acquirerName.trim(),
      offerPrice: Number(fields.offerPrice),
      announceDate: fields.announceDate,
      expectedCloseDate: fields.expectedCloseDate,
      ...(breakPrice !== undefined && { breakPrice }),
      ...(sourceUrl && { sourceUrl }),
    });
  }

  const tickerHint =
    check.status === "checking"
      ? { cls: "text-muted", text: "Checking…" }
      : check.status === "ok"
        ? { cls: "text-up", text: `✓ ${check.quote.name ?? check.ticker} · ${usd(check.quote.price)}` }
        : check.status === "missing"
          ? { cls: "text-down", text: `No market data found for ${check.ticker}` }
          : check.status === "error"
            ? { cls: "text-est", text: "Couldn't reach price data; you can still save" }
            : null;

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="m-auto w-[min(640px,calc(100vw-2rem))] rounded border border-border bg-panel p-0 text-text backdrop:bg-black/70"
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-5 p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-semibold">{deal ? "Edit deal" : "Add deal"}</h2>
          <span className="text-xs text-muted">All-cash deals · terms from the press release or 8-K</span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Target ticker" error={errors.targetTicker} hint={!isDemo ? tickerHint : null}>
            <input
              value={fields.targetTicker}
              onChange={(e) => update("targetTicker", e.target.value.toUpperCase())}
              onBlur={() => void checkTicker()}
              placeholder="ABC"
              autoFocus
              disabled={isDemo}
              className={`${inputCls} font-mono uppercase`}
            />
          </Field>
          <Field label="Target company" error={errors.targetName}>
            <input value={fields.targetName} onChange={set("targetName")} placeholder="Filled in from ticker" className={inputCls} />
          </Field>
          <Field label="Acquirer" error={errors.acquirerName}>
            <input value={fields.acquirerName} onChange={set("acquirerName")} className={inputCls} />
          </Field>
          <Field label="Cash offer per share ($)" error={errors.offerPrice}>
            <input type="number" step="0.01" min="0" value={fields.offerPrice} onChange={set("offerPrice")} className={`${inputCls} num`} />
          </Field>
          <Field label="Announcement date" error={errors.announceDate}>
            <input
              type="date"
              value={fields.announceDate}
              onChange={set("announceDate")}
              onBlur={() => check.status === "ok" && void suggestBreak(check.ticker, fields.announceDate)}
              className={`${inputCls} num`}
            />
          </Field>
          <Field label="Expected close date" error={errors.expectedCloseDate}>
            <input type="date" value={fields.expectedCloseDate} onChange={set("expectedCloseDate")} className={`${inputCls} num`} />
          </Field>
          <Field
            label="Break price ($, optional)"
            error={errors.breakPrice}
            hint={{
              cls: "text-est",
              text:
                suggestedBreak !== null
                  ? `Blank = unaffected price ${usd(suggestedBreak)} (EST)`
                  : "Blank = unaffected price before announcement (EST)",
            }}
          >
            <input type="number" step="0.01" min="0" value={fields.breakPrice} onChange={set("breakPrice")} className={`${inputCls} num`} />
          </Field>
          <Field label="Source link (optional)" error={errors.sourceUrl}>
            <input type="url" value={fields.sourceUrl} onChange={set("sourceUrl")} placeholder="https://…" className={inputCls} />
          </Field>
        </div>

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <button type="button" onClick={onClose} className="rounded border border-border px-4 py-1.5 text-sm text-muted hover:text-text">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded border border-accent bg-accent/15 px-4 py-1.5 text-sm text-accent hover:bg-accent/25 disabled:opacity-50"
          >
            {saving ? "Checking ticker…" : deal ? "Save changes" : "Add deal"}
          </button>
        </div>
      </form>
    </dialog>
  );
}

const inputCls =
  "w-full rounded border border-border bg-bg px-2.5 py-1.5 text-sm outline-none focus:border-accent disabled:opacity-60 [color-scheme:dark]";

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: { cls: string; text: string } | null;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs text-muted">{label}</span>
      {children}
      {error ? (
        <span className="block text-xs text-down">{error}</span>
      ) : hint ? (
        <span className={`block text-xs ${hint.cls}`}>{hint.text}</span>
      ) : null}
    </label>
  );
}
