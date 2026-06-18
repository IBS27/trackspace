import { sql } from "drizzle-orm";
import { check, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import type {
  CapabilityId,
  Confidence,
  Impact,
  Status,
} from "@/features/trackspace/data/types";

// Events — tests, launches, reviews, slips, demos and future targets. Affected
// capabilities and the confirmed / unknown fact lists are stored as JSON arrays.
export const events = sqliteTable(
  "events",
  {
    id: text("id").primaryKey(),
    date: text("date").notNull(),
    title: text("title").notNull(),
    status: text("status").notNull().$type<Status>(),
    conf: text("conf").notNull().$type<Confidence>(),
    impact: text("impact").notNull().$type<Impact>(),
    future: integer("future", { mode: "boolean" }).notNull(),
    caps: text("caps", { mode: "json" }).notNull().$type<CapabilityId[]>(),
    what: text("what").notNull(),
    confirmed: text("confirmed", { mode: "json" }).notNull().$type<string[]>(),
    unknown: text("unknown", { mode: "json" }).notNull().$type<string[]>(),
    downstream: text("downstream").notNull(),
    lastVerified: text("last_verified").notNull(),
  },
  (t) => [
    check("events_status_ck", sql`${t.status} in ('ready', 'watch', 'blocker', 'unknown')`),
    check(
      "events_conf_ck",
      sql`${t.conf} in ('confirmed', 'reported', 'inferred', 'conceptual', 'unverified')`,
    ),
    check("events_impact_ck", sql`${t.impact} in ('high', 'med', 'low')`),
  ],
);
