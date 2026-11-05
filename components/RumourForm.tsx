"use client";

import { useEffect, useRef, useState } from "react";
import { todayInNewYork } from "@/lib/calc";
import { usd } from "@/lib/format";
import { isSharedTicker } from "@/lib/rumours";
import { isKnownPublisher, publisherFor } from "@/lib/sources";
import type { Rumour } from "@/lib/types";
import { SYMBOL_RE, validateRumour, type RumourErrors, type RumourFields } from "@/lib/validate";
import { Field, inputCls, lookupTicker, newId, type TickerCheck } from "./DealForm";
import { buttonClass, CloseIcon } from "./ui";

function toFields(r: Rumour | null): RumourFields {
  return {
    targetTicker: r?.targetTicker ?? "",
    targetName: r?.targetName ?? "",
    acquirerName: r?.acquirerName ?? "",
    sourceUrl: r?.sourceUrl ?? "",
    reportDate: r?.reportDate ?? "",
    reportedPrice: r?.reportedPrice !== undefined ? String(r.reportedPrice) : "",
    reportedCloseDate: r?.reportedCloseDate ?? "",
  };
}

/** Add/edit dialog for a rumoured deal. Only what the report states is entered; the rest stays blank. */
export function RumourForm({
  rumour,
  onSave,
  onClose,
}: {
  rumour: Rumour | null; // null = new rumour
  onSave: (rumour: Rumour) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [fields, setFields] = useState<RumourFields>(() => toFields(rumour));
  const [errors, setErrors] = useState<RumourErrors>({});
  const [check, setCheck] = useState<TickerCheck>({ status: "idle", ticker: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  // Editing a field clears its error until the next submit.
  function update(key: keyof RumourFields, value: string) {
    setFields((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }
  const set = (key: keyof RumourFields) => (e: React.ChangeEvent<HTMLInputElement>) => update(key, e.target.value);

  async function checkTicker(): Promise<TickerCheck> {
    const ticker = fields.targetTicker.trim().toUpperCase();
    if (!SYMBOL_RE.test(ticker)) return { status: "idle", ticker };
    if (check.ticker === ticker && check.status !== "checking") return check;

    setCheck({ status: "checking", ticker });
    const result = await lookupTicker(ticker);
    setCheck(result);
    if (result.status === "ok" && !fields.targetName.trim() && result.quote.name) {
      update("targetName", result.quote.name);
    }
    return result;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const found = validateRumour(fields, todayInNewYork());
    setErrors(found);
    if (Object.keys(found).length) return;

    // A shared rumour for the same company is always shown instead of a visitor's own, so a new row
    // would silently never appear.
    if (!rumour && isSharedTicker(fields.targetTicker.trim())) {
      setErrors({ targetTicker: `${fields.targetTicker.trim().toUpperCase()} is already tracked` });
      return;
    }

    setSaving(true);
    const result = await checkTicker();
    setSaving(false);
    if (result.status === "missing") {
      setErrors({ targetTicker: `No market data found for ${result.ticker}` });
      return;
    }
    // If Yahoo is down ("error"), allow saving: the price will show as unavailable.

    const acquirerName = fields.acquirerName.trim() || undefined;
    const reportedPrice = fields.reportedPrice.trim() ? Number(fields.reportedPrice) : undefined;
    const reportedCloseDate = fields.reportedCloseDate.trim() || undefined;
    onSave({
      id: rumour?.id ?? newId(),
      targetTicker: fields.targetTicker.trim().toUpperCase(),
      targetName: fields.targetName.trim(),
      sourceUrl: fields.sourceUrl.trim(),
      reportDate: fields.reportDate,
      ...(acquirerName && { acquirerName }),
      ...(reportedPrice !== undefined && { reportedPrice }),
      ...(reportedCloseDate && { reportedCloseDate }),
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

  const publisher = publisherFor(fields.sourceUrl);
  const sourceHint = !publisher
    ? { cls: "text-muted", text: "Link to the news article, not social media" }
    : isKnownPublisher(fields.sourceUrl)
      ? { cls: "text-up", text: `✓ ${publisher}` }
      : { cls: "text-est", text: `${publisher}: not a major outlet, so check it's credible` };

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="dialog-in m-auto w-[min(640px,calc(100vw-2rem))] rounded-2xl border border-border bg-panel p-0 text-text shadow-2xl shadow-black/60 backdrop:bg-black/70 backdrop:backdrop-blur-sm"
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-5 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">{rumour ? "Edit rumour" : "Add rumour"}</h2>
            <p className="mt-0.5 text-xs text-muted">Reported, not announced · enter only what the report states</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-panel-2 hover:text-text"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Target ticker" error={errors.targetTicker} hint={tickerHint}>
            <input
              value={fields.targetTicker}
              onChange={(e) => update("targetTicker", e.target.value.toUpperCase())}
              onBlur={() => void checkTicker()}
              placeholder="ABC"
              autoFocus
              className={`${inputCls} font-mono uppercase`}
            />
          </Field>
          <Field label="Target company" error={errors.targetName}>
            <input value={fields.targetName} onChange={set("targetName")} placeholder="Filled in from ticker" className={inputCls} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Source link" error={errors.sourceUrl} hint={sourceHint}>
              <input type="url" value={fields.sourceUrl} onChange={set("sourceUrl")} placeholder="https://…" className={inputCls} />
            </Field>
          </div>
          <Field label="Report date" error={errors.reportDate}>
            <input type="date" value={fields.reportDate} onChange={set("reportDate")} className={`${inputCls} num`} />
          </Field>
          <Field
            label="Potential acquirer (optional)"
            error={errors.acquirerName}
            hint={{ cls: "text-muted", text: "Only if the report names one" }}
          >
            <input value={fields.acquirerName} onChange={set("acquirerName")} className={inputCls} />
          </Field>
          <Field
            label="Reported price ($, optional)"
            error={errors.reportedPrice}
            hint={{ cls: "text-muted", text: "Only a per-share cash price stated in the report" }}
          >
            <input type="number" step="0.01" min="0" value={fields.reportedPrice} onChange={set("reportedPrice")} className={`${inputCls} num`} />
          </Field>
          <Field
            label="Reported close date (optional)"
            error={errors.reportedCloseDate}
            hint={{ cls: "text-muted", text: "Only if the report gives a timeframe" }}
          >
            <input type="date" value={fields.reportedCloseDate} onChange={set("reportedCloseDate")} className={`${inputCls} num`} />
          </Field>
        </div>

        {/* Pinned to the bottom of the dialog so it stays reachable on short screens */}
        <div className="sticky bottom-0 -mx-5 -mb-5 flex justify-end gap-2 border-t border-border bg-panel px-5 py-4">
          <button type="button" onClick={onClose} className={buttonClass("ghost", "md")}>
            Cancel
          </button>
          <button type="submit" disabled={saving} className={buttonClass("primary", "md")}>
            {saving ? "Checking ticker…" : rumour ? "Save changes" : "Add rumour"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
