import { describe, expect, it } from "vitest";

import { discoveryToEvent } from "./discoveries";
import { compareEventsChronologically } from "./selectors";
import { EVENTS } from "./seed";

const LEAD = {
  url: "https://www.nasa.gov/some-artemis-update/",
  title: "Some Artemis Update",
  source: "NASA RSS",
  foundAt: "2026-07-17T14:51:51.954Z",
  publishedAt: "2026-07-17T14:48:27.000Z",
};

describe("discoveryToEvent", () => {
  it("maps a lead to an unverified, tier-4 past event", () => {
    const event = discoveryToEvent(LEAD, "abc123");
    expect(event.id).toBe("disc-abc123");
    expect(event.date).toBe("2026-07-17");
    expect(event.future).toBe(false);
    expect(event.status).toBe("unknown");
    expect(event.conf).toBe("unverified");
    expect(event.sources).toEqual([
      {
        publisher: "NASA RSS",
        title: LEAD.title,
        url: LEAD.url,
        tier: 4,
        date: "2026-07-17",
      },
    ]);
  });

  it("falls back to foundAt when publishedAt is missing", () => {
    const { publishedAt, ...bare } = LEAD;
    void publishedAt;
    expect(discoveryToEvent(bare, "x").date).toBe("2026-07-17");
  });

  it("sorts chronologically among curated past events", () => {
    const event = discoveryToEvent(LEAD, "x");
    const past = EVENTS.filter((e) => !e.future);
    for (const other of past) {
      expect(compareEventsChronologically(event, other)).toBe(
        event.date < other.date ? -1 : event.date > other.date ? 1 : 0,
      );
    }
  });
});
