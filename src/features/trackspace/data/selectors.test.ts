import { describe, expect, it } from "vitest";

import { CAPABILITIES, EVENTS, MILESTONES } from "./seed";
import type { Dataset, Milestone, TrackspaceEvent } from "./types";
import {
  compareEventsChronologically,
  dateSortKey,
  getBlockers,
  getDependencyEdges,
  getDownstream,
  getEventsForCapability,
  getEventsForMilestone,
  getMilestoneBlockers,
  getMilestoneReadyCount,
  getNextMilestone,
  getOverallReadiness,
  getRecentChanges,
  getSortedEvents,
  getStatusCounts,
  getSummary,
  getUpcomingMilestones,
} from "./selectors";

describe("getOverallReadiness", () => {
  it("is the rounded mean of capability readiness", () => {
    const mean =
      CAPABILITIES.reduce((sum, c) => sum + c.readiness, 0) /
      CAPABILITIES.length;
    expect(getOverallReadiness()).toBe(Math.round(mean));
  });
});

describe("getStatusCounts", () => {
  it("covers every capability exactly once", () => {
    const counts = getStatusCounts();
    const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
    expect(total).toBe(CAPABILITIES.length);
  });

  it("counts the curated statuses", () => {
    // Artemis II has flown, so SLS/Orion/ESM are ready; the landing chain
    // (HLS, cryo, suit) blocks, and paused Gateway is unknown.
    expect(getStatusCounts()).toEqual({
      ready: 3,
      watch: 5,
      blocker: 3,
      unknown: 1,
    });
  });
});

describe("getBlockers", () => {
  it("returns only blocker capabilities", () => {
    const blockers = getBlockers();
    expect(blockers.length).toBeGreaterThan(0);
    expect(blockers.every((c) => c.status === "blocker")).toBe(true);
    expect(blockers.map((c) => c.id)).toEqual(["hls", "cryo", "suit"]);
  });
});

describe("getNextMilestone", () => {
  it("is the first milestone not already achieved", () => {
    // Artemis I and II are done; Artemis III (the next crewed flight) is next.
    expect(getNextMilestone().id).toBe("a3");
  });

  it("orders by date, not array position", () => {
    const shuffled = [...MILESTONES].reverse();
    expect(getNextMilestone(shuffled).id).toBe("a3");
  });

  it("falls back to the final milestone when everything is achieved", () => {
    const allReady: Milestone[] = MILESTONES.map((m) => ({
      ...m,
      status: "ready",
    }));
    expect(getNextMilestone(allReady).id).toBe("base");
  });
});

describe("getUpcomingMilestones", () => {
  it("returns unachieved milestones in date order", () => {
    expect(getUpcomingMilestones().map((m) => m.id)).toEqual(["a3", "gw", "base"]);
  });

  it("respects the count argument", () => {
    // Only three milestones remain unachieved (a1, a2 are done).
    expect(getUpcomingMilestones(5).map((m) => m.id)).toEqual([
      "a3",
      "gw",
      "base",
    ]);
  });
});

describe("dateSortKey", () => {
  it("orders concrete dates inside a year against quarter targets", () => {
    // Lexicographic comparison got this wrong: "2026-07-15" < "2026-Q2".
    expect(dateSortKey("2026-07-15") > dateSortKey("2026-Q2")).toBe(true);
    expect(dateSortKey("2026-01-22") < dateSortKey("2026-Q2")).toBe(true);
  });

  it("orders open-ended targets after concrete dates in their range", () => {
    expect(dateSortKey("2028+") > dateSortKey("2028-01-01")).toBe(true);
    expect(dateSortKey("2030s") > dateSortKey("2030-06-01")).toBe(true);
    expect(dateSortKey("2028+") < dateSortKey("2030s")).toBe(true);
  });
});

describe("compareEventsChronologically", () => {
  const event = (overrides: Partial<TrackspaceEvent>): TrackspaceEvent => ({
    ...EVENTS[0],
    ...overrides,
  });

  it("sorts past events before future targets regardless of date", () => {
    const past = event({ id: "x1", date: "2026-07-15", future: false });
    const target = event({ id: "x2", date: "2026-Q2", future: true });
    expect(compareEventsChronologically(past, target)).toBeLessThan(0);
    expect(compareEventsChronologically(target, past)).toBeGreaterThan(0);
  });

  it("returns 0 for equal dates, keeping the sort consistent and stable", () => {
    const first = event({ id: "x1", date: "2026-01-22" });
    const second = event({ id: "x2", date: "2026-01-22" });
    expect(compareEventsChronologically(first, second)).toBe(0);
    expect(compareEventsChronologically(second, first)).toBe(0);
  });
});

describe("getRecentChanges", () => {
  it("returns past events newest first", () => {
    const recent = getRecentChanges();
    expect(recent.every((e) => !e.future)).toBe(true);
    expect(recent.map((e) => e.id)).toEqual([
      "artemis-iii-crew-named",
      "ltv-downselect",
      "starship-v3-debut-fails",
    ]);
  });
});

