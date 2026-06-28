import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import type { SourceTier } from "@/features/trackspace/data/types";

export type SourceEntity = "capability" | "milestone" | "event" | "location";

// Provenance — one row per (record, source) pair. `position` preserves the
// citation order; (entityType, entityId) groups a record's sources together,
// and is unique per position so a record can't accrue duplicate slots.
export const sources = sqliteTable(
  "sources",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    entityType: text("entity_type").notNull().$type<SourceEntity>(),
    entityId: text("entity_id").notNull(),
    position: integer("position").notNull(),
    publisher: text("publisher").notNull(),
    title: text("title").notNull(),
    url: text("url").notNull(),
    tier: integer("tier").notNull().$type<SourceTier>(),
    date: text("date"),
    ico: text("ico"),
  },
  (table) => [
    index("sources_entity_idx").on(table.entityType, table.entityId),
    uniqueIndex("sources_entity_position_unq").on(
      table.entityType,
      table.entityId,
      table.position,
    ),
    check("sources_tier_ck", sql`${table.tier} between 1 and 4`),
    check(
      "sources_entity_type_ck",
      sql`${table.entityType} in ('capability', 'milestone', 'event', 'location')`,
    ),
  ],
);
