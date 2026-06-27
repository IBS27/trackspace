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
  RISK_LIKELIHOODS_DESC,
  RISK_SEVERITIES_ASC,
  getOverallReadiness,
  getProgramRegister,
  getProgramSummary,
  getRecentChanges,
  getRiskBand,
  getRiskMatrix,
  getRiskRegister,
  getRiskScore,
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
    // (HLS, cryo, suit) blocks, and paused Gateway is unknown. The eight
    // surface-systems gaps (life support, radiation, dust, night, ice, crew
    // health, construction, thermal) are all watch.
    expect(getStatusCounts()).toEqual({
      ready: 3,
      watch: 13,
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
    // Power feeds ISRU, the habitat, life support, night survival, construction
    // and thermal control; nothing depends on the habitat itself.
    expect(getDownstream("power").map((c) => c.id)).toEqual([
      "isru",
      "hab",
      "eclss",
      "night",
      "build",
      "thermal",
    ]);
    expect(getDownstream("hab")).toEqual([]);
    // Construction enables regolith-berm radiation shielding; thermal feeds the habitat.
    expect(getDownstream("build").map((c) => c.id)).toEqual(["rad"]);
    expect(getDownstream("thermal").map((c) => c.id)).toEqual(["hab"]);
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
  it("includes every capability that carries a risk assessment", () => {
    const withRisk = CAPABILITIES.filter((c) => c.metrics?.risk);
    expect(getRiskRegister().length).toBe(withRisk.length);
  });

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

describe("getProgramSummary", () => {
  it("counts only capabilities that carry program metrics", () => {
    const summary = getProgramSummary();
    expect(summary.tracked).toBe(
      CAPABILITIES.filter((c) => c.metrics).length,
    );
    expect(summary.blockers).toBe(
      CAPABILITIES.filter((c) => c.metrics && c.status === "blocker").length,
    );
    expect(summary.watch).toBe(
      CAPABILITIES.filter((c) => c.metrics && c.status === "watch").length,
    );
    expect(summary.ready).toBe(
      CAPABILITIES.filter((c) => c.metrics && c.status === "ready").length,
    );
    expect(summary.withSlip).toBe(
      CAPABILITIES.filter((c) => c.metrics?.slip).length,
    );
    expect(summary.withFunding).toBe(
      CAPABILITIES.filter((c) => c.metrics?.funding).length,
    );
  });
});

describe("getProgramRegister", () => {
  it("includes every capability that carries program metrics", () => {
    expect(getProgramRegister().length).toBe(
      CAPABILITIES.filter((c) => c.metrics).length,
    );
  });

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
