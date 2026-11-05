// Publishers whose reports a rumoured deal can cite. A rumour's source link must be on one of
// these sites; the publisher name shown in the UI comes from the link, so the two always agree.

export const TRUSTED_PUBLISHERS: Record<string, string> = {
  "wsj.com": "WSJ",
  "bloomberg.com": "Bloomberg",
  "reuters.com": "Reuters",
  "ft.com": "FT",
  "cnbc.com": "CNBC",
  "nytimes.com": "NYT",
  "theinformation.com": "The Information",
  "dowjones.com": "Dow Jones",
  "barrons.com": "Barron's",
};

/** Short list for messages, e.g. "WSJ, Bloomberg, Reuters". */
export const TRUSTED_PUBLISHER_NAMES = Object.values(TRUSTED_PUBLISHERS).join(", ");

/**
 * The publisher of an http(s) link on a trusted site (the domain itself or a subdomain such as
 * www. or uk.), or null. Lookalikes such as reuters.com.example.net don't match.
 */
export function publisherFor(url: string): string | null {
  let host: string;
  try {
    const u = new URL(url.trim());
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    host = u.hostname.toLowerCase();
  } catch {
    return null;
  }
  for (const [domain, name] of Object.entries(TRUSTED_PUBLISHERS)) {
    if (host === domain || host.endsWith(`.${domain}`)) return name;
  }
  return null;
}
