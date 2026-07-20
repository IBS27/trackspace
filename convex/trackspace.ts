import { query } from "./_generated/server";

import { discoveryToEvent } from "../src/features/trackspace/data/discoveries";
import type {
  Capability,
  Dataset,
  Location,
  Milestone,
  TrackspaceEvent,
} from "../src/features/trackspace/data/types";

const MAX_RECORDS = 200;
/** Newest unreviewed or retained low-grade leads surfaced as signals. */
const MAX_DISCOVERIES = 20;

const CAPABILITY_ORDER = [
  "sls",
  "orion",
  "esm",
  "hls",
  "cryo",
  "suit",
  "gateway",
  "ltv",
  "comms",
  "power",
  "isru",
  "hab",
  "eclss",
  "rad",
  "dust",
  "night",
  "ice",
  "health",
  "build",
  "thermal",
] as const;

const MILESTONE_ORDER = ["a1", "a2", "a3", "gw", "base"] as const;

const LOCATION_ORDER = [
  "ksc-lc39b",
  "starbase",
  "cape-lc36",
  "stennis",
  "marshall",
  "lunar-south-pole",
  "mons-mouton",
  "im2-prime1",
  "mare-crisium-blue-ghost",
] as const;

function withoutSystemFields<T extends { _id: unknown; _creationTime: number }>(
  doc: T,
): Omit<T, "_id" | "_creationTime"> {
  const { _id, _creationTime, ...record } = doc;
  void _id;
  void _creationTime;
  return record;
}

function byKnownOrder<T extends { id: string }>(order: readonly string[]) {
  const index = new Map(order.map((id, position) => [id, position]));
  return (a: T, b: T) =>
    (index.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
    (index.get(b.id) ?? Number.MAX_SAFE_INTEGER);
}

export const dataset = query({
  args: {},
  handler: async (ctx): Promise<Dataset | null> => {
    const capabilities = (
      await ctx.db.query("capabilities").take(MAX_RECORDS)
    )
      .map(withoutSystemFields)
      .sort(byKnownOrder(CAPABILITY_ORDER)) as Capability[];

    if (capabilities.length === 0) return null;

    const milestones = (
      await ctx.db.query("milestones").take(MAX_RECORDS)
    )
      .map(withoutSystemFields)
      .sort(byKnownOrder(MILESTONE_ORDER)) as Milestone[];

    const events = (await ctx.db.query("events").take(MAX_RECORDS)).map(
      withoutSystemFields,
    ) as TrackspaceEvent[];

    const [newLeads, triagedLeads] = await Promise.all([
      ctx.db
        .query("discoveries")
        .withIndex("by_status", (q) => q.eq("status", "new"))
        .order("desc")
        .take(MAX_DISCOVERIES),
      ctx.db
        .query("discoveries")
        .withIndex("by_status", (q) => q.eq("status", "triaged"))
        .order("desc")
        .take(MAX_DISCOVERIES),
    ]);
    const leads = [...newLeads, ...triagedLeads]
      .sort((a, b) => b.foundAt.localeCompare(a.foundAt))
      .slice(0, MAX_DISCOVERIES);
    events.push(
      ...leads.map((lead) =>
        discoveryToEvent(
          {
            ...lead,
            status: lead.status === "triaged" ? "triaged" : "new",
          },
          lead._id,
        ),
      ),
    );

    const locations = (
      await ctx.db.query("locations").take(MAX_RECORDS)
    )
      .map(withoutSystemFields)
      .sort(byKnownOrder(LOCATION_ORDER)) as Location[];

    return { capabilities, milestones, events, locations };
  },
});
