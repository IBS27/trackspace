// Load the curated baseline (src/features/trackspace/data/seed) into SQLite.
//
// Every write is an idempotent upsert keyed on the record id, so re-running the
// pipeline converges rather than duplicating. A record's sources are replaced
// wholesale (delete-by-entity, then insert) to stay in sync with the baseline.

import { and, eq } from "drizzle-orm";

import { type TrackspaceDb } from "@/db";
import {
  capabilities,
  events,
  milestones,
  sources,
  type SourceEntity,
} from "@/db/schema";
import { CURATED } from "@/features/trackspace/data/selectors";
import type { Dataset, Source } from "@/features/trackspace/data/types";

function replaceSources(
  db: TrackspaceDb,
  entityType: SourceEntity,
  entityId: string,
  list: Source[],
): number {
  db.delete(sources)
    .where(and(eq(sources.entityType, entityType), eq(sources.entityId, entityId)))
    .run();
  if (list.length === 0) return 0;
  db.insert(sources)
    .values(
      list.map((source, position) => ({
        entityType,
        entityId,
        position,
        publisher: source.publisher,
        title: source.title,
        url: source.url,
        tier: source.tier,
        date: source.date ?? null,
        ico: source.ico ?? null,
      })),
    )
    .run();
  return list.length;
}

export type SeedCounts = {
  capabilities: number;
  milestones: number;
  events: number;
  sources: number;
};

export function seedCurated(
  db: TrackspaceDb,
  dataset: Dataset = CURATED,
): SeedCounts {
  let sourceCount = 0;

  for (const c of dataset.capabilities) {
    const row = {
      id: c.id,
      name: c.name,
      short: c.short,
      group: c.group,
      status: c.status,
      conf: c.conf,
      readiness: c.readiness,
      blurb: c.blurb,
      milestone: c.milestone,
      deps: c.deps,
      lastVerified: c.lastVerified,
    };
    db.insert(capabilities)
      .values(row)
      .onConflictDoUpdate({ target: capabilities.id, set: row })
      .run();
    sourceCount += replaceSources(db, "capability", c.id, c.sources);
  }

  for (const m of dataset.milestones) {
    const row = {
      id: m.id,
      code: m.code,
      name: m.name,
      date: m.date,
      dateConf: m.dateConf,
      status: m.status,
      objective: m.objective,
      summary: m.summary,
      critical: m.critical,
      caps: m.caps,
      lastVerified: m.lastVerified,
    };
    db.insert(milestones)
      .values(row)
      .onConflictDoUpdate({ target: milestones.id, set: row })
      .run();
    sourceCount += replaceSources(db, "milestone", m.id, m.sources);
  }

  for (const e of dataset.events) {
    const row = {
      id: e.id,
      date: e.date,
      title: e.title,
      status: e.status,
      conf: e.conf,
      impact: e.impact,
      future: e.future,
      caps: e.caps,
      what: e.what,
      confirmed: e.confirmed,
      unknown: e.unknown,
      downstream: e.downstream,
      lastVerified: e.lastVerified,
    };
    db.insert(events)
      .values(row)
      .onConflictDoUpdate({ target: events.id, set: row })
      .run();
    sourceCount += replaceSources(db, "event", e.id, e.sources);
  }

  return {
    capabilities: dataset.capabilities.length,
    milestones: dataset.milestones.length,
    events: dataset.events.length,
    sources: sourceCount,
  };
}
