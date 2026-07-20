import type {
  CapabilityId,
  Confidence,
  Impact,
  Source,
  SourceTier,
  Status,
  TrackspaceEvent,
} from "../src/features/trackspace/data/types";

export const CAPABILITY_IDS = [
  "sls",
  "orion",
  "esm",
  "hls",
  "cryo",
  "suit",
  "gateway",
  "ltv",
  "comms",
  "power",
  "isru",
  "hab",
  "eclss",
  "rad",
  "dust",
  "night",
  "ice",
  "health",
  "build",
  "thermal",
] as const satisfies readonly CapabilityId[];

const STATUSES = ["ready", "watch", "blocker", "unknown"] as const;
const CONFIDENCES = [
  "confirmed",
  "reported",
  "inferred",
  "conceptual",
  "unverified",
] as const;
const IMPACTS = ["high", "med", "low"] as const;
const DECISIONS = [
  "dismiss",
  "keep_as_signal",
  "publish_event",
  "update_event",
] as const;
const SOURCE_TIERS = [1, 2, 3, 4] as const;
const OFFICIAL_DOMAINS = [
  "nasa.gov",
  "esa.int",
  "jaxa.jp",
  "asc-csa.gc.ca",
  "dlr.de",
  "cnsa.gov.cn",
  "gao.gov",
  "congress.gov",
  "faa.gov",
  "spaceforce.mil",
  "europa.eu",
  "gov.uk",
] as const;

export type AgentEventInput = Omit<TrackspaceEvent, "id" | "origin">;

export type AgentDecisionInput = {
  decision: (typeof DECISIONS)[number];
  targetEventId?: string;
  rationale: string;
  citations: string[];
  event?: AgentEventInput;
};

export type ValidatedAgentDecision = AgentDecisionInput;

type ValidationOptions = {
  leadUrl: string;
  consultedUrls: readonly string[];
  agentEventIds: readonly string[];
  verifiedOn: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string") throw new Error(`${key} must be a string`);
  return value;
}

function stringArrayField(
  record: Record<string, unknown>,
  key: string,
): string[] {
  const value = record[key];
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw new Error(`${key} must be an array of strings`);
  }
  return value;
}

function enumField<const T extends readonly (string | number)[]>(
  record: Record<string, unknown>,
  key: string,
  values: T,
): T[number] {
  const value = record[key];
  if (!values.includes(value as T[number])) {
    throw new Error(`${key} has an invalid value`);
  }
  return value as T[number];
}

function parseSource(value: unknown): Source {
  if (!isRecord(value)) throw new Error("source must be an object");
  const rawDate = value.date;
  return {
    publisher: stringField(value, "publisher"),
    title: stringField(value, "title"),
    url: stringField(value, "url"),
    tier: enumField(value, "tier", SOURCE_TIERS) as SourceTier,
    ...(typeof rawDate === "string" ? { date: rawDate } : {}),
  };
}

function parseEvent(value: unknown): AgentEventInput {
  if (!isRecord(value)) throw new Error("event must be an object");
  const sources = value.sources;
  if (!Array.isArray(sources)) throw new Error("event.sources must be an array");
  if (typeof value.future !== "boolean") {
    throw new Error("event.future must be a boolean");
  }
  return {
    date: stringField(value, "date"),
    title: stringField(value, "title"),
    status: enumField(value, "status", STATUSES) as Status,
    conf: enumField(value, "conf", CONFIDENCES) as Confidence,
    impact: enumField(value, "impact", IMPACTS) as Impact,
    future: value.future,
    caps: stringArrayField(value, "caps") as CapabilityId[],
    what: stringField(value, "what"),
    confirmed: stringArrayField(value, "confirmed"),
    unknown: stringArrayField(value, "unknown"),
    downstream: stringField(value, "downstream"),
    lastVerified: stringField(value, "lastVerified"),
    sources: sources.map(parseSource),
  };
}

export function parseAgentDecision(value: unknown): AgentDecisionInput {
  if (!isRecord(value)) throw new Error("decision output must be an object");
  const targetEventId = value.targetEventId;
  const event = value.event;
  if (
    targetEventId !== null &&
    targetEventId !== undefined &&
    typeof targetEventId !== "string"
  ) {
    throw new Error("targetEventId must be a string or null");
  }
  return {
    decision: enumField(value, "decision", DECISIONS),
    ...(typeof targetEventId === "string" ? { targetEventId } : {}),
    rationale: stringField(value, "rationale"),
    citations: stringArrayField(value, "citations"),
    ...(event !== null && event !== undefined ? { event: parseEvent(event) } : {}),
  };
}

function normalizedHttpsUrl(value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`invalid URL: ${value}`);
  }
  if (parsed.protocol !== "https:") throw new Error(`URL must use https: ${value}`);
  parsed.hash = "";
  return parsed.toString();
}

function tryNormalizedHttpsUrl(value: string): string | null {
  try {
    return normalizedHttpsUrl(value);
  } catch {
    return null;
  }
}

