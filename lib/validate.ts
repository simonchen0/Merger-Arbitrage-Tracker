// Validation for the add/edit deal form. Pure functions, so they can be tested without React.
import { isValidDate } from "./calc";
import { publisherFor, TRUSTED_PUBLISHER_NAMES } from "./sources";

/** Form values as typed: everything is a string until the form is submitted. */
export type Fields = {
  targetTicker: string;
  targetName: string;
  acquirerName: string;
  offerPrice: string;
  announceDate: string;
  expectedCloseDate: string;
  unaffectedDate: string;
  breakPrice: string;
  sourceUrl: string;
};
export type Errors = Partial<Record<keyof Fields, string>>;

export const SYMBOL_RE = /^[A-Z0-9.\-^=]{1,15}$/;

/** Returns an error message per invalid field (empty object = valid). `today` is YYYY-MM-DD. */
export function validateDeal(f: Fields, today: string): Errors {
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

  if (f.unaffectedDate.trim()) {
    if (!isValidDate(f.unaffectedDate)) e.unaffectedDate = "Enter a valid date, or leave blank";
    else if (isValidDate(f.announceDate) && f.unaffectedDate >= f.announceDate)
      e.unaffectedDate = "Must be before the announcement date";
  }

  if (f.breakPrice.trim()) {
    const b = Number(f.breakPrice);
    if (!Number.isFinite(b) || b <= 0) e.breakPrice = "Enter a price above 0, or leave blank";
    else if (Number.isFinite(offer) && offer > 0 && b >= offer) e.breakPrice = "Break price should be below the offer";
  }

  if (f.sourceUrl.trim() && !/^https?:\/\/\S+$/i.test(f.sourceUrl.trim())) e.sourceUrl = "Enter a full http(s) link";
  return e;
}

/** Add/edit rumour form values, as typed. */
export type RumourFields = {
  targetTicker: string;
  targetName: string;
  acquirerName: string;
  sourceUrl: string;
  reportDate: string;
  reportedPrice: string;
  reportedCloseDate: string;
};
export type RumourErrors = Partial<Record<keyof RumourFields, string>>;

/**
 * Returns an error message per invalid field (empty object = valid). Only the target, a trusted
 * source link and the report date are required: terms a report doesn't state stay blank.
 */
export function validateRumour(f: RumourFields, today: string): RumourErrors {
  const e: RumourErrors = {};

  if (!SYMBOL_RE.test(f.targetTicker.trim().toUpperCase())) e.targetTicker = "Enter a ticker, e.g. ABC";
  if (!f.targetName.trim()) e.targetName = "Required";

  if (!f.sourceUrl.trim()) e.sourceUrl = "Required: a link to the original report";
  else if (!publisherFor(f.sourceUrl)) e.sourceUrl = `Use a link from ${TRUSTED_PUBLISHER_NAMES}`;

  if (!isValidDate(f.reportDate)) e.reportDate = "Enter a valid date";
  else if (f.reportDate > today) e.reportDate = "Report date can't be in the future";

  if (f.reportedPrice.trim()) {
    const p = Number(f.reportedPrice);
    if (!Number.isFinite(p) || p <= 0) e.reportedPrice = "Enter a price above 0, or leave blank";
  }

  if (f.reportedCloseDate.trim()) {
    if (!isValidDate(f.reportedCloseDate)) e.reportedCloseDate = "Enter a valid date, or leave blank";
    else if (isValidDate(f.reportDate) && f.reportedCloseDate <= f.reportDate)
      e.reportedCloseDate = "Must be after the report date";
  }
  return e;
}
