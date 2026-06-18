import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import type { SourceTier } from "@/features/trackspace/data/types";

export type SourceEntity = "capability" | "milestone" | "event";

// Provenance — one row per (record, source) pair. `position` preserves the
// citation order; (entityType, entityId) groups a record's sources together.
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
  (table) => [index("sources_entity_idx").on(table.entityType, table.entityId)],
);
