import { describe, expect, it } from "vitest";
import { publisherFor } from "./sources";

describe("publisherFor", () => {
  it("names the publisher of a trusted link, with or without a subdomain", () => {
    expect(publisherFor("https://www.reuters.com/markets/deals/abc-2026-10-30/")).toBe("Reuters");
    expect(publisherFor("https://reuters.com/x")).toBe("Reuters");
    expect(publisherFor("https://www.wsj.com/business/deals/x")).toBe("WSJ");
    expect(publisherFor("https://www.bloomberg.com/news/articles/2026-10-30/x")).toBe("Bloomberg");
    expect(publisherFor("https://uk.ft.com/content/x")).toBe("FT");
    expect(publisherFor("http://www.cnbc.com/2026/10/30/x.html")).toBe("CNBC");
    expect(publisherFor("  https://www.theinformation.com/articles/x  ")).toBe("The Information");
  });

  it("ignores letter case in the host", () => {
    expect(publisherFor("https://WWW.Reuters.COM/x")).toBe("Reuters");
  });

  it("rejects lookalike domains", () => {
    expect(publisherFor("https://reuters.com.evil.io/x")).toBeNull();
    expect(publisherFor("https://notreuters.com/x")).toBeNull();
    expect(publisherFor("https://wsj.com-news.net/x")).toBeNull();
  });

  it("rejects untrusted sites, including syndicated copies on Yahoo", () => {
    expect(publisherFor("https://finance.yahoo.com/news/reuters-story-123.html")).toBeNull();
    expect(publisherFor("https://www.example.com/x")).toBeNull();
  });

  it("rejects non-http links and junk", () => {
    expect(publisherFor("javascript:alert(1)//reuters.com")).toBeNull();
    expect(publisherFor("ftp://reuters.com/x")).toBeNull();
    expect(publisherFor("reuters.com/x")).toBeNull();
    expect(publisherFor("")).toBeNull();
  });
});