describe("getSortedEvents", () => {
  it("orders all events by date with future targets last", () => {
    const sorted = getSortedEvents();
    expect(sorted).toHaveLength(EVENTS.length);
    const firstFuture = sorted.findIndex((e) => e.future);
    expect(sorted.slice(firstFuture).every((e) => e.future)).toBe(true);
  });
});

describe("getEventsForCapability", () => {
  it("returns exactly the events whose caps include the capability", () => {
    const events = getEventsForCapability("cryo");
    expect(events.length).toBeGreaterThan(0);
    expect(events.every((e) => e.caps.includes("cryo"))).toBe(true);
    // Filtering preserves seed order, so it matches the manual filter.
    expect(events.map((e) => e.id)).toEqual(
      EVENTS.filter((e) => e.caps.includes("cryo")).map((e) => e.id),
    );
    expect(events.map((e) => e.id)).toContain("cryo-ship-to-ship-demo");
  });
});

describe("getEventsForMilestone", () => {
  it("returns events touching any required capability", () => {
    const milestone = MILESTONES.find((m) => m.id === "a3")!;
    const events = getEventsForMilestone("a3");
    expect(events.length).toBeGreaterThan(0);
    expect(
      events.every((e) => e.caps.some((c) => milestone.caps.includes(c))),
    ).toBe(true);
  });
});

describe("getDependencyEdges", () => {
  it("creates one edge per declared dependency", () => {
    const declared = CAPABILITIES.reduce((sum, c) => sum + c.deps.length, 0);
    const edges = getDependencyEdges();
    expect(edges).toHaveLength(declared);
  });

  it("colors edges by the upstream capability status", () => {
    const edge = getDependencyEdges().find(
      (e) => e.from === "cryo" && e.to === "hls",
    );
    expect(edge?.status).toBe("blocker");
  });
});

describe("getDownstream", () => {
  it("finds capabilities that depend on the given one", () => {
    expect(getDownstream("power").map((c) => c.id)).toEqual(["isru", "hab"]);
    expect(getDownstream("hab")).toEqual([]);
  });
});

describe("milestone roll-ups", () => {
  it("finds the hard blockers among required capabilities", () => {
    // Artemis III (LEO demo) needs SLS/Orion/ESM (ready) and an HLS pathfinder.
    expect(getMilestoneBlockers("a3").map((c) => c.id)).toEqual(["hls"]);
    expect(getMilestoneBlockers("a1")).toEqual([]);
  });

  it("counts ready capabilities", () => {
    expect(getMilestoneReadyCount("a2")).toBe(3); // sls, orion, esm
  });
});

describe("every record carries at least one source", () => {
  it("never shows a claim without provenance", () => {
    for (const record of [...CAPABILITIES, ...MILESTONES, ...EVENTS]) {
      expect(record.sources.length).toBeGreaterThan(0);
      expect(record.sources.every((s) => /^https?:\/\//.test(s.url))).toBe(true);
    }
  });

  it("never rests solely on tier-4 (discovery-only) sources", () => {
    // Accuracy policy: tier-4 sources (e.g. Wikipedia) may not stand alone.
    for (const record of [...CAPABILITIES, ...MILESTONES, ...EVENTS]) {
      expect(record.sources.some((s) => s.tier <= 3)).toBe(true);
    }
  });
});

describe("selectors honor a passed-in dataset, not the curated globals", () => {
  const synthetic: Dataset = {
    capabilities: [
      { ...CAPABILITIES[0], id: "sls", status: "watch", readiness: 50, deps: [], milestone: "a1" },
    ],
    milestones: [{ ...MILESTONES[0], id: "a1", status: "watch", caps: ["sls"] }],
    events: [{ ...EVENTS[0], id: "synthetic-event", caps: ["sls"], future: false }],
  };

  it("getStatusCounts reads the passed capabilities", () => {
    expect(getStatusCounts(synthetic.capabilities)).toEqual({
      ready: 0,
      watch: 1,
      blocker: 0,
      unknown: 0,
    });
  });

  it("getSummary reads the passed dataset", () => {
    const summary = getSummary(synthetic);
    expect(summary.capabilityCount).toBe(1);
    expect(summary.overall).toBe(50);
    expect(summary.nextMilestone.id).toBe("a1");
    expect(summary.blockers).toEqual([]);
  });

  it("getEventsForMilestone reads the passed dataset", () => {
    expect(getEventsForMilestone("a1", synthetic).map((e) => e.id)).toEqual([
      "synthetic-event",
    ]);
  });
});

describe("getSummary", () => {
  it("combines the headline numbers", () => {
    const summary = getSummary();
    expect(summary.overall).toBe(getOverallReadiness());
    expect(summary.blockers.map((c) => c.id)).toEqual(["hls", "cryo", "suit"]);
    expect(summary.nextMilestone.id).toBe("a3");
    expect(summary.capabilityCount).toBe(CAPABILITIES.length);
    expect(summary.milestoneCount).toBe(MILESTONES.length);
  });
});
