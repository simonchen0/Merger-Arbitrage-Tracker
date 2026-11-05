import { describe, expect, it } from "vitest";
import { isRumourHeadline, newRumoursFromScan, pickCandidates, targetTicker, type NewsItem, type ScanCandidate } from "./rumourScan";

// Headlines below are real Yahoo Finance news items seen on 2026-11-05, with their related tickers.
const NOW = new Date("2026-11-05T15:00:00Z");
const link = (id: string) => `https://finance.yahoo.com/news/${id}.html`;
const item = (title: string, tickers: string[], day: string, id = title.slice(0, 12)): NewsItem => ({
  title,
  publisher: "Test",
  link: link(id),
  providerPublishTime: new Date(`${day}T16:00:00Z`),
  relatedTickers: tickers,
});

const WENDYS = "Wendy’s shares surge 15% on $1.4 billion takeover bid by Nelson Peltz’s Trian Fund";
const XPONENTIAL = "Xponential Fitness shares jump on reports of takeover bid";

describe("isRumourHeadline", () => {
  it("accepts headlines that report open talks, bids or a sale process", () => {
    for (const t of [
      WENDYS,
      XPONENTIAL,
      "Wendy’s receives share takeover bid from investor group",
      "Lionsgate shares spike as Legendary Entertainment revives takeover talks",
      "Delivery Firm Instacart Reportedly Explores Sale Options With Uber, DoorDash",
      "Acme in talks to be taken private",
      "Acme nears deal to be bought by Buyer Co",
    ]) {
      expect(isRumourHeadline(t), t).toBe(true);
    }
  });

  it("rejects deals that are agreed, finished, denied or turned down", () => {
    for (const t of [
      "Acme agrees to takeover bid from Buyer Co",
      "DoorDash announces takeover talks outcome",
      "Perpetual Rejects EQT AB’s Improved Offer, Ends Takeover Talks",
      "HELE Stock On Track For Best Day In Over 25 Years After Rejecting $37 Per Share Takeover Bid",
      "BASF’s $12.5 Billion Takeover Bid for Evonik Rebuffed",
      "Suncorp denies Tokio Marine takeover talks",
      "PayPal Shares Tank After Major Takeover Talks Collapse",
    ]) {
      expect(isRumourHeadline(t), t).toBe(false);
    }
  });

  it("rejects asset or unit sales, employee buyouts, tender-offer notices and roundups", () => {
    for (const t of [
      "Truist explores sale of Afco Credit specialty lending unit - Bloomberg",
      "Chevron Explores Sale Of Older U.S. Gulf Oil And Gas Assets To Focus On Growth",
      "Microsoft’s 60,000-person buyout offer hints at a future with fewer workers",
      "MSFT Stock Gains After Unveiling Massive Buyout Offer For 60,000 Employees",
      "Aldi’s Thanksgiving Deal, Microsoft’s Buyout Offer and More of Today’s Top Money News",
      "Fnac Darty: Takeover bid initiated by EP Group closing date of the tender offer",
      "Tata Motors passes 80% acceptance threshold in Iveco takeover bid",
    ]) {
      expect(isRumourHeadline(t), t).toBe(false);
    }
  });

  it("rejects ordinary news with no rumour wording", () => {
    expect(isRumourHeadline("Varonis Announces Third Quarter 2026 Financial Results")).toBe(false);
    expect(isRumourHeadline("Zacks: PTC Heads Into Q4 Earnings as Schneider Buyout Looms")).toBe(false);
  });
});

describe("targetTicker", () => {
  it("returns the single ticker, ignoring futures, indices, crypto and private names", () => {
    expect(targetTicker(["WEN"])).toBe("WEN");
    expect(targetTicker(["WEN", "LE=F"])).toBe("WEN");
    expect(targetTicker(["xpof", "^GSPC", "BTC-USD", "OPAI.PVT"])).toBe("XPOF");
    expect(targetTicker(["WEN", "WEN"])).toBe("WEN");
  });

  it("returns null when it can't tell the target from the acquirer, or there is no ticker", () => {
    expect(targetTicker(["LION", "APO"])).toBeNull();
    expect(targetTicker(["CART", "DASH", "UBER"])).toBeNull();
    expect(targetTicker([])).toBeNull();
    expect(targetTicker(undefined)).toBeNull();
    expect(targetTicker(["^GSPC"])).toBeNull();
  });
});

