import { defineSchema, defineTable } from "convex/server";

import {
  capabilityValidator,
  eventValidator,
  ingestRunSummaryValidator,
  locationValidator,
  milestoneValidator,
} from "./validators";
import { v } from "convex/values";

export default defineSchema({
  capabilities: defineTable(capabilityValidator).index("by_public_id", ["id"]),
  milestones: defineTable(milestoneValidator).index("by_public_id", ["id"]),
  events: defineTable(eventValidator).index("by_public_id", ["id"]),
  locations: defineTable(locationValidator).index("by_public_id", ["id"]),
  discoveries: defineTable({
    url: v.string(),
    title: v.string(),
    source: v.string(),
    foundAt: v.string(),
    publishedAt: v.optional(v.string()),
    note: v.optional(v.string()),
    status: v.union(
      v.literal("new"),
      v.literal("triaged"),
      v.literal("reviewed"),
      v.literal("dismissed"),
    ),
  })
    .index("by_url", ["url"])
    .index("by_status", ["status", "foundAt"]),
  ingestionRuns: defineTable({
    startedAt: v.string(),
    finishedAt: v.string(),
    ok: v.boolean(),
    summary: ingestRunSummaryValidator,
  }).index("by_startedAt", ["startedAt"]),
  agentDecisions: defineTable({
    leadUrl: v.string(),
    decision: v.union(
      v.literal("dismiss"),
      v.literal("keep_as_signal"),
      v.literal("publish_event"),
      v.literal("update_event"),
    ),
    rationale: v.string(),
    citations: v.array(v.string()),
    model: v.string(),
    eventId: v.optional(v.string()),
    createdAt: v.string(),
  }).index("by_createdAt", ["createdAt"]),
});