function baseDomain(value: string): string {
  const hostname = new URL(value).hostname.toLowerCase().replace(/^www\./, "");
  const official = OFFICIAL_DOMAINS.find(
    (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
  );
  if (official) return official;

  const labels = hostname.split(".");
  const secondLevel = labels.at(-2);
  const usesCountrySuffix =
    labels.at(-1)?.length === 2 &&
    secondLevel !== undefined &&
    ["ac", "co", "com", "gov", "net", "org"].includes(secondLevel);
  return labels.slice(usesCountrySuffix ? -3 : -2).join(".");
}

function isOfficialUrl(value: string): boolean {
  return OFFICIAL_DOMAINS.includes(
    baseDomain(value) as (typeof OFFICIAL_DOMAINS)[number],
  );
}

function validateText(value: string, field: string, max: number): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${field} must not be empty`);
  if (trimmed.length > max) throw new Error(`${field} exceeds ${max} characters`);
  return trimmed;
}

function normalizeEvent(
  event: AgentEventInput,
  citations: readonly string[],
  verifiedOn: string,
): AgentEventInput {
  if (!STATUSES.includes(event.status)) throw new Error("invalid event status");
  if (!CONFIDENCES.includes(event.conf)) throw new Error("invalid event confidence");
  if (!IMPACTS.includes(event.impact)) throw new Error("invalid event impact");
  if (event.caps.some((cap) => !CAPABILITY_IDS.includes(cap))) {
    throw new Error("event contains an unknown capability id");
  }
  if (event.sources.length === 0) throw new Error("event sources must not be empty");

  const citationSet = new Set(citations.map(normalizedHttpsUrl));
  const sources = event.sources.map((source) => {
    const url = normalizedHttpsUrl(source.url);
    if (!citationSet.has(url)) {
      throw new Error(`event source was not cited: ${source.url}`);
    }
    if (!SOURCE_TIERS.includes(source.tier)) throw new Error("invalid source tier");
    return {
      ...source,
      publisher: validateText(source.publisher, "source.publisher", 120),
      title: validateText(source.title, "source.title", 300),
      url,
      tier: source.tier === 1 && !isOfficialUrl(url) ? 2 : source.tier,
    };
  });
  if (!sources.some((source) => source.tier <= 3)) {
    throw new Error("published events require at least one tier 1-3 source");
  }

  const distinctDomains = new Set(citations.map(baseDomain));
  const confirmedEarned =
    citations.some(isOfficialUrl) && distinctDomains.size >= 2;

  return {
    ...event,
    date: validateText(event.date, "event.date", 40),
    title: validateText(event.title, "event.title", 300),
    conf:
      event.conf === "confirmed" && !confirmedEarned
        ? "reported"
        : event.conf,
    caps: [...new Set(event.caps)],
    what: validateText(event.what, "event.what", 2_000),
    confirmed: event.confirmed.map((item) =>
      validateText(item, "event.confirmed", 500),
    ),
    unknown: event.unknown.map((item) =>
      validateText(item, "event.unknown", 500),
    ),
    downstream: validateText(event.downstream, "event.downstream", 1_000),
    lastVerified: verifiedOn,
    sources,
  };
}

export function validateAgentDecision(
  input: AgentDecisionInput,
  options: ValidationOptions,
): ValidatedAgentDecision {
  if (!DECISIONS.includes(input.decision)) throw new Error("invalid decision");
  const rationale = validateText(input.rationale, "rationale", 1_000);
  if (input.citations.length === 0) throw new Error("citations must not be empty");

  const consulted = new Set(
    options.consultedUrls
      .map(tryNormalizedHttpsUrl)
      .filter((url): url is string => url !== null),
  );
  const citations = [...new Set(input.citations.map(normalizedHttpsUrl))];
  if (!citations.includes(normalizedHttpsUrl(options.leadUrl))) {
    throw new Error("citations must include the lead article URL");
  }
  for (const citation of citations) {
    if (!consulted.has(citation)) {
      throw new Error(`citation was not consulted: ${citation}`);
    }
  }

  if (input.decision === "dismiss" || input.decision === "keep_as_signal") {
    if (input.event || input.targetEventId) {
      throw new Error(`${input.decision} must not include an event target or body`);
    }
    return { decision: input.decision, rationale, citations };
  }

  if (!input.event) throw new Error(`${input.decision} requires an event`);
  if (input.decision === "publish_event" && input.targetEventId) {
    throw new Error("publish_event must not include targetEventId");
  }
  if (input.decision === "update_event") {
    if (!input.targetEventId) throw new Error("update_event requires targetEventId");
    if (!options.agentEventIds.includes(input.targetEventId)) {
      throw new Error("update_event target is not an existing agent event");
    }
  }

  return {
    decision: input.decision,
    ...(input.targetEventId ? { targetEventId: input.targetEventId } : {}),
    rationale,
    citations,
    event: normalizeEvent(input.event, citations, options.verifiedOn),
  };
}
