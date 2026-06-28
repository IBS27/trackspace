import { sql } from "drizzle-orm";
import { check, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Summary recorded for each ingestion run, so the pipeline keeps an audit
// trail of what it refreshed and found. Defined here (not in src/ingest) so the
// schema has no dependency on the pipeline code.
export type IngestRunSummary = {
  capabilities: number;
  milestones: number;
  events: number;
  locations: number;
  sources: number;
  /** Records whose date/status was refreshed from a live feed. */
  reconciled: string[];
  /** New leads found in feeds, not yet promoted to public claims. */
  discoveries: number;
  /** Non-fatal problems (e.g. a feed that was unreachable this run). */
  warnings: string[];
};

// One row per pipeline run.
export const ingestionRuns = sqliteTable("ingestion_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  startedAt: text("started_at").notNull(),
  finishedAt: text("finished_at"),
  ok: integer("ok", { mode: "boolean" }).notNull(),
  summary: text("summary", { mode: "json" }).notNull().$type<IngestRunSummary>(),
});

export type DiscoveryStatus = "new" | "reviewed" | "dismissed";

// Discovery queue — unverified leads from feeds. Per the accuracy policy these
// create a review task, never a public claim, so they live in their own table
// and are not part of the Dataset the screens render.
export const discoveries = sqliteTable(
  "discoveries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    url: text("url").notNull().unique(),
    title: text("title").notNull(),
    source: text("source").notNull(),
    publishedAt: text("published_at"),
    foundAt: text("found_at").notNull(),
    status: text("status").notNull().$type<DiscoveryStatus>(),
    note: text("note"),
  },
  (t) => [
    check("discoveries_status_ck", sql`${t.status} in ('new', 'reviewed', 'dismissed')`),
  ],
);
