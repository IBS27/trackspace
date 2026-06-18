// Launch Library 2 (The Space Devs) client — a Tier-2 structured launch feed.
//
// We use it to keep the launch DATE and flight OUTCOME of known launch events
// current, not to mint new claims. The normalizer is pure so it can be tested
// against a fixture without a network call.
//
// API docs: https://thespacedevs.com/llapi

export type Ll2Launch = {
  id: string;
  name: string;
  missionName: string | null;
  /** ISO 8601 "no earlier than" target. */
  net: string;
  /** Precision of the NET ("Day", "Hour", "Second", …). */
  netPrecision: string | null;
  statusName: string | null;
  statusAbbrev: string | null;
  /** ISO 8601 timestamp the feed last updated this launch. */
  lastUpdated: string | null;
  provider: string | null;
  url: string | null;
};

const DEFAULT_BASE = "https://ll.thespacedevs.com/2.2.0";

/** LL2 base URL; override with LL2_BASE (e.g. the dev endpoint) for testing. */
export function ll2Base(): string {
  return (process.env.LL2_BASE ?? DEFAULT_BASE).replace(/\/+$/, "");
}

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

const str = (v: unknown): string | null => (typeof v === "string" ? v : null);

export function normalizeLaunch(raw: RawLaunch): Ll2Launch | null {
  const id = str(raw?.id);
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
    url: str(raw.url),
  };
}

/** True once a launch has actually flown (succeeded or failed), not still upcoming. */
export function hasFlown(launch: Ll2Launch): boolean {
  return (
    launch.statusAbbrev === "Success" ||
    launch.statusAbbrev === "Failure" ||
    launch.statusAbbrev === "Partial Failure"
  );
}

export function succeeded(launch: Ll2Launch): boolean {
  return launch.statusAbbrev === "Success";
}

/** Fetch Artemis launches, newest target first. Throws on a non-OK response. */
export async function fetchArtemisLaunches(opts?: {
  signal?: AbortSignal;
  limit?: number;
}): Promise<Ll2Launch[]> {
  const limit = opts?.limit ?? 30;
  const url = `${ll2Base()}/launch/?search=Artemis&limit=${limit}&ordering=net`;
  const res = await fetch(url, {
    signal: opts?.signal,
    headers: { "User-Agent": "trackspace-ingest (lunar readiness tracker)" },
  });
  if (!res.ok) {
    throw new Error(`Launch Library 2 responded ${res.status}`);
  }
  const json: unknown = await res.json();
  const results =
    json && typeof json === "object" && Array.isArray((json as { results?: unknown }).results)
      ? ((json as { results: RawLaunch[] }).results)
      : [];
  return results
    .map(normalizeLaunch)
    .filter((launch): launch is Ll2Launch => launch !== null);
}