describe("pickCandidates", () => {
  it("keeps open single-ticker rumours and drops everything else, like the real feed", () => {
    const news = [
      item(WENDYS, ["WEN", "LE=F"], "2026-10-28", "wen-1"),
      item(XPONENTIAL, ["XPOF"], "2026-10-30", "xpof-1"),
      item("Lionsgate shares spike as Legendary Entertainment revives takeover talks", ["LION", "APO"], "2026-10-20"),
      item("Truist explores sale of Afco Credit specialty lending unit - Bloomberg", ["TFC"], "2026-10-26"),
      item("Microsoft’s 60,000-person buyout offer hints at a future with fewer workers", ["MSFT"], "2026-10-30"),
      item("Varonis Announces Third Quarter 2026 Financial Results", ["VRNS"], "2026-11-03"),
    ];
    const c = pickCandidates(news, { now: NOW });
    expect(c.map((x) => x.ticker)).toEqual(["XPOF", "WEN"]); // newest first
    expect(c[0]).toEqual({
      ticker: "XPOF",
      headline: XPONENTIAL,
      publisher: "Test",
      link: link("xpof-1"),
      date: "2026-10-30",
    });
  });

  it("uses the earliest report for a ticker, as the report date", () => {
    const news = [
      item("Wendy’s receives share takeover bid from investor group", ["WEN"], "2026-10-29", "later"),
      item(WENDYS, ["WEN"], "2026-10-28", "earlier"),
    ];
    const c = pickCandidates(news, { now: NOW });
    expect(c).toHaveLength(1);
    expect(c[0].date).toBe("2026-10-28");
    expect(c[0].link).toBe(link("earlier"));
  });

  it("skips excluded tickers (announced or already tracked), ignoring case", () => {
    const news = [item(WENDYS, ["WEN"], "2026-10-28"), item(XPONENTIAL, ["XPOF"], "2026-10-30")];
    expect(pickCandidates(news, { now: NOW, excludeTickers: ["wen"] }).map((x) => x.ticker)).toEqual(["XPOF"]);
  });

  it("skips headlines older than the window, and ones dated in the future", () => {
    const news = [item(WENDYS, ["WEN"], "2026-10-01"), item(XPONENTIAL, ["XPOF"], "2026-11-20")];
    expect(pickCandidates(news, { now: NOW })).toEqual([]);
    expect(pickCandidates([item(WENDYS, ["WEN"], "2026-10-01")], { now: NOW, maxAgeDays: 60 })).toHaveLength(1);
  });

  it("uses the New York date for the report date", () => {
    const late = { ...item(WENDYS, ["WEN"], "2026-10-28"), providerPublishTime: new Date("2026-10-29T02:30:00Z") };
    expect(pickCandidates([late], { now: NOW })[0].date).toBe("2026-10-28"); // 10:30 PM ET the day before
  });

  it("accepts epoch seconds and skips unreadable dates", () => {
    const secs = { ...item(WENDYS, ["WEN"], "2026-10-28"), providerPublishTime: Date.parse("2026-10-28T16:00:00Z") / 1000 };
    const bad = { ...item(XPONENTIAL, ["XPOF"], "2026-10-30"), providerPublishTime: "not a date" };
    expect(pickCandidates([secs, bad], { now: NOW }).map((x) => x.ticker)).toEqual(["WEN"]);
  });

  it("skips items whose link isn't a news site", () => {
    const social = { ...item(WENDYS, ["WEN"], "2026-10-28"), link: "https://www.reddit.com/r/stocks/x" };
    expect(pickCandidates([social], { now: NOW })).toEqual([]);
  });

  it("returns nothing for an empty feed", () => {
    expect(pickCandidates([], { now: NOW })).toEqual([]);
  });
});

describe("newRumoursFromScan", () => {
  const cand = (ticker: string, name = `${ticker} Inc.`): ScanCandidate => ({
    ticker,
    name,
    headline: `${name} takeover bid`,
    publisher: "Investing.com",
    link: link(ticker.toLowerCase()),
    date: "2026-10-28",
  });
  const none = { tracked: [], announced: [], dismissed: [] };

  it("makes auto-found rumours with the headline and no terms", () => {
    const [r] = newRumoursFromScan([cand("WEN", "The Wendy's Company")], none);
    expect(r).toEqual({
      id: "auto-WEN",
      targetTicker: "WEN",
      targetName: "The Wendy's Company",
      sourceUrl: link("wen"),
      reportDate: "2026-10-28",
      autoFound: true,
      headline: "The Wendy's Company takeover bid",
    });
    // Never an acquirer, price or timeframe.
    expect(r).not.toHaveProperty("acquirerName");
    expect(r).not.toHaveProperty("reportedPrice");
    expect(r).not.toHaveProperty("reportedCloseDate");
  });

  it("skips tickers already tracked, already announced, or dismissed by the user (any case)", () => {
    const out = newRumoursFromScan([cand("WEN"), cand("XPOF"), cand("GFL"), cand("PTC")], {
      tracked: ["wen"],
      announced: ["PTC"],
      dismissed: ["gfl"],
    });
    expect(out.map((r) => r.targetTicker)).toEqual(["XPOF"]);
  });

  it("adds a ticker only once if the candidates repeat it", () => {
    expect(newRumoursFromScan([cand("WEN"), cand("WEN")], none)).toHaveLength(1);
  });

  it("returns nothing for no candidates", () => {
    expect(newRumoursFromScan([], none)).toEqual([]);
  });
});
