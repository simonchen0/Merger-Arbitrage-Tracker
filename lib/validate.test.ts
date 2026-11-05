import { describe, expect, it } from "vitest";
import { validateDeal, type Fields } from "./validate";

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
