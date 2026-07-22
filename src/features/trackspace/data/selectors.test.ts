import { describe, expect, it } from "vitest";

import { CAPABILITIES, EVENTS, LOCATIONS, MILESTONES } from "./seed";
import type { Dataset, Milestone, TrackspaceEvent } from "./types";
import {
  compareEventsChronologically,
  dateSortKey,
  getBlockers,
  getDependencyEdges,
  getDownstream,
  getEventsForCapability,
  getEventsForMilestone,
  getLocationsForCapability,
  getLocationsForEvent,
  getLocationsForMilestone,
  getMilestoneBlockers,
  getMilestoneReadyCount,
  getNextMilestone,
  RISK_LIKELIHOODS_DESC,
  RISK_SEVERITIES_ASC,
  getOverallReadiness,
  getProgramRegister,
  getRecentChanges,
  getRiskBand,
  getRiskMatrix,
  getRiskRegister,
  getRiskScore,
  getSortedEvents,
  getSceneLocations,
  getStatusCounts,
  getSummary,
  getUpcomingMilestones,
} from "./selectors";

describe("getStatusCounts", () => {
  it("covers every capability exactly once", () => {
    const counts = getStatusCounts();
    const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
    expect(total).toBe(CAPABILITIES.length);
  });
});

describe("getBlockers", () => {
  it("returns only blocker capabilities", () => {
    const blockers = getBlockers();
    expect(blockers.length).toBeGreaterThan(0);
    expect(blockers.every((c) => c.status === "blocker")).toBe(true);
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
  it("returns at most three past events, newest first", () => {
    const recent = getRecentChanges();
    expect(recent.length).toBeGreaterThan(0);
    expect(recent.length).toBeLessThanOrEqual(3);
    expect(recent.every((e) => !e.future)).toBe(true);
    for (let i = 1; i < recent.length; i += 1) {
      expect(
        compareEventsChronologically(recent[i - 1], recent[i]),
      ).toBeGreaterThanOrEqual(0);
    }
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
    const downstream = getDownstream("power");
    expect(downstream.length).toBeGreaterThan(0);
    expect(downstream.every((c) => c.deps.includes("power"))).toBe(true);
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
    for (const record of [...CAPABILITIES, ...MILESTONES, ...EVENTS, ...LOCATIONS]) {
      expect(record.sources.length).toBeGreaterThan(0);
      expect(record.sources.every((s) => /^https?:\/\//.test(s.url))).toBe(true);
    }
  });

  it("never rests solely on tier-4 (discovery-only) sources", () => {
    // Accuracy policy: tier-4 sources (e.g. Wikipedia) may not stand alone.
    for (const record of [...CAPABILITIES, ...MILESTONES, ...EVENTS, ...LOCATIONS]) {
      expect(record.sources.some((s) => s.tier <= 3)).toBe(true);
    }
  });
});

describe("spatial selectors", () => {
  it("returns only Earth/Moon locations with coordinates for the scene", () => {
    const sceneLocations = getSceneLocations();
    expect(sceneLocations.length).toBe(LOCATIONS.length);
    expect(sceneLocations.every((location) => location.body !== "cislunar")).toBe(true);
    expect(sceneLocations.every((location) => typeof location.lat === "number")).toBe(true);
    expect(sceneLocations.every((location) => typeof location.lon === "number")).toBe(true);
  });

  it("links curated sites to the relevant records", () => {
    expect(getLocationsForCapability("hls").map((l) => l.id)).toContain("starbase");
    expect(getLocationsForEvent("starship-v3-debut-fails").map((l) => l.id)).toEqual([
      "starbase",
    ]);
    expect(getLocationsForMilestone("base").map((l) => l.id)).toContain(
      "lunar-south-pole",
    );
  });
});

describe("selectors honor a passed-in dataset, not the curated globals", () => {
  const synthetic: Dataset = {
    capabilities: [
      { ...CAPABILITIES[0], id: "sls", status: "watch", readiness: 50, deps: [], milestone: "a1" },
    ],
    milestones: [{ ...MILESTONES[0], id: "a1", status: "watch", caps: ["sls"] }],
    events: [{ ...EVENTS[0], id: "synthetic-event", caps: ["sls"], future: false }],
    locations: [
      {
        ...LOCATIONS[0],
        id: "synthetic-location",
        relatedCapabilities: ["sls"],
        relatedEvents: ["synthetic-event"],
        relatedMilestones: ["a1"],
      },
    ],
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

  it("location selectors read the passed dataset", () => {
    expect(getSceneLocations(synthetic).map((location) => location.id)).toEqual([
      "synthetic-location",
    ]);
    expect(getLocationsForCapability("sls", synthetic).map((l) => l.id)).toEqual([
      "synthetic-location",
    ]);
    expect(getLocationsForEvent("synthetic-event", synthetic).map((l) => l.id)).toEqual([
      "synthetic-location",
    ]);
    expect(getLocationsForMilestone("a1", synthetic).map((l) => l.id)).toEqual([
      "synthetic-location",
    ]);
  });
});

describe("getSummary", () => {
  it("combines the headline numbers", () => {
    const summary = getSummary();
    expect(summary.overall).toBe(getOverallReadiness());
    expect(summary.blockers).toEqual(getBlockers());
    expect(summary.nextMilestone.id).toBe(getNextMilestone().id);
    expect(summary.capabilityCount).toBe(CAPABILITIES.length);
    expect(summary.milestoneCount).toBe(MILESTONES.length);
  });
});

describe("getRiskScore", () => {
  it("is likelihood × severity on a 1–9 scale", () => {
    expect(getRiskScore({ likelihood: "low", severity: "low" })).toBe(1);
    expect(getRiskScore({ likelihood: "low", severity: "high" })).toBe(3);
    expect(getRiskScore({ likelihood: "high", severity: "high" })).toBe(9);
  });
});

describe("getRiskBand", () => {
  it("maps a score onto the status palette", () => {
    expect(getRiskBand(9)).toBe("blocker");
    expect(getRiskBand(6)).toBe("blocker");
    expect(getRiskBand(4)).toBe("watch");
    expect(getRiskBand(3)).toBe("watch");
    expect(getRiskBand(2)).toBe("ready");
  });
});

describe("getRiskRegister", () => {
  it("ranks by score descending, then by lower readiness", () => {
    const register = getRiskRegister();
    for (let i = 1; i < register.length; i += 1) {
      const prev = register[i - 1];
      const curr = register[i];
      expect(prev.score).toBeGreaterThanOrEqual(curr.score);
      if (prev.score === curr.score) {
        expect(prev.capability.readiness).toBeLessThanOrEqual(
          curr.capability.readiness,
        );
      }
    }
  });

  it("computes each entry's score from its risk", () => {
    for (const entry of getRiskRegister()) {
      expect(entry.score).toBe(getRiskScore(entry.risk));
    }
  });
});

describe("getProgramRegister", () => {
  it("ranks by shared status first, then lower readiness", () => {
    const rank = { blocker: 0, watch: 1, unknown: 2, ready: 3 };
    const register = getProgramRegister();

    for (let i = 1; i < register.length; i += 1) {
      const prev = register[i - 1];
      const curr = register[i];
      expect(rank[prev.status]).toBeLessThanOrEqual(rank[curr.status]);
      if (rank[prev.status] === rank[curr.status]) {
        expect(prev.capability.readiness).toBeLessThanOrEqual(
          curr.capability.readiness,
        );
      }
    }
  });
});

describe("getRiskMatrix", () => {
  it("is a 3×3 grid in row-major likelihood→severity order", () => {
    const matrix = getRiskMatrix();
    expect(matrix.length).toBe(9);
    matrix.forEach((cell, i) => {
      const row = Math.floor(i / RISK_SEVERITIES_ASC.length);
      const col = i % RISK_SEVERITIES_ASC.length;
      expect(cell.likelihood).toBe(RISK_LIKELIHOODS_DESC[row]);
      expect(cell.severity).toBe(RISK_SEVERITIES_ASC[col]);
      expect(cell.score).toBe(getRiskScore(cell));
    });
  });

  it("places every risk-bearing capability in exactly one cell", () => {
    const matrix = getRiskMatrix();
    const placed = matrix.reduce((sum, cell) => sum + cell.capabilities.length, 0);
    expect(placed).toBe(getRiskRegister().length);
    for (const cell of matrix) {
      for (const cap of cell.capabilities) {
        expect(cap.metrics?.risk?.likelihood).toBe(cell.likelihood);
        expect(cap.metrics?.risk?.severity).toBe(cell.severity);
      }
    }
  });
});
