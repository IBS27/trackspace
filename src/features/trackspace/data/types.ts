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

export type SpatialBody = "earth" | "moon" | "cislunar";

export type LocationKind =
  | "launch-site"
  | "test-site"
  | "contractor-site"
  | "landing-region"
  | "surface-site"
  | "orbit";

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
  | "hab"
  | "eclss"
  | "rad"
  | "dust"
  | "night"
  | "ice"
  | "health"
  | "build"
  | "thermal";

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

/** How a contract prices risk — fixed-price shifts overruns to the vendor. */
export type ContractType =
  | "fixed-price"
  | "cost-plus"
  | "milestone-based"
  | "mixed";

export type RiskLevel = "low" | "medium" | "high";

export type RiskAssessment = {
  /** Probability the capability slips, fails, or is descoped. */
  likelihood: RiskLevel;
  /** Consequence to the lunar-base critical path if it does. */
  severity: RiskLevel;
};

/**
 * Program dimensions beyond technical readiness: who builds a capability, how
 * it is funded, what it must achieve, how far it has slipped, and its
 * programmatic risk. Every field is optional and populated only where the
 * public record supports it. Factual fields are drawn from the record's
 * attached `sources`; `risk` is an evidence-based assessment, like `status`
 * and `readiness`, kept deliberately separate from the readiness number.
 */
export type CapabilityMetrics = {
  /** Lead provider(s) building the capability. */
  provider?: string;
  /** Contract structure, where one exists. */
  contract?: ContractType;
  /** Funding or contract value, free-form (e.g. "$4.0B, HLS Option A+B"). */
  funding?: string;
  /** Headline quantitative target with units (e.g. "100 kWe by ~FY2030"). */
  target?: string;
  /** Schedule slip versus the original baseline, where documented. */
  slip?: string;
  /** Programmatic risk, separate from the readiness number. */
  risk?: RiskAssessment;
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
  /** Program dimensions (provider, funding, targets, slip, risk); optional. */
  metrics?: CapabilityMetrics;
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

export type Location = {
  id: string;
  name: string;
  body: SpatialBody;
  kind: LocationKind;
  /** Planetographic / selenographic degrees; absent for orbit-only anchors. */
  lat?: number;
  lon?: number;
  /** Optional region radius for broad landing zones or exploration areas. */
  radiusKm?: number;
  status: Status;
  conf: Confidence;
  summary: string;
  relatedCapabilities: CapabilityId[];
  relatedEvents: string[];
  relatedMilestones: MilestoneId[];
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
  locations: Location[];
};
