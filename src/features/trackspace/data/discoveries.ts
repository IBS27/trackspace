import type { TrackspaceEvent } from "./types";

/** A raw ingestion lead, as stored in the Convex `discoveries` table. */
export type DiscoveryLead = {
  url: string;
  title: string;
  source: string;
  foundAt: string;
  publishedAt?: string;
  status?: "new" | "triaged";
};

/**
 * Present a new or retained discovery lead as a low-grade timeline signal.
 * Leads carry only a headline and link, so the event stays at the bottom of the
 * trust ladder with a single tier-4 (discovery-only) source.
 */
export function discoveryToEvent(
  lead: DiscoveryLead,
  key: string,
): TrackspaceEvent {
  const date = (lead.publishedAt ?? lead.foundAt).slice(0, 10);
  const retained = lead.status === "triaged";
  return {
    id: `disc-${key}`,
    date,
    title: lead.title,
    status: "unknown",
    conf: "unverified",
    impact: "low",
    future: false,
    caps: [],
    what: retained
      ? `Assessed automatically and retained as a low-grade signal from ${lead.source}.`
      : `Surfaced automatically from ${lead.source}. Not yet reviewed — follow the source link for details.`,
    confirmed: [],
    unknown: [
      retained
        ? "Insufficient corroboration to publish as a graded timeline event."
        : "Not yet reviewed or cross-checked against curated sources.",
    ],
    downstream: retained
      ? "No timeline impact assigned — retained for situational awareness."
      : "Not assessed — automated discovery lead.",
    lastVerified: lead.foundAt.slice(0, 10),
    sources: [
      {
        publisher: lead.source,
        title: lead.title,
        url: lead.url,
        tier: 4,
        date,
      },
    ],
  };
}
