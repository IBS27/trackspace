import { v, type Infer } from "convex/values";

import { internal } from "./_generated/api";
import {
  internalAction,
  internalQuery,
  internalMutation,
  type ActionCtx,
  type MutationCtx,
} from "./_generated/server";
import {
  datasetValidator,
  discoveryLeadValidator,
  ingestRunSummaryValidator,
} from "./validators";
import { CURATED } from "../src/features/trackspace/data/selectors";
import type {
  Dataset,
  MilestoneId,
  Source,
} from "../src/features/trackspace/data/types";

const NETWORK_TIMEOUT_MS = 15_000;
/** Cap RSS bodies before regex parsing to limit ReDoS / memory abuse. */
const MAX_FEED_BYTES = 512_000;
const DEFAULT_LL2_BASE = "https://ll.thespacedevs.com/2.2.0";
const NASA_FEEDS = [
  "https://blogs.nasa.gov/artemis/feed/",
  "https://www.nasa.gov/feed/",
];
const LUNAR_TERMS =
  /\b(artemis|moon|lunar|gateway|orion|sls|hls|starship|blue moon|spacesuit|axemu|regolith|cislunar|rover|fission)\b/i;

type Ll2Launch = {
  id: string;
  name: string;
  missionName: string | null;
  net: string;
  netPrecision: string | null;
  statusName: string | null;
  statusAbbrev: string | null;
  lastUpdated: string | null;
  provider: string | null;
  url: string | null;
};

type FeedItem = {
  title: string;
  link: string;
  publishedAt: string | null;
  summary: string;
  categories: string[];
};

type StoredDataset = Infer<typeof datasetValidator>;
type DiscoveryLead = Infer<typeof discoveryLeadValidator>;
type IngestRunSummary = Infer<typeof ingestRunSummaryValidator>;

type RawLaunch = {
  id?: unknown;
  name?: unknown;
  net?: unknown;
  net_precision?: { name?: unknown } | null;
  status?: { name?: unknown; abbrev?: unknown } | null;
  last_updated?: unknown;
  launch_service_provider?: { name?: unknown } | null;
  mission?: { name?: unknown } | null;
  url?: unknown;
};

function cloneDataset(dataset: Dataset): Dataset {
  return JSON.parse(JSON.stringify(dataset)) as Dataset;
}

const str = (value: unknown): string | null =>
  typeof value === "string" ? value : null;

function httpsUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

async function readTextCapped(
  res: Response,
  maxBytes: number,
): Promise<string> {
  const lengthHeader = res.headers.get("content-length");
  if (lengthHeader) {
    const declared = Number(lengthHeader);
    if (Number.isFinite(declared) && declared > maxBytes) {
      throw new Error(`response exceeds ${maxBytes} bytes`);
    }
  }

  if (!res.body) {
    const text = await res.text();
    if (new TextEncoder().encode(text).byteLength > maxBytes) {
      throw new Error(`response exceeds ${maxBytes} bytes`);
    }
    return text;
  }

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error(`response exceeds ${maxBytes} bytes`);
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(merged);
}

function normalizeLaunch(raw: RawLaunch): Ll2Launch | null {
  const id = str(raw.id);
  if (!id) return null;
  return {
    id,
    name: str(raw.name) ?? "",
    missionName: str(raw.mission?.name),
    net: str(raw.net) ?? "",
    netPrecision: str(raw.net_precision?.name),
    statusName: str(raw.status?.name),
    statusAbbrev: str(raw.status?.abbrev),
    lastUpdated: str(raw.last_updated),
    provider: str(raw.launch_service_provider?.name),
    url: httpsUrl(str(raw.url)),
  };
}

function hasFlown(launch: Ll2Launch): boolean {
  return (
    launch.statusAbbrev === "Success" ||
    launch.statusAbbrev === "Failure" ||
    launch.statusAbbrev === "Partial Failure"
  );
}

function succeeded(launch: Ll2Launch): boolean {
  return launch.statusAbbrev === "Success";
}

