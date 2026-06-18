import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import type {
  CapabilityGroup,
  CapabilityId,
  Confidence,
  MilestoneId,
  Status,
} from "@/features/trackspace/data/types";

// Capabilities — the systems needed to live and work on the Moon. Dependency
// ids are stored as a JSON array; provenance lives in the `sources` table.
export const capabilities = sqliteTable("capabilities", {
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
});
