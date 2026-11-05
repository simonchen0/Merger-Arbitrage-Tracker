import { describe, expect, it } from "vitest";
import { validateDeal, validateRumour, type Fields, type RumourFields } from "./validate";

const TODAY = "2026-11-04";

const valid: Fields = {
  targetTicker: "ptc",
  targetName: "PTC Inc.",
  acquirerName: "Schneider Electric",
  offerPrice: "205",
  announceDate: "2026-10-05",
  expectedCloseDate: "2027-09-30",
  unaffectedDate: "",
  breakPrice: "",
  sourceUrl: "",
};

const errorsFor = (changes: Partial<Fields>) => validateDeal({ ...valid, ...changes }, TODAY);

describe("validateDeal", () => {
  it("accepts a complete deal, with optional fields blank", () => {
    expect(errorsFor({})).toEqual({});
  });

  it("accepts all optional fields when valid", () => {
    expect(
      errorsFor({
        unaffectedDate: "2026-10-01",
        breakPrice: "144.03",
        sourceUrl: "https://www.sec.gov/Archives/edgar/data/1/x.htm",
      }),
    ).toEqual({});
  });

  it("requires ticker, names, offer and both dates", () => {
    const e = validateDeal(
      { ...valid, targetTicker: "", targetName: " ", acquirerName: "", offerPrice: "", announceDate: "", expectedCloseDate: "" },
      TODAY,
    );
    expect(Object.keys(e).sort()).toEqual(
      ["acquirerName", "announceDate", "expectedCloseDate", "offerPrice", "targetName", "targetTicker"].sort(),
    );
  });

  it("rejects malformed tickers", () => {
    expect(errorsFor({ targetTicker: "AA PL" }).targetTicker).toBeDefined();
    expect(errorsFor({ targetTicker: "AA;PL" }).targetTicker).toBeDefined();
    expect(errorsFor({ targetTicker: "TOOLONGTICKERSYMBOL" }).targetTicker).toBeDefined();
    expect(errorsFor({ targetTicker: "BRK.B" }).targetTicker).toBeUndefined();
  });

  it("rejects offers that are zero, negative, or not numbers", () => {
    expect(errorsFor({ offerPrice: "0" }).offerPrice).toBeDefined();
    expect(errorsFor({ offerPrice: "-5" }).offerPrice).toBeDefined();
    expect(errorsFor({ offerPrice: "abc" }).offerPrice).toBeDefined();
    expect(errorsFor({ offerPrice: "Infinity" }).offerPrice).toBeDefined();
  });

  it("rejects impossible or future announcement dates", () => {
    expect(errorsFor({ announceDate: "2026-02-30" }).announceDate).toBeDefined();
    expect(errorsFor({ announceDate: "2026-11-05" }).announceDate).toMatch(/future/);
    expect(errorsFor({ announceDate: TODAY }).announceDate).toBeUndefined();
  });

  it("requires the close date to be after the announcement", () => {
    expect(errorsFor({ expectedCloseDate: "2026-10-05" }).expectedCloseDate).toBeDefined();
    expect(errorsFor({ expectedCloseDate: "2026-09-01" }).expectedCloseDate).toBeDefined();
    expect(errorsFor({ expectedCloseDate: "2026-10-06" }).expectedCloseDate).toBeUndefined();
  });

  it("requires the unaffected date, when given, to be a real date before the announcement", () => {
    expect(errorsFor({ unaffectedDate: "2026-10-05" }).unaffectedDate).toBeDefined();
    expect(errorsFor({ unaffectedDate: "2026-10-20" }).unaffectedDate).toBeDefined();
    expect(errorsFor({ unaffectedDate: "not a date" }).unaffectedDate).toBeDefined();
    expect(errorsFor({ unaffectedDate: "2026-10-02" }).unaffectedDate).toBeUndefined();
  });

  it("requires the break price, when given, to be positive and below the offer", () => {
    expect(errorsFor({ breakPrice: "0" }).breakPrice).toBeDefined();
    expect(errorsFor({ breakPrice: "-1" }).breakPrice).toBeDefined();
    expect(errorsFor({ breakPrice: "205" }).breakPrice).toBeDefined();
    expect(errorsFor({ breakPrice: "300" }).breakPrice).toBeDefined();
    expect(errorsFor({ breakPrice: "204.99" }).breakPrice).toBeUndefined();
  });

  it("only accepts http(s) source links", () => {
    expect(errorsFor({ sourceUrl: "javascript:alert(1)" }).sourceUrl).toBeDefined();
    expect(errorsFor({ sourceUrl: "notaurl" }).sourceUrl).toBeDefined();
    expect(errorsFor({ sourceUrl: "ftp://example.com/x" }).sourceUrl).toBeDefined();
    expect(errorsFor({ sourceUrl: "http://example.com/x" }).sourceUrl).toBeUndefined();
  });
});

