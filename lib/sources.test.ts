import { describe, expect, it } from "vitest";
import { isKnownPublisher, publisherFor } from "./sources";

describe("publisherFor", () => {
  it("gives well-known outlets their short name, with or without a subdomain", () => {
    expect(publisherFor("https://www.reuters.com/markets/deals/abc-2026-10-30/")).toBe("Reuters");
    expect(publisherFor("https://reuters.com/x")).toBe("Reuters");
    expect(publisherFor("https://www.wsj.com/business/deals/x")).toBe("WSJ");
    expect(publisherFor("https://www.bloomberg.com/news/articles/2026-10-30/x")).toBe("Bloomberg");
    expect(publisherFor("https://uk.ft.com/content/x")).toBe("FT");
    expect(publisherFor("http://www.cnbc.com/2026/10/30/x.html")).toBe("CNBC");
    expect(publisherFor("https://www.investing.com/news/x")).toBe("Investing.com");
    expect(publisherFor("  https://www.theinformation.com/articles/x  ")).toBe("The Information");
  });

  it("ignores letter case in the host", () => {
    expect(publisherFor("https://WWW.Reuters.COM/x")).toBe("Reuters");
  });

  it("labels any other news site with its own domain, read from the link", () => {
    expect(publisherFor("https://www.example.com/x")).toBe("example.com");
    expect(publisherFor("https://finance.yahoo.com/news/reuters-story-123.html")).toBe("finance.yahoo.com");
    expect(publisherFor("https://www.thestreet.com/investing/x")).toBe("thestreet.com");
  });

  it("never lets a lookalike pass as a well-known outlet: it's labelled with its true domain", () => {
    expect(publisherFor("https://reuters.com.evil.io/x")).toBe("reuters.com.evil.io");
    expect(publisherFor("https://notreuters.com/x")).toBe("notreuters.com");
    expect(publisherFor("https://wsj.com-news.net/x")).toBe("wsj.com-news.net");
  });

  it("rejects social media, forums and chat sites, including subdomains", () => {
    for (const url of [
      "https://www.reddit.com/r/wallstreetbets/comments/abc",
      "https://old.reddit.com/r/stocks/x",
      "https://x.com/user/status/1",
      "https://twitter.com/user/status/1",
      "https://stocktwits.com/symbol/ABC",
      "https://www.youtube.com/watch?v=abc",
      "https://t.me/channel/1",
    ]) {
      expect(publisherFor(url), url).toBeNull();
    }
  });

  it("rejects non-http links, bare words, localhost and IP addresses", () => {
    expect(publisherFor("javascript:alert(1)//reuters.com")).toBeNull();
    expect(publisherFor("ftp://reuters.com/x")).toBeNull();
    expect(publisherFor("reuters.com/x")).toBeNull();
    expect(publisherFor("http://localhost:3000/x")).toBeNull();
    expect(publisherFor("http://127.0.0.1/x")).toBeNull();
    expect(publisherFor("http://[::1]/x")).toBeNull();
    expect(publisherFor("")).toBeNull();
  });
});

describe("isKnownPublisher", () => {
  it("is true only for the well-known outlets", () => {
    expect(isKnownPublisher("https://www.reuters.com/x")).toBe(true);
    expect(isKnownPublisher("https://www.example.com/x")).toBe(false);
    expect(isKnownPublisher("https://reuters.com.evil.io/x")).toBe(false);
    expect(isKnownPublisher("https://www.reddit.com/x")).toBe(false);
  });
});
