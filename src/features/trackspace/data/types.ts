// Trackspace content model.
//
// Mission names are real (Artemis / Moon-to-Mars program); status,
// readiness, and confidence values are invented for design purposes
// and are NOT factual claims.

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
};

export type Milestone = {
  id: MilestoneId;
  code: string;
  name: string;
  /** Display date: "2022-12", "2026-Q2", "2028+", "2030s". */
  date: string;
  dateConf: Confidence;
  status: Status;
  objective: string;
  /** Capabilities required by this milestone. */
  caps: CapabilityId[];
  critical: boolean;
  summary: string;
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
};

export type Source = {
  ico: string;
  title: string;
  url: string;
};

export type DependencyEdge = {
  from: CapabilityId;
  to: CapabilityId;
  /** Status of the upstream (from) capability; drives the edge color. */
  status: Status;
};