const validRumour: RumourFields = {
  targetTicker: "abc",
  targetName: "ABC Corp",
  acquirerName: "",
  sourceUrl: "https://www.reuters.com/markets/deals/abc-2026-10-30/",
  reportDate: "2026-10-30",
  reportedPrice: "",
  reportedCloseDate: "",
};

const rumourErrorsFor = (changes: Partial<RumourFields>) => validateRumour({ ...validRumour, ...changes }, TODAY);

describe("validateRumour", () => {
  it("accepts a rumour with only the target, a trusted source and the report date", () => {
    expect(rumourErrorsFor({})).toEqual({});
  });

  it("accepts all optional fields when valid", () => {
    expect(rumourErrorsFor({ acquirerName: "Buyer", reportedPrice: "50", reportedCloseDate: "2027-06-30" })).toEqual({});
  });

  it("requires a ticker and a company name", () => {
    expect(rumourErrorsFor({ targetTicker: "" }).targetTicker).toBeDefined();
    expect(rumourErrorsFor({ targetTicker: "A B" }).targetTicker).toBeDefined();
    expect(rumourErrorsFor({ targetName: "  " }).targetName).toBeDefined();
  });

  it("requires a source link from a trusted publisher", () => {
    expect(rumourErrorsFor({ sourceUrl: "" }).sourceUrl).toMatch(/Required/);
    expect(rumourErrorsFor({ sourceUrl: "https://www.example.com/x" }).sourceUrl).toMatch(/Reuters/);
    expect(rumourErrorsFor({ sourceUrl: "https://finance.yahoo.com/news/x.html" }).sourceUrl).toBeDefined();
    expect(rumourErrorsFor({ sourceUrl: "https://reuters.com.evil.io/x" }).sourceUrl).toBeDefined();
    expect(rumourErrorsFor({ sourceUrl: "https://www.wsj.com/business/deals/x" }).sourceUrl).toBeUndefined();
  });

  it("requires a valid report date that isn't in the future", () => {
    expect(rumourErrorsFor({ reportDate: "" }).reportDate).toBeDefined();
    expect(rumourErrorsFor({ reportDate: "2026-02-30" }).reportDate).toBeDefined();
    expect(rumourErrorsFor({ reportDate: "2026-11-05" }).reportDate).toBeDefined();
    expect(rumourErrorsFor({ reportDate: TODAY }).reportDate).toBeUndefined();
  });

  it("requires the reported price, when given, to be above 0", () => {
    expect(rumourErrorsFor({ reportedPrice: "0" }).reportedPrice).toBeDefined();
    expect(rumourErrorsFor({ reportedPrice: "-5" }).reportedPrice).toBeDefined();
    expect(rumourErrorsFor({ reportedPrice: "abc" }).reportedPrice).toBeDefined();
    expect(rumourErrorsFor({ reportedPrice: "49.5" }).reportedPrice).toBeUndefined();
  });

  it("requires the reported close date, when given, to be valid and after the report", () => {
    expect(rumourErrorsFor({ reportedCloseDate: "soon" }).reportedCloseDate).toBeDefined();
    expect(rumourErrorsFor({ reportedCloseDate: "2026-10-30" }).reportedCloseDate).toBeDefined();
    expect(rumourErrorsFor({ reportedCloseDate: "2026-10-31" }).reportedCloseDate).toBeUndefined();
  });
});
