import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import type {
  CapabilityId,
  Confidence,
  MilestoneId,
  Status,
} from "@/features/trackspace/data/types";

// Milestones — Artemis missions and later lunar buildout phases. Required
// capability ids are stored as a JSON array.
export const milestones = sqliteTable("milestones", {
  id: text("id").primaryKey().$type<MilestoneId>(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  date: text("date").notNull(),
  dateConf: text("date_conf").notNull().$type<Confidence>(),
  status: text("status").notNull().$type<Status>(),
  objective: text("objective").notNull(),
  summary: text("summary").notNull(),
  critical: integer("critical", { mode: "boolean" }).notNull(),
  caps: text("caps", { mode: "json" }).notNull().$type<CapabilityId[]>(),
  lastVerified: text("last_verified").notNull(),
});
