import { v } from "convex/values";

const statusValidator = v.union(
  v.literal("ready"),
  v.literal("watch"),
  v.literal("blocker"),
  v.literal("unknown"),
);

const confidenceValidator = v.union(
  v.literal("confirmed"),
  v.literal("reported"),
  v.literal("inferred"),
  v.literal("conceptual"),
  v.literal("unverified"),
);

const capabilityGroupValidator = v.union(
  v.literal("launch"),
  v.literal("crew"),
  v.literal("landing"),
  v.literal("logistics"),
  v.literal("surface"),
  v.literal("comms"),
);

const impactValidator = v.union(
  v.literal("high"),
  v.literal("med"),
  v.literal("low"),
);

const spatialBodyValidator = v.union(
  v.literal("earth"),
  v.literal("moon"),
  v.literal("cislunar"),
);

const locationKindValidator = v.union(
  v.literal("launch-site"),
  v.literal("test-site"),
  v.literal("contractor-site"),
  v.literal("landing-region"),
  v.literal("surface-site"),
  v.literal("orbit"),
);

const sourceTierValidator = v.union(
  v.literal(1),
  v.literal(2),
  v.literal(3),
  v.literal(4),
);

const contractTypeValidator = v.union(
  v.literal("fixed-price"),
  v.literal("cost-plus"),
  v.literal("milestone-based"),
  v.literal("mixed"),
);

const riskLevelValidator = v.union(
  v.literal("low"),
  v.literal("medium"),
  v.literal("high"),
);

export const sourceValidator = v.object({
  publisher: v.string(),
  title: v.string(),
  url: v.string(),
  tier: sourceTierValidator,
  date: v.optional(v.string()),
  ico: v.optional(v.string()),
});

const riskAssessmentValidator = v.object({
  likelihood: riskLevelValidator,
  severity: riskLevelValidator,
});

export const capabilityMetricsValidator = v.object({
  provider: v.optional(v.string()),
  contract: v.optional(contractTypeValidator),
  funding: v.optional(v.string()),
  target: v.optional(v.string()),
  slip: v.optional(v.string()),
  risk: v.optional(riskAssessmentValidator),
});

export const capabilityValidator = v.object({
  id: v.string(),
  name: v.string(),
  short: v.string(),
  group: capabilityGroupValidator,
  status: statusValidator,
  conf: confidenceValidator,
  readiness: v.number(),
  blurb: v.string(),
  deps: v.array(v.string()),
  milestone: v.string(),
  metrics: v.optional(capabilityMetricsValidator),
  lastVerified: v.string(),
  sources: v.array(sourceValidator),
});

export const milestoneValidator = v.object({
  id: v.string(),
  code: v.string(),
  name: v.string(),
  date: v.string(),
  dateConf: confidenceValidator,
  status: statusValidator,
  objective: v.string(),
  caps: v.array(v.string()),
  critical: v.boolean(),
  summary: v.string(),
  lastVerified: v.string(),
  sources: v.array(sourceValidator),
});

export const eventValidator = v.object({
  id: v.string(),
  date: v.string(),
  title: v.string(),
  status: statusValidator,
  conf: confidenceValidator,
  impact: impactValidator,
  future: v.boolean(),
  caps: v.array(v.string()),
  what: v.string(),
  confirmed: v.array(v.string()),
  unknown: v.array(v.string()),
  downstream: v.string(),
  lastVerified: v.string(),
  sources: v.array(sourceValidator),
});

export const locationValidator = v.object({
  id: v.string(),
  name: v.string(),
  body: spatialBodyValidator,
  kind: locationKindValidator,
  lat: v.optional(v.number()),
  lon: v.optional(v.number()),
  radiusKm: v.optional(v.number()),
  status: statusValidator,
  conf: confidenceValidator,
  summary: v.string(),
  relatedCapabilities: v.array(v.string()),
  relatedEvents: v.array(v.string()),
  relatedMilestones: v.array(v.string()),
  lastVerified: v.string(),
  sources: v.array(sourceValidator),
});

export const datasetValidator = v.object({
  capabilities: v.array(capabilityValidator),
  milestones: v.array(milestoneValidator),
  events: v.array(eventValidator),
  locations: v.array(locationValidator),
});

export const ingestRunSummaryValidator = v.object({
  capabilities: v.number(),
  milestones: v.number(),
  events: v.number(),
  locations: v.number(),
  sources: v.number(),
  reconciled: v.array(v.string()),
  discoveries: v.number(),
  warnings: v.array(v.string()),
});

export const discoveryLeadValidator = v.object({
  url: v.string(),
  title: v.string(),
  source: v.string(),
  foundAt: v.string(),
  publishedAt: v.optional(v.string()),
  note: v.optional(v.string()),
});
