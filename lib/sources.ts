// Sources a rumoured deal can cite. Any link to a news site is accepted, because rumours first
// surface in many outlets. The publisher shown in the UI is always read from the link itself,
// never typed, so the label can't misstate where a report came from.
//
// - Well-known outlets get a short name ("Reuters").
// - Any other site is labelled with its own domain ("investing.com").
// - Social media, forums and chat sites are rejected: a post there isn't a report.

/** Well-known outlets, by domain, with the name shown for them. */
export const KNOWN_PUBLISHERS: Record<string, string> = {
  "wsj.com": "WSJ",
  "bloomberg.com": "Bloomberg",
  "reuters.com": "Reuters",
  "ft.com": "FT",
  "cnbc.com": "CNBC",
  "nytimes.com": "NYT",
  "theinformation.com": "The Information",
  "dowjones.com": "Dow Jones",
  "barrons.com": "Barron's",
  "marketwatch.com": "MarketWatch",
  "apnews.com": "AP",
  "axios.com": "Axios",
  "forbes.com": "Forbes",
  "fortune.com": "Fortune",
  "businessinsider.com": "Business Insider",
  "investing.com": "Investing.com",
  "benzinga.com": "Benzinga",
  "techcrunch.com": "TechCrunch",
  "deadline.com": "Deadline",
  "variety.com": "Variety",
};

/** Sites where anyone can post, so a link there isn't a published report. */
const NOT_A_NEWS_SOURCE = [
  "reddit.com",
  "x.com",
  "twitter.com",
  "facebook.com",
  "instagram.com",
  "tiktok.com",
  "youtube.com",
  "youtu.be",
  "stocktwits.com",
  "discord.com",
  "t.me",
  "telegram.org",
  "linkedin.com",
];

const matches = (host: string, domain: string) => host === domain || host.endsWith(`.${domain}`);

/**
 * The publisher of an http(s) link: a short name for a well-known outlet, otherwise the site's own
 * domain (without "www."). Null for anything that isn't a link to a news site: other protocols,
 * a bare word, localhost, an IP address, or social media and forums.
 */
export function publisherFor(url: string): string | null {
  let host: string;
  try {
    const u = new URL(url.trim());
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    host = u.hostname.toLowerCase().replace(/\.$/, "");
  } catch {
    return null;
  }
  // A real site name has a dot and isn't an address (IPv4, or IPv6 in brackets).
  if (!host.includes(".") || /^[\d.]+$/.test(host) || host.startsWith("[")) return null;
  if (NOT_A_NEWS_SOURCE.some((d) => matches(host, d))) return null;

  for (const [domain, name] of Object.entries(KNOWN_PUBLISHERS)) {
    if (matches(host, domain)) return name;
  }
  return host.replace(/^www\./, "");
}

/** True if the link is on one of the well-known outlets above (as opposed to some other site). */
export function isKnownPublisher(url: string): boolean {
  const name = publisherFor(url);
  return name !== null && Object.values(KNOWN_PUBLISHERS).includes(name);
}
