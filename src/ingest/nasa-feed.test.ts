// @vitest-environment node

import { describe, expect, it } from "vitest";

import { isLunarRelevant, parseFeedItems } from "./nasa-feed";

const FIXTURE = `<?xml version="1.0"?>
<rss><channel>
  <item>
    <title>Final Artemis III SLS Booster Segments En Route to Kennedy</title>
    <link>https://blogs.nasa.gov/artemis/2026/06/01/boosters/</link>
    <pubDate>Mon, 01 Jun 2026 12:00:00 +0000</pubDate>
    <category><![CDATA[Artemis]]></category>
    <description><![CDATA[<p>The boosters for the <b>Artemis III</b> mission shipped today.</p>]]></description>
  </item>
  <item>
    <title><![CDATA[Hubble Sees a Swarm of Galaxies]]></title>
    <link>https://www.nasa.gov/image/galaxies/</link>
    <pubDate>Tue, 02 Jun 2026 09:30:00 +0000</pubDate>
    <category><![CDATA[Astrophysics]]></category>
    <description>A deep-field view of distant galaxies.</description>
  </item>
</channel></rss>`;

describe("parseFeedItems", () => {
  const items = parseFeedItems(FIXTURE);

  it("extracts every item with decoded fields", () => {
    expect(items).toHaveLength(2);
    expect(items[0].title).toBe(
      "Final Artemis III SLS Booster Segments En Route to Kennedy",
    );
    expect(items[0].link).toBe("https://blogs.nasa.gov/artemis/2026/06/01/boosters/");
    expect(items[0].publishedAt).toBe("2026-06-01T12:00:00.000Z");
    expect(items[0].categories).toContain("Artemis");
  });

  it("strips CDATA and HTML from the summary", () => {
    expect(items[0].summary).toBe("The boosters for the Artemis III mission shipped today.");
    expect(items[0].summary).not.toContain("<");
  });

  it("handles a CDATA-wrapped title", () => {
    expect(items[1].title).toBe("Hubble Sees a Swarm of Galaxies");
  });
});

describe("isLunarRelevant", () => {
  const [artemis, galaxies] = parseFeedItems(FIXTURE);

  it("flags lunar-program items", () => {
    expect(isLunarRelevant(artemis)).toBe(true);
  });

  it("ignores unrelated items", () => {
    expect(isLunarRelevant(galaxies)).toBe(false);
  });
});
