// Ingestion pipeline — the "find it, keep it current, discover new" engine.
//
// One run:
//   1. ensure the schema exists,
//   2. load the curated, source-backed baseline into SQLite,
//   3. reconcile launch milestones against the live Launch Library 2 feed
//      (refresh provenance + lastVerified, flag any status drift),
//   4. scan NASA's feed for new lunar items and queue them as discoveries,
//   5. record the run.
//
// Steps 3–4 are best-effort: a network failure is recorded as a warning, never
// fatal, so the curated truth is always loaded even offline. Per the accuracy
// policy, feed data refreshes provenance and creates review leads — it never
// silently overwrites a curated status.

import { eq, sql } from "drizzle-orm";

import { db, type TrackspaceDb } from "@/db";
import { ensureSchema } from "@/db/migrate";
import {
  discoveries,
  ingestionRuns,
  milestones,
  sources,
  type IngestRunSummary,
} from "@/db/schema";
import type { MilestoneId } from "@/features/trackspace/data/types";
import {
  fetchArtemisLaunches,
  hasFlown,
  succeeded,
  type Ll2Launch,
} from "./launch-library";
import { fetchNasaItems, isLunarRelevant } from "./nasa-feed";
import { seedCurated } from "./seed-db";

const NETWORK_TIMEOUT_MS = 15_000;

// Map a Launch Library 2 mission to its milestone. Check the most specific
// roman numeral first so "Artemis II" doesn't also match "Artemis I".
function milestoneForLaunch(launch: Ll2Launch): MilestoneId | null {
  const key = (launch.missionName ?? launch.name).toLowerCase();
  if (/\bartemis iii\b/.test(key)) return "a3";
  if (/\bartemis ii\b/.test(key)) return "a2";
  if (/\bartemis i\b/.test(key)) return "a1";
  return null;
}

function withTimeout(signal?: AbortSignal): { signal: AbortSignal; done: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), NETWORK_TIMEOUT_MS);
  if (signal) signal.addEventListener("abort", () => controller.abort(), { once: true });
  return { signal: controller.signal, done: () => clearTimeout(timer) };
}

/**
 * Cross-check launch milestones against Launch Library 2: refresh each matched
 * milestone's lastVerified, attach an LL2 corroborating source, and flag any
 * milestone whose curated status disagrees with the live flight outcome.
 */
async function reconcileLaunches(
  database: TrackspaceDb,
  runDate: string,
  signal?: AbortSignal,
): Promise<{ reconciled: string[]; warnings: string[] }> {
  const reconciled: string[] = [];
  const warnings: string[] = [];
  const { signal: timed, done } = withTimeout(signal);
  let launches: Ll2Launch[];
  try {
    launches = await fetchArtemisLaunches({ signal: timed });
  } catch (error) {
    return {
      reconciled,
      warnings: [`Launch Library 2 unavailable: ${(error as Error).message}`],
    };
  } finally {
    done();
  }

  for (const launch of launches) {
    const milestoneId = milestoneForLaunch(launch);
    if (!milestoneId) continue;

    const milestone = database
      .select()
      .from(milestones)
      .where(eq(milestones.id, milestoneId))
      .get();
    if (!milestone || reconciled.includes(milestoneId)) continue;

    database
      .update(milestones)
      .set({ lastVerified: runDate })
      .where(eq(milestones.id, milestoneId))
      .run();

    // Attach LL2 as a corroborating Tier-2 source (replaced every run, so this
    // converges rather than duplicating).
    database
      .insert(sources)
      .values({
        entityType: "milestone",
        entityId: milestoneId,
        position: 90,
        publisher: "Launch Library 2",
        ico: "LL2",
        tier: 2,
        date: launch.lastUpdated?.slice(0, 10) ?? null,
        title: `Launch Library 2 — ${launch.name} (${launch.statusName ?? "status unknown"})`,
        url: launch.url ?? "https://thespacedevs.com/llapi",
      })
      .run();

    if (hasFlown(launch) && succeeded(launch) && milestone.status !== "ready") {
      warnings.push(
        `${milestoneId}: LL2 reports ${launch.missionName ?? launch.name} succeeded, but curated status is "${milestone.status}" — review.`,
      );
    }
    if (!hasFlown(launch) && milestone.status === "ready") {
      warnings.push(
        `${milestoneId}: curated status is "ready" but LL2 still lists ${launch.missionName ?? launch.name} as "${launch.statusName ?? "upcoming"}" — review.`,
      );
    }
    reconciled.push(milestoneId);
  }

  return { reconciled, warnings };
}

/** Queue new lunar-relevant NASA feed items as discovery leads (idempotent on URL). */
async function discoverFromFeeds(
  database: TrackspaceDb,
  runStamp: string,
  signal?: AbortSignal,
): Promise<{ discoveries: number; warnings: string[] }> {
  const { signal: timed, done } = withTimeout(signal);
  try {
    const items = (await fetchNasaItems({ signal: timed })).filter(isLunarRelevant);
    let added = 0;
    for (const item of items) {
      const result = database
        .insert(discoveries)
        .values({
          url: item.link,
          title: item.title,
          source: "NASA RSS",
          publishedAt: item.publishedAt,
          foundAt: runStamp,
          status: "new",
        })
        .onConflictDoNothing({ target: discoveries.url })
        .run();
      added += result.changes;
    }
    return { discoveries: added, warnings: [] };
  } catch (error) {
    return {
      discoveries: 0,
      warnings: [`NASA feed unavailable: ${(error as Error).message}`],
    };
  } finally {
    done();
  }
}

export type RunIngestOptions = {
  /** Skip live feeds; load and verify the curated baseline only. */
  offline?: boolean;
  signal?: AbortSignal;
};

export async function runIngest(
  database: TrackspaceDb = db,
  options: RunIngestOptions = {},
): Promise<IngestRunSummary> {
  const startedAt = new Date().toISOString();
  const runDate = startedAt.slice(0, 10);

  ensureSchema(database);
  const seeded = seedCurated(database);

  const reconciled: string[] = [];
  const warnings: string[] = [];
  let discovered = 0;

  if (!options.offline) {
    const launchResult = await reconcileLaunches(database, runDate, options.signal);
    reconciled.push(...launchResult.reconciled);
    warnings.push(...launchResult.warnings);

    const feedResult = await discoverFromFeeds(database, startedAt, options.signal);
    discovered = feedResult.discoveries;
    warnings.push(...feedResult.warnings);
  }

  const sourceCount = database
    .select({ count: sql<number>`count(*)` })
    .from(sources)
    .get();

  const summary: IngestRunSummary = {
    capabilities: seeded.capabilities,
    milestones: seeded.milestones,
    events: seeded.events,
    sources: sourceCount?.count ?? seeded.sources,
    reconciled,
    discoveries: discovered,
    warnings,
  };

  database
    .insert(ingestionRuns)
    .values({
      startedAt,
      finishedAt: new Date().toISOString(),
      ok: warnings.length === 0,
      summary,
    })
    .run();

  return summary;
}
