// Derived values over a Dataset. Every number or list a screen shows comes
// from here, not from copied display text.
//
// Selectors take the data they read as an argument and default to the curated
// baseline (CURATED). The screens pass whichever Dataset is active — the
// compile-time baseline, or a live snapshot loaded from SQLite at request time
// — so the same pure functions serve tests, standalone renders, and the app.

import { CAPABILITIES, EVENTS, MILESTONES, STATUS_LIST } from "./seed";
import type {
  Capability,
  CapabilityId,
  Dataset,
  DependencyEdge,
  Milestone,
  MilestoneId,
  Status,
  TrackspaceEvent,
} from "./types";

/** The curated, source-backed baseline rendered when no live snapshot is fed. */
export const CURATED: Dataset = {
  capabilities: CAPABILITIES,
  milestones: MILESTONES,
  events: EVENTS,
};

export function capabilityById(
  capabilities: Capability[] = CAPABILITIES,
): Record<CapabilityId, Capability> {
  return Object.fromEntries(capabilities.map((c) => [c.id, c])) as Record<
    CapabilityId,
    Capability
  >;
}

export function milestoneById(
  milestones: Milestone[] = MILESTONES,
): Record<MilestoneId, Milestone> {
  return Object.fromEntries(milestones.map((m) => [m.id, m])) as Record<
    MilestoneId,
    Milestone
  >;
}

export function eventById(
  events: TrackspaceEvent[] = EVENTS,
): Record<string, TrackspaceEvent> {
  return Object.fromEntries(events.map((e) => [e.id, e]));
}

/** Default-dataset index maps, for call sites that read the curated baseline. */
export const CAPABILITY_BY_ID = capabilityById();
export const MILESTONE_BY_ID = milestoneById();
export const EVENT_BY_ID = eventById();

/** Composite readiness: mean capability readiness, rounded. */
export function getOverallReadiness(
  capabilities: Capability[] = CAPABILITIES,
): number {
  if (capabilities.length === 0) return 0;
  const total = capabilities.reduce((sum, c) => sum + c.readiness, 0);
  return Math.round(total / capabilities.length);
}

export function getStatusCounts(
  capabilities: Capability[] = CAPABILITIES,
): Record<Status, number> {
  const counts = Object.fromEntries(STATUS_LIST.map((s) => [s, 0])) as Record<
    Status,
    number
  >;
  for (const c of capabilities) counts[c.status] += 1;
  return counts;
}

/** Capabilities currently blocking downstream work. */
export function getBlockers(capabilities: Capability[] = CAPABILITIES): Capability[] {
  return capabilities.filter((c) => c.status === "blocker");
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

/** Milestones not yet achieved, in date order. */
export function getUpcomingMilestones(
  count = 3,
  milestones: Milestone[] = MILESTONES,
): Milestone[] {
  return [...milestones]
    .sort((a, b) => compareDates(a.date, b.date))
    .filter((m) => m.status !== "ready")
    .slice(0, count);
}

/** Past events, newest first. */
export function getRecentChanges(
  count = 3,
  events: TrackspaceEvent[] = EVENTS,
): TrackspaceEvent[] {
  return events
    .filter((e) => !e.future)
    .sort((a, b) => compareEventsChronologically(b, a))
    .slice(0, count);
}

/** All events in date order; future targets sort after past events. */
export function getSortedEvents(
  events: TrackspaceEvent[] = EVENTS,
): TrackspaceEvent[] {
  return [...events].sort(compareEventsChronologically);
}

/** Events touching a capability. */
export function getEventsForCapability(
  id: CapabilityId,
  events: TrackspaceEvent[] = EVENTS,
): TrackspaceEvent[] {
  return events.filter((e) => e.caps.includes(id));
}

/** Events touching any capability required by a milestone. */
export function getEventsForMilestone(
  id: MilestoneId,
  dataset: Dataset = CURATED,
): TrackspaceEvent[] {
  const milestone = milestoneById(dataset.milestones)[id];
  if (!milestone) return [];
  return dataset.events.filter((e) =>
    e.caps.some((c) => milestone.caps.includes(c)),
  );
}

/** Dependency graph edges, colored by the upstream capability's status. */
export function getDependencyEdges(
  capabilities: Capability[] = CAPABILITIES,
): DependencyEdge[] {
  const byId = capabilityById(capabilities);
  const edges: DependencyEdge[] = [];
  for (const node of capabilities) {
    for (const dep of node.deps) {
      const upstream = byId[dep];
      if (!upstream) continue;
      edges.push({ from: dep, to: node.id, status: upstream.status });
    }
  }
  return edges;
}

/** Capabilities that depend on the given one. */
export function getDownstream(
  id: CapabilityId,
  capabilities: Capability[] = CAPABILITIES,
): Capability[] {
  return capabilities.filter((c) => c.deps.includes(id));
}

/** Required capabilities of a milestone that are hard blockers. */
export function getMilestoneBlockers(
  id: MilestoneId,
  dataset: Dataset = CURATED,
): Capability[] {
  const byId = capabilityById(dataset.capabilities);
  const milestone = milestoneById(dataset.milestones)[id];
  if (!milestone) return [];
  return milestone.caps
    .map((c) => byId[c])
    .filter((c) => c && c.status === "blocker");
}

/** Count of a milestone's required capabilities that are ready. */
export function getMilestoneReadyCount(
  id: MilestoneId,
  dataset: Dataset = CURATED,
): number {
  const byId = capabilityById(dataset.capabilities);
  const milestone = milestoneById(dataset.milestones)[id];
  if (!milestone) return 0;
  return milestone.caps.filter((c) => byId[c]?.status === "ready").length;
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

export function getSummary(dataset: Dataset = CURATED): Summary {
  return {
    overall: getOverallReadiness(dataset.capabilities),
    label: "Toward sustained lunar presence",
    statusCounts: getStatusCounts(dataset.capabilities),
    blockers: getBlockers(dataset.capabilities),
    nextMilestone: getNextMilestone(dataset.milestones),
    recentChanges: getRecentChanges(3, dataset.events),
    capabilityCount: dataset.capabilities.length,
    milestoneCount: dataset.milestones.length,
  };
}
