import { describe, expect, it } from "vitest";

import { isNoiseDiscoveryUrl } from "./ingest";

describe("isNoiseDiscoveryUrl", () => {
  it.each([
    "https://www.nasa.gov/image-article/artemis-gallery/",
    "https://science.nasa.gov/photojournal/pia12345/",
    "https://www.nasa.gov/learning-resources/moon-lesson/",
    "https://science.nasa.gov/solar-system/skywatching/whats-up-july-2026/",
    "https://www.nasa.gov/whats-up/august-2026/",
    "https://www.nasa.gov/la-nasa-anuncia-una-mision-lunar/",
    "https://www.nasa.gov/espanol/la-nasa-presenta-artemis/",
  ])("drops known feed noise: %s", (url) => {
    expect(isNoiseDiscoveryUrl(url)).toBe(true);
  });

  it.each([
    "https://www.nasa.gov/missions/artemis/nasa-updates-artemis-campaign/",
    "https://blogs.nasa.gov/artemis/2026/07/20/flight-update/",
    "https://example.com/not-a-whats-updated-slug/",
  ])("keeps relevant article URLs: %s", (url) => {
    expect(isNoiseDiscoveryUrl(url)).toBe(false);
  });

  it("does not classify malformed input as matching URL noise", () => {
    expect(isNoiseDiscoveryUrl("not a url")).toBe(false);
  });
});