function milestoneForLaunch(launch: Ll2Launch): MilestoneId | null {
  const key = (launch.missionName ?? launch.name).toLowerCase();
  if (/\bartemis iii\b/.test(key)) return "a3";
  if (/\bartemis ii\b/.test(key)) return "a2";
  if (/\bartemis i\b/.test(key)) return "a1";
  return null;
}

function withTimeout(signal?: AbortSignal): {
  signal: AbortSignal;
  done: () => void;
} {
  const controller = new AbortController();
  if (signal?.aborted) controller.abort();
  const timer = setTimeout(() => controller.abort(), NETWORK_TIMEOUT_MS);
  if (signal) signal.addEventListener("abort", () => controller.abort(), { once: true });
  return { signal: controller.signal, done: () => clearTimeout(timer) };
}

async function fetchArtemisLaunches(signal: AbortSignal): Promise<Ll2Launch[]> {
  const url = `${DEFAULT_LL2_BASE}/launch/?search=Artemis&limit=30&ordering=net`;
  const res = await fetch(url, {
    signal,
    headers: { "User-Agent": "trackspace-ingest (lunar readiness tracker)" },
  });
  if (!res.ok) throw new Error(`Launch Library 2 responded ${res.status}`);
  const json: unknown = await res.json();
  const results =
    json &&
    typeof json === "object" &&
    Array.isArray((json as { results?: unknown }).results)
      ? (json as { results: RawLaunch[] }).results
      : [];
  return results
    .map(normalizeLaunch)
    .filter((launch): launch is Ll2Launch => launch !== null);
}

function firstTag(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return match ? match[1] : null;
}

