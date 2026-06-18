// Read a Dataset from SQLite for the screens to render at request time.
//
// Server-only: this imports the better-sqlite3 client and must never be pulled
// into a client component. If the database is empty or unreachable, it falls
// back to the curated baseline so the app always renders the true status.

import { asc } from "drizzle-orm";

import { db, type TrackspaceDb } from "@/db";
import { capabilities, events, milestones, sources } from "@/db/schema";
import { CURATED } from "@/features/trackspace/data/selectors";
import type {
  Capability,
  Dataset,
  Milestone,
  Source,
  TrackspaceEvent,
} from "@/features/trackspace/data/types";

// The curated baseline defines the canonical display order; DB rows are sorted
// to match it (anything new sorts last) so the rail and graph stay stable.
const CAP_ORDER = new Map(CURATED.capabilities.map((c, i) => [c.id, i]));
const MS_ORDER = new Map(CURATED.milestones.map((m, i) => [m.id, i]));

function byOrder<T extends { id: string }>(order: Map<string, number>) {
  return (a: T, b: T) =>
    (order.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
    (order.get(b.id) ?? Number.MAX_SAFE_INTEGER);
}

function groupSources(
  rows: (typeof sources.$inferSelect)[],
): Map<string, Source[]> {
  const grouped = new Map<string, Source[]>();
  for (const row of rows) {
    const key = `${row.entityType}:${row.entityId}`;
    const source: Source = {
      publisher: row.publisher,
      title: row.title,
      url: row.url,
      tier: row.tier,
      ...(row.date ? { date: row.date } : {}),
      ...(row.ico ? { ico: row.ico } : {}),
    };
    const list = grouped.get(key);
    if (list) list.push(source);
    else grouped.set(key, [source]);
  }
  return grouped;
}

export function loadDataset(database: TrackspaceDb = db): Dataset {
  try {
    const capRows = database.select().from(capabilities).all();
    if (capRows.length === 0) return CURATED;

    const msRows = database.select().from(milestones).all();
    const evRows = database.select().from(events).all();
    const srcRows = database
      .select()
      .from(sources)
      .orderBy(asc(sources.position))
      .all();
    const sourcesByEntity = groupSources(srcRows);

    const capList: Capability[] = capRows
      .map((c) => ({ ...c, sources: sourcesByEntity.get(`capability:${c.id}`) ?? [] }))
      .sort(byOrder(CAP_ORDER));

    const msList: Milestone[] = msRows
      .map((m) => ({ ...m, sources: sourcesByEntity.get(`milestone:${m.id}`) ?? [] }))
      .sort(byOrder(MS_ORDER));

    const evList: TrackspaceEvent[] = evRows.map((e) => ({
      ...e,
      sources: sourcesByEntity.get(`event:${e.id}`) ?? [],
    }));

    return { capabilities: capList, milestones: msList, events: evList };
  } catch {
    // Missing/locked DB, unmigrated schema, etc. — render the baseline.
    return CURATED;
  }
}
