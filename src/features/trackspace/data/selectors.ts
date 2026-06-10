// Derived values over the seed data. Every number or list a screen
// shows should come from here, not from copied display text.

import { CAPABILITIES, EVENTS, MILESTONES, STATUS_LIST } from "./seed";
import type {
  Capability,
  CapabilityId,
  Confidence,
  DependencyEdge,
  Milestone,
  MilestoneId,
  Source,
  Status,
  TrackspaceEvent,
} from "./types";

export const CAPABILITY_BY_ID: Record<CapabilityId, Capability> =
  Object.fromEntries(CAPABILITIES.map((c) => [c.id, c])) as Record<
    CapabilityId,
    Capability
  >;

export const MILESTONE_BY_ID: Record<MilestoneId, Milestone> =
  Object.fromEntries(MILESTONES.map((m) => [m.id, m])) as Record<
    MilestoneId,
    Milestone
  >;

export const EVENT_BY_ID: Record<string, TrackspaceEvent> = Object.fromEntries(
  EVENTS.map((e) => [e.id, e]),
);

/** Composite readiness: mean capability readiness, rounded. */
export function getOverallReadiness(): number {
  const total = CAPABILITIES.reduce((sum, c) => sum + c.readiness, 0);
  return Math.round(total / CAPABILITIES.length);
}

export function getStatusCounts(): Record<Status, number> {
  const counts = Object.fromEntries(STATUS_LIST.map((s) => [s, 0])) as Record<
    Status,
    number
  >;
  for (const c of CAPABILITIES) counts[c.status] += 1;
  return counts;
}

/** Capabilities currently blocking downstream work. */
export function getBlockers(): Capability[] {
  return CAPABILITIES.filter((c) => c.status === "blocker");
}

/**
 * Chronological sort key for the mixed display-date formats.
 * Range formats key to the END of their range ("2026-Q2" → June, "2028+" →
 * end of 2028, "2030s" → end of the decade) so a concrete date inside the
 * range sorts before the open-ended target.
 */
export function dateSortKey(date: string): string {
  const quarter = date.match(/^(\d{4})-Q([1-4])$/);
  if (quarter) {
    const endMonth = Number(quarter[2]) * 3;
    return `${quarter[1]}-${String(endMonth).padStart(2, "0")}-99`;
  }
  const yearPlus = date.match(/^(\d{4})\+$/);
  if (yearPlus) return `${yearPlus[1]}-99-99`;
  const decade = date.match(/^(\d{4})s$/);
  if (decade) return `${Number(decade[1]) + 9}-99-99`;
  return date; // "YYYY-MM-DD" and "YYYY-MM" already compare correctly
}

function compareDates(a: string, b: string): number {
  const keyA = dateSortKey(a);
  const keyB = dateSortKey(b);
  return keyA < keyB ? -1 : keyA > keyB ? 1 : 0;
}

/** Past events first, then by date; equal dates keep seed order (stable sort). */
export function compareEventsChronologically(
  a: TrackspaceEvent,
  b: TrackspaceEvent,
): number {
  if (a.future !== b.future) return a.future ? 1 : -1;
  return compareDates(a.date, b.date);
}

/**
 * The next milestone not already achieved, in date order. Falls back to the
 * final milestone when everything is achieved.
 */
export function getNextMilestone(milestones: Milestone[] = MILESTONES): Milestone {
  const ordered = [...milestones].sort((a, b) => compareDates(a.date, b.date));
  return ordered.find((m) => m.status !== "ready") ?? ordered[ordered.length - 1];
}

/** Past events, newest first. */
export function getRecentChanges(count = 3): TrackspaceEvent[] {
  return EVENTS.filter((e) => !e.future)
    .sort((a, b) => compareEventsChronologically(b, a))
    .slice(0, count);
}

/** All events in date order; future targets sort after past events. */
export function getSortedEvents(): TrackspaceEvent[] {
  return [...EVENTS].sort(compareEventsChronologically);
}

/** Events touching a capability. */
export function getEventsForCapability(id: CapabilityId): TrackspaceEvent[] {
  return EVENTS.filter((e) => e.caps.includes(id));
}

/** Events touching any capability required by a milestone. */
export function getEventsForMilestone(id: MilestoneId): TrackspaceEvent[] {
  const milestone = MILESTONE_BY_ID[id];
  return EVENTS.filter((e) => e.caps.some((c) => milestone.caps.includes(c)));
}

/** Dependency graph edges, colored by the upstream capability's status. */
export function getDependencyEdges(): DependencyEdge[] {
  const edges: DependencyEdge[] = [];
  for (const node of CAPABILITIES) {
    for (const dep of node.deps) {
      edges.push({ from: dep, to: node.id, status: CAPABILITY_BY_ID[dep].status });
    }
  }
  return edges;
}

/** Capabilities that depend on the given one. */
export function getDownstream(id: CapabilityId): Capability[] {
  return CAPABILITIES.filter((c) => c.deps.includes(id));
}

/** Required capabilities of a milestone that are hard blockers. */
export function getMilestoneBlockers(id: MilestoneId): Capability[] {
  return MILESTONE_BY_ID[id].caps
    .map((c) => CAPABILITY_BY_ID[c])
    .filter((c) => c.status === "blocker");
}

/** Count of a milestone's required capabilities that are ready. */
export function getMilestoneReadyCount(id: MilestoneId): number {
  return MILESTONE_BY_ID[id].caps.filter(
    (c) => CAPABILITY_BY_ID[c].status === "ready",
  ).length;
}

const SOURCE_POOL: Source[] = [
  {
    ico: "NASA",
    title: "NASA Moon to Mars Architecture — capability brief",
    url: "nasa.gov",
  },
  {
    ico: "OIG",
    title: "Office of Inspector General — program audit",
    url: "oig.nasa.gov",
  },
  { ico: "GAO", title: "GAO assessment of major projects", url: "gao.gov" },
  { ico: "PRESS", title: "Agency press kit & mission briefing", url: "nasa.gov" },
];

/** Provenance links shown in the drawer; stronger confidence cites more sources. */
export function getSourcesForConfidence(conf: Confidence): Source[] {
  const count =
    conf === "confirmed" ? 3 : conf === "reported" || conf === "inferred" ? 2 : 1;
  return SOURCE_POOL.slice(0, count);
}

export type Summary = {
  overall: number;
  label: string;
  statusCounts: Record<Status, number>;
  blockers: Capability[];
  nextMilestone: Milestone;
  recentChanges: TrackspaceEvent[];
  capabilityCount: number;
  milestoneCount: number;
};

export function getSummary(): Summary {
  return {
    overall: getOverallReadiness(),
    label: "Toward sustained lunar presence",
    statusCounts: getStatusCounts(),
    blockers: getBlockers(),
    nextMilestone: getNextMilestone(),
    recentChanges: getRecentChanges(),
    capabilityCount: CAPABILITIES.length,
    milestoneCount: MILESTONES.length,
  };
}
