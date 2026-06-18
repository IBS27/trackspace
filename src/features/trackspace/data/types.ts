// Trackspace content model.
//
// Mission names, statuses, readiness, and confidence values are sourced from
// public NASA / OIG / GAO / ESA / contractor material and reputable reporting,
// current as of each record's `lastVerified` date. Every record carries the
// `sources` it is drawn from so a claim can always be traced to its evidence.

export type Status = "ready" | "watch" | "blocker" | "unknown";

export type Confidence =
  | "confirmed"
  | "reported"
  | "inferred"
  | "conceptual"
  | "unverified";

export type CapabilityGroup =
  | "launch"
  | "crew"
  | "landing"
  | "logistics"
  | "surface"
  | "comms";

export type Impact = "high" | "med" | "low";

export type CapabilityId =
  | "sls"
  | "orion"
  | "esm"
  | "hls"
  | "cryo"
  | "suit"
  | "gateway"
  | "ltv"
  | "comms"
  | "power"
  | "isru"
  | "hab";

export type MilestoneId = "a1" | "a2" | "a3" | "gw" | "base";

/** Source tier per the accuracy policy (1 = official, 4 = discovery-only). */
export type SourceTier = 1 | 2 | 3 | 4;

export type Source = {
  /** Publisher of the source, e.g. "NASA", "NASA OIG", "ESA", "SpaceNews". */
  publisher: string;
  title: string;
  url: string;
  tier: SourceTier;
  /** Publication date, "YYYY-MM-DD" or "YYYY-MM". */
  date?: string;
  /** Optional short badge override; otherwise derived from the publisher. */
  ico?: string;
};

export type StatusMeta = {
  id: Status;
  label: string;
  glyph: string;
  desc: string;
};

export type ConfidenceMeta = {
  id: Confidence;
  label: string;
  /** 1 (weakest) to 5 (strongest); drives the pip display. */
  rank: number;
  desc: string;
};

export type Capability = {
  id: CapabilityId;
  name: string;
  short: string;
  group: CapabilityGroup;
  status: Status;
  conf: Confidence;
  /** 0–100 estimate of how proven the capability is. */
  readiness: number;
  blurb: string;
  /** Upstream capabilities this one depends on. */
  deps: CapabilityId[];
  /** The milestone this capability is tied to. */
  milestone: MilestoneId;
  /** ISO date the record was last checked against its sources ("YYYY-MM-DD"). */
  lastVerified: string;
  sources: Source[];
};

export type Milestone = {
  id: MilestoneId;
  code: string;
  name: string;
  /** Display date: "2022-12", "2027-Q4", "2028+", "2030s". */
  date: string;
  dateConf: Confidence;
  status: Status;
  objective: string;
  /** Capabilities required by this milestone. */
  caps: CapabilityId[];
  critical: boolean;
  summary: string;
  lastVerified: string;
  sources: Source[];
};

export type TrackspaceEvent = {
  id: string;
  /** Display date; order with dateSortKey, not raw string comparison. */
  date: string;
  title: string;
  status: Status;
  conf: Confidence;
  impact: Impact;
  /** True for future targets, false for past events. */
  future: boolean;
  /** Capabilities affected by this event. */
  caps: CapabilityId[];
  what: string;
  confirmed: string[];
  unknown: string[];
  downstream: string;
  lastVerified: string;
  sources: Source[];
};

export type DependencyEdge = {
  from: CapabilityId;
  to: CapabilityId;
  /** Status of the upstream (from) capability; drives the edge color. */
  status: Status;
};

/**
 * A complete, self-contained snapshot of everything the screens render.
 * Selectors operate over a Dataset so the UI can be fed either the curated
 * baseline (compile-time) or a live snapshot loaded from SQLite (request-time).
 */
export type Dataset = {
  capabilities: Capability[];
  milestones: Milestone[];
  events: TrackspaceEvent[];
};