function decode(raw: string | null): string {
  if (!raw) return "";
  return raw
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseFeedItems(xml: string): FeedItem[] {
  const items: FeedItem[] = [];
  const itemRe = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let match: RegExpExecArray | null;
  while ((match = itemRe.exec(xml)) !== null) {
    const block = match[1];
    const title = decode(firstTag(block, "title"));
    const link = httpsUrl(decode(firstTag(block, "link")));
    if (!title || !link) continue;
    const pub = decode(firstTag(block, "pubDate"));
    const parsed = pub ? new Date(pub) : null;
    const categories = [...block.matchAll(/<category[^>]*>([\s\S]*?)<\/category>/gi)]
      .map((category) => decode(category[1]))
      .filter(Boolean);
    items.push({
      title,
      link,
      publishedAt:
        parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : null,
      summary: decode(firstTag(block, "description")).slice(0, 400),
      categories,
    });
  }
  return items;
}

function isLunarRelevant(item: FeedItem): boolean {
  return (
    LUNAR_TERMS.test(item.title) ||
    LUNAR_TERMS.test(item.summary) ||
    item.categories.some((category) => LUNAR_TERMS.test(category))
  );
}

async function fetchNasaItems(
  signal: AbortSignal,
): Promise<{ items: FeedItem[]; warnings: string[] }> {
  const all: FeedItem[] = [];
  const errors: string[] = [];
  for (const feed of NASA_FEEDS) {
    try {
      const res = await fetch(feed, {
        signal,
        headers: { "User-Agent": "trackspace-ingest (lunar readiness tracker)" },
      });
      if (!res.ok) throw new Error(`${feed} responded ${res.status}`);
      all.push(...parseFeedItems(await readTextCapped(res, MAX_FEED_BYTES)));
    } catch (error) {
      errors.push((error as Error).message);
    }
  }
  if (all.length === 0 && errors.length > 0) {
    throw new Error(`all NASA feeds failed: ${errors.join("; ")}`);
  }
  return {
    items: all,
    warnings: errors.map((message) => `NASA feed partial failure: ${message}`),
  };
}

async function reconcileLaunches(
  dataset: Dataset,
  runDate: string,
  signal?: AbortSignal,
): Promise<{ reconciled: string[]; warnings: string[] }> {
  const reconciled: string[] = [];
  const warnings: string[] = [];
  const { signal: timed, done } = withTimeout(signal);
  let launches: Ll2Launch[];
  try {
    launches = await fetchArtemisLaunches(timed);
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
    if (!milestoneId || reconciled.includes(milestoneId)) continue;

    const milestone = dataset.milestones.find((item) => item.id === milestoneId);
    if (!milestone) continue;

    milestone.lastVerified = runDate;
    milestone.sources = [
      ...milestone.sources.filter((source) => source.publisher !== "Launch Library 2"),
      launchSource(launch),
    ];

    if (hasFlown(launch) && succeeded(launch) && milestone.status !== "ready") {
      warnings.push(
        `${milestoneId}: LL2 reports ${
          launch.missionName ?? launch.name
        } succeeded, but curated status is "${milestone.status}" - review.`,
      );
    }
    if (!hasFlown(launch) && milestone.status === "ready") {
      warnings.push(
        `${milestoneId}: curated status is "ready" but LL2 still lists ${
          launch.missionName ?? launch.name
        } as "${launch.statusName ?? "upcoming"}" - review.`,
      );
    }
    reconciled.push(milestoneId);
  }

  return { reconciled, warnings };
}

function launchSource(launch: Ll2Launch): Source {
  return {
    publisher: "Launch Library 2",
    ico: "LL2",
    tier: 2,
    ...(launch.lastUpdated ? { date: launch.lastUpdated.slice(0, 10) } : {}),
    title: `Launch Library 2 - ${launch.name} (${
      launch.statusName ?? "status unknown"
    })`,
    url: launch.url ?? "https://thespacedevs.com/llapi",
  };
}

async function discoverFromFeeds(
  runStamp: string,
  signal?: AbortSignal,
): Promise<{ leads: DiscoveryLead[]; warnings: string[] }> {
  const { signal: timed, done } = withTimeout(signal);
  try {
    const result = await fetchNasaItems(timed);
    const leads = result.items
      .filter(isLunarRelevant)
      .map((item) => ({
        url: item.link,
        title: item.title,
        source: "NASA RSS",
        foundAt: runStamp,
        ...(item.publishedAt ? { publishedAt: item.publishedAt } : {}),
      }));
    return { leads, warnings: result.warnings };
  } catch (error) {
    return {
      leads: [],
      warnings: [`NASA feed unavailable: ${(error as Error).message}`],
    };
  } finally {
    done();
  }
}

function countSources(dataset: StoredDataset): number {
  return [
    ...dataset.capabilities,
    ...dataset.milestones,
    ...dataset.events,
    ...dataset.locations,
  ].reduce((total, item) => total + item.sources.length, 0);
}

async function upsertCapabilities(ctx: MutationCtx, dataset: StoredDataset) {
  const ids = new Set(dataset.capabilities.map((item) => item.id));
  for (const item of dataset.capabilities) {
    const existing = await ctx.db
      .query("capabilities")
      .withIndex("by_public_id", (q) => q.eq("id", item.id))
      .unique();
    if (existing) await ctx.db.replace("capabilities", existing._id, item);
    else await ctx.db.insert("capabilities", item);
  }
  for await (const row of ctx.db.query("capabilities")) {
    if (!ids.has(row.id)) await ctx.db.delete("capabilities", row._id);
  }
}

async function upsertMilestones(ctx: MutationCtx, dataset: StoredDataset) {
  const ids = new Set(dataset.milestones.map((item) => item.id));
  for (const item of dataset.milestones) {
    const existing = await ctx.db
      .query("milestones")
      .withIndex("by_public_id", (q) => q.eq("id", item.id))
      .unique();
    if (existing) await ctx.db.replace("milestones", existing._id, item);
    else await ctx.db.insert("milestones", item);
  }
  for await (const row of ctx.db.query("milestones")) {
    if (!ids.has(row.id)) await ctx.db.delete("milestones", row._id);
  }
}

async function upsertEvents(ctx: MutationCtx, dataset: StoredDataset) {
  const ids = new Set(dataset.events.map((item) => item.id));
  for (const item of dataset.events) {
    const existing = await ctx.db
      .query("events")
      .withIndex("by_public_id", (q) => q.eq("id", item.id))
      .unique();
    if (existing) await ctx.db.replace("events", existing._id, item);
    else await ctx.db.insert("events", item);
  }
  for await (const row of ctx.db.query("events")) {
    if (!ids.has(row.id)) await ctx.db.delete("events", row._id);
  }
}

async function upsertLocations(ctx: MutationCtx, dataset: StoredDataset) {
  const ids = new Set(dataset.locations.map((item) => item.id));
  for (const item of dataset.locations) {
    const existing = await ctx.db
      .query("locations")
      .withIndex("by_public_id", (q) => q.eq("id", item.id))
      .unique();
    if (existing) await ctx.db.replace("locations", existing._id, item);
    else await ctx.db.insert("locations", item);
  }
  for await (const row of ctx.db.query("locations")) {
    if (!ids.has(row.id)) await ctx.db.delete("locations", row._id);
  }
}

export const applyRun = internalMutation({
  args: {
    startedAt: v.string(),
    dataset: datasetValidator,
    reconciled: v.array(v.string()),
    warnings: v.array(v.string()),
    discoveryLeads: v.array(discoveryLeadValidator),
  },
  handler: async (ctx, args): Promise<IngestRunSummary> => {
    await upsertCapabilities(ctx, args.dataset);
    await upsertMilestones(ctx, args.dataset);
    await upsertEvents(ctx, args.dataset);
    await upsertLocations(ctx, args.dataset);

    let discoveries = 0;
    for (const lead of args.discoveryLeads) {
      const existing = await ctx.db
        .query("discoveries")
        .withIndex("by_url", (q) => q.eq("url", lead.url))
        .unique();
      if (!existing) {
        await ctx.db.insert("discoveries", { ...lead, status: "new" });
        discoveries += 1;
      }
    }

    const summary: IngestRunSummary = {
      capabilities: args.dataset.capabilities.length,
      milestones: args.dataset.milestones.length,
      events: args.dataset.events.length,
      locations: args.dataset.locations.length,
      sources: countSources(args.dataset),
      reconciled: args.reconciled,
      discoveries,
      warnings: args.warnings,
    };

    await ctx.db.insert("ingestionRuns", {
      startedAt: args.startedAt,
      finishedAt: new Date().toISOString(),
      ok: summary.warnings.length === 0,
      summary,
    });

    return summary;
  },
});

async function runIngest(
  ctx: ActionCtx,
  options: { offline: boolean; signal?: AbortSignal },
): Promise<IngestRunSummary> {
  const startedAt = new Date().toISOString();
  const runDate = startedAt.slice(0, 10);
  const dataset = cloneDataset(CURATED);
  const reconciled: string[] = [];
  const warnings: string[] = [];
  let discoveryLeads: DiscoveryLead[] = [];

  if (!options.offline) {
    const launchResult = await reconcileLaunches(dataset, runDate, options.signal);
    reconciled.push(...launchResult.reconciled);
    warnings.push(...launchResult.warnings);

    const feedResult = await discoverFromFeeds(startedAt, options.signal);
    discoveryLeads = feedResult.leads;
    warnings.push(...feedResult.warnings);
  }

  const summary: IngestRunSummary = await ctx.runMutation(internal.ingest.applyRun, {
    startedAt,
    dataset,
    reconciled,
    warnings,
    discoveryLeads,
  });
  return summary;
}

export const runManual = internalAction({
  args: {
    offline: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<IngestRunSummary> => {
    return await runIngest(ctx, { offline: args.offline ?? false });
  },
});

export const runScheduled = internalAction({
  args: {},
  handler: async (ctx): Promise<IngestRunSummary> => {
    return await runIngest(ctx, { offline: false });
  },
});

export const lastRun = internalQuery({
  args: {},
  handler: async (ctx) => {
    const last = await ctx.db
      .query("ingestionRuns")
      .withIndex("by_startedAt")
      .order("desc")
      .take(1);
    if (!last[0]) return null;
    const { _id, _creationTime, ...record } = last[0];
    void _id;
    void _creationTime;
    return record;
  },
});
