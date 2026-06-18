// NASA RSS feed reader — a Tier-1 discovery source.
//
// New items become leads in the `discoveries` queue (unverified), never public
// claims. The XML parser is intentionally dependency-free and pure so it can be
// unit-tested against a fixture string.

export type FeedItem = {
  title: string;
  link: string;
  /** ISO 8601, or null if the feed date could not be parsed. */
  publishedAt: string | null;
  summary: string;
  categories: string[];
};

const DEFAULT_FEEDS = [
  // Artemis-specific blog: the densest source of lunar-program leads.
  "https://blogs.nasa.gov/artemis/feed/",
  // Agency-wide releases: catches lunar news posted outside the Artemis blog.
  "https://www.nasa.gov/feed/",
];

// Terms that mark an item as relevant to lunar exploration / Moon to Mars.
const LUNAR_TERMS =
  /\b(artemis|moon|lunar|gateway|orion|sls|hls|starship|blue moon|spacesuit|axemu|regolith|cislunar|rover|fission)\b/i;

function firstTag(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return match ? match[1] : null;
}

function decode(raw: string | null): string {
  if (!raw) return "";
  return raw
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseFeedItems(xml: string): FeedItem[] {
  const items: FeedItem[] = [];
  const itemRe = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let match: RegExpExecArray | null;
  while ((match = itemRe.exec(xml)) !== null) {
    const block = match[1];
    const title = decode(firstTag(block, "title"));
    const link = decode(firstTag(block, "link"));
    if (!title || !link) continue;
    const pub = decode(firstTag(block, "pubDate"));
    const parsed = pub ? new Date(pub) : null;
    const categories = [
      ...block.matchAll(/<category[^>]*>([\s\S]*?)<\/category>/gi),
    ]
      .map((c) => decode(c[1]))
      .filter(Boolean);
    items.push({
      title,
      link,
      publishedAt: parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : null,
      summary: decode(firstTag(block, "description")).slice(0, 400),
      categories,
    });
  }
  return items;
}

export function isLunarRelevant(item: FeedItem): boolean {
  return (
    LUNAR_TERMS.test(item.title) ||
    LUNAR_TERMS.test(item.summary) ||
    item.categories.some((category) => LUNAR_TERMS.test(category))
  );
}

/** Fetch and parse NASA feed items. Throws on a non-OK response. */
export async function fetchNasaItems(opts?: {
  signal?: AbortSignal;
  feeds?: string[];
}): Promise<FeedItem[]> {
  const feeds = opts?.feeds ?? DEFAULT_FEEDS;
  const all: FeedItem[] = [];
  for (const feed of feeds) {
    const res = await fetch(feed, {
      signal: opts?.signal,
      headers: { "User-Agent": "trackspace-ingest (lunar readiness tracker)" },
    });
    if (!res.ok) {
      throw new Error(`NASA feed ${feed} responded ${res.status}`);
    }
    all.push(...parseFeedItems(await res.text()));
  }
  return all;
}
