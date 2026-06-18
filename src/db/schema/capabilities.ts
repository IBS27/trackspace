import { sql } from "drizzle-orm";
import { check, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import type {
  CapabilityGroup,
  CapabilityId,
  Confidence,
  MilestoneId,
  Status,
} from "@/features/trackspace/data/types";

// Capabilities — the systems needed to live and work on the Moon. Dependency
// ids are stored as a JSON array; provenance lives in the `sources` table.
// CHECK constraints mirror the TypeScript unions at the DB layer.
export const capabilities = sqliteTable(
  "capabilities",
  {
    id: text("id").primaryKey().$type<CapabilityId>(),
    name: text("name").notNull(),
    short: text("short").notNull(),
    group: text("capability_group").notNull().$type<CapabilityGroup>(),
    status: text("status").notNull().$type<Status>(),
    conf: text("conf").notNull().$type<Confidence>(),
    readiness: integer("readiness").notNull(),
    blurb: text("blurb").notNull(),
    milestone: text("milestone").notNull().$type<MilestoneId>(),
    deps: text("deps", { mode: "json" }).notNull().$type<CapabilityId[]>(),
    lastVerified: text("last_verified").notNull(),
  },
  (t) => [
    check("capabilities_status_ck", sql`${t.status} in ('ready', 'watch', 'blocker', 'unknown')`),
    check(
      "capabilities_conf_ck",
      sql`${t.conf} in ('confirmed', 'reported', 'inferred', 'conceptual', 'unverified')`,
    ),
    check(
      "capabilities_group_ck",
      sql`${t.group} in ('launch', 'crew', 'landing', 'logistics', 'surface', 'comms')`,
    ),
    check("capabilities_readiness_ck", sql`${t.readiness} between 0 and 100`),
  ],
);
