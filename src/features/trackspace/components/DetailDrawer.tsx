import { useEffect } from "react";

import { useDataset } from "../data/dataset-context";
import { isDiscoveryEvent } from "../data/discoveries";
import { STATUS } from "../data/seed";
import {
  capabilityById,
  eventById,
  getDownstream,
  getEventsForCapability,
  getEventsForMilestone,
  getLocationsForCapability,
  getLocationsForEvent,
  getLocationsForMilestone,
  locationById,
  milestoneById,
} from "../data/selectors";
import type {
  Capability,
  CapabilityId,
  CapabilityMetrics,
  Location,
  Milestone,
  MilestoneId,
  Source,
  TrackspaceEvent,
} from "../data/types";
import { ConfidenceChip } from "./ConfidenceChip";
import { StatusChip } from "./StatusChip";

export type DrawerSelection =
  | { type: "capability"; id: CapabilityId }
  | { type: "event"; id: string }
  | { type: "milestone"; id: MilestoneId }
  | { type: "location"; id: string };

type DetailDrawerProps = {
  selection: DrawerSelection;
  onOpen: (selection: DrawerSelection) => void;
  onClose: () => void;
};

export function DetailDrawer({ selection, onOpen, onClose }: DetailDrawerProps) {
  const dataset = useDataset();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  let kicker: string;
  let title: string;
  let meta: React.ReactNode;
  let body: React.ReactNode;

  if (selection.type === "event") {
    const event = eventById(dataset.events)[selection.id];
    if (!event) {
      console.error(`Trackspace: event not found: ${selection.id}`);
      return null;
    }
    kicker = `${event.future ? "PROJECTED EVENT" : "LOGGED EVENT"} · ${event.date}`;
    title = event.title;
    meta = (
      <>
        <StatusChip status={event.status} />
        <ConfidenceChip confidence={event.conf} />
        <span className="trackspace-cchip trackspace-cchip-up">
          {event.impact} impact
        </span>
      </>
    );
    body = <EventBody event={event} onOpen={onOpen} />;
  } else if (selection.type === "capability") {
    const capability = capabilityById(dataset.capabilities)[selection.id];
    if (!capability) {
      console.error(`Trackspace: capability not found: ${selection.id}`);
      return null;
    }
    kicker = `CAPABILITY · ${capability.short.toUpperCase()}`;
    title = capability.name;
    meta = (
      <>
        <StatusChip status={capability.status} />
        <ConfidenceChip confidence={capability.conf} />
        <span className="trackspace-cchip">{capability.readiness}% READY</span>
      </>
    );
    body = <CapabilityBody capability={capability} onOpen={onOpen} />;
  } else if (selection.type === "milestone") {
    const milestone = milestoneById(dataset.milestones)[selection.id];
    if (!milestone) {
      console.error(`Trackspace: milestone not found: ${selection.id}`);
      return null;
    }
    kicker = `MILESTONE · ${milestone.date}`;
    title = `${milestone.code} — ${milestone.name}`;
    meta = (
      <>
        <StatusChip status={milestone.status} />
        <span className="trackspace-cchip trackspace-cchip-up">
          {milestone.dateConf} date
        </span>
        {milestone.critical && (
          <span className="trackspace-cchip trackspace-cchip-critical">
            CRITICAL PATH
          </span>
        )}
      </>
    );
    body = <MilestoneBody milestone={milestone} onOpen={onOpen} />;
  } else {
    const location = locationById(dataset.locations)[selection.id];
    if (!location) {
      console.error(`Trackspace: location not found: ${selection.id}`);
      return null;
    }
    kicker = `${location.body.toUpperCase()} · ${formatLocationKind(location.kind)}`;
    title = location.name;
    meta = (
      <>
        <StatusChip status={location.status} />
        <ConfidenceChip confidence={location.conf} />
      </>
    );
    body = <LocationBody location={location} onOpen={onOpen} />;
  }

  return (
    <>
      <div className="trackspace-scrim" onClick={onClose} aria-hidden="true" />
      <aside
        className="trackspace-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="trackspace-drawer-head">
          <div className="trackspace-drawer-kicker">{kicker}</div>
          <h2>{title}</h2>
          <button
            type="button"
            className="trackspace-drawer-close"
            onClick={onClose}
            aria-label="Close details"
          >
            ✕
          </button>
          <div className="trackspace-drawer-meta">{meta}</div>
        </div>
        <div className="trackspace-drawer-body">{body}</div>
      </aside>
    </>
  );
}

function DrawerSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="trackspace-drawer-section">
      <div className="trackspace-drawer-label">{label}</div>
      {children}
    </div>
  );
}

function CapabilityTag({
  id,
  onOpen,
}: {
  id: CapabilityId;
  onOpen: (selection: DrawerSelection) => void;
}) {
  const capability = capabilityById(useDataset().capabilities)[id];
  if (!capability) return null;
  return (
    <button
      type="button"
      className="trackspace-captag"
      onClick={() => onOpen({ type: "capability", id })}
    >
      <span
        className={`trackspace-captag-dot trackspace-bg-${capability.status}`}
        aria-hidden="true"
      />
      {capability.short}
    </button>
  );
}

function sourceBadge(source: Source): string {
  if (source.ico) return source.ico;
  return source.publisher
    .replace(/[^A-Za-z0-9 ]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .slice(0, 4)
    .toUpperCase();
}

function sourceHref(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function sourceHost(href: string): string {
  return new URL(href).hostname.replace(/^www\./, "");
}

function SourceList({ sources }: { sources: Source[] }) {
  if (sources.length === 0) {
    return <p className="trackspace-muted">No sources linked yet.</p>;
  }
  return (
    <div className="trackspace-sources">
      {sources.map((source, index) => {
        const href = sourceHref(source.url);
        const title = `${source.publisher} · Tier ${source.tier}${source.date ? ` · ${source.date}` : ""}`;
        const content = (
          <>
            <span className="trackspace-source-ico">{sourceBadge(source)}</span>
            {source.title}
            <span className="trackspace-source-url">
              {href ? `↗ ${sourceHost(href)}` : "invalid source URL"}
            </span>
          </>
        );
        return href ? (
          <a
            className="trackspace-source"
            key={`${source.url}-${index}`}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            title={title}
          >
            {content}
          </a>
        ) : (
          <span
            className="trackspace-source"
            key={`${source.url}-${index}`}
            title={title}
          >
            {content}
          </span>
        );
      })}
    </div>
  );
}

function EventRow({
  event,
  onOpen,
  withConfidence,
}: {
  event: TrackspaceEvent;
  onOpen: (selection: DrawerSelection) => void;
  withConfidence?: boolean;
}) {
  return (
    <button
      type="button"
      className="trackspace-crow"
      onClick={() => onOpen({ type: "event", id: event.id })}
    >
      <span className="trackspace-crow-date">{event.date}</span>
      <span className="trackspace-crow-main">
        <span className="trackspace-crow-title">{event.title}</span>
        <span className="trackspace-crow-meta">
          <StatusChip status={event.status} />
          {withConfidence && <ConfidenceChip confidence={event.conf} />}
        </span>
      </span>
    </button>
  );
}

function LocationRow({
  location,
  onOpen,
}: {
  location: Location;
  onOpen: (selection: DrawerSelection) => void;
}) {
  return (
    <button
      type="button"
      className="trackspace-crow"
      onClick={() => onOpen({ type: "location", id: location.id })}
    >
      <span className="trackspace-crow-date">{location.body.toUpperCase()}</span>
      <span className="trackspace-crow-main">
        <span className="trackspace-crow-title">{location.name}</span>
        <span className="trackspace-crow-meta">
          <StatusChip status={location.status} />
          <ConfidenceChip confidence={location.conf} />
        </span>
      </span>
    </button>
  );
}

function LocationRows({
  locations,
  onOpen,
}: {
  locations: Location[];
  onOpen: (selection: DrawerSelection) => void;
}) {
  if (locations.length === 0) return null;
  return (
    <DrawerSection label="Related locations">
      <div className="trackspace-rows">
        {locations.map((location) => (
          <LocationRow key={location.id} location={location} onOpen={onOpen} />
        ))}
      </div>
    </DrawerSection>
  );
}

function EventBody({
  event,
  onOpen,
}: {
  event: TrackspaceEvent;
  onOpen: (selection: DrawerSelection) => void;
}) {
  const dataset = useDataset();
  const locations = getLocationsForEvent(event.id, dataset);

  return (
    <>
      <DrawerSection label="What happened">
        <p>{event.what}</p>
      </DrawerSection>
      <DrawerSection label="Confirmed">
        {event.confirmed.length ? (
          <ul className="trackspace-evidence-list is-ok">
            {event.confirmed.map((item) => (
              <li key={item}>
                <span className="trackspace-evidence-mark">✓</span>
                {item}
              </li>
            ))}
          </ul>
        ) : (
          <p className="trackspace-muted">
            {event.future
              ? "Nothing officially confirmed yet — projected event."
              : isDiscoveryEvent(event)
                ? "Nothing confirmed yet — unreviewed discovery lead."
                : "Nothing officially confirmed yet."}
          </p>
        )}
      </DrawerSection>
      <DrawerSection label="Open / Unknown">
        <ul className="trackspace-evidence-list is-open">
          {event.unknown.map((item) => (
            <li key={item}>
              <span className="trackspace-evidence-mark">?</span>
              {item}
            </li>
          ))}
        </ul>
      </DrawerSection>
      <DrawerSection label="Affected capabilities">
        <div className="trackspace-capset">
          {event.caps.map((id) => (
            <CapabilityTag key={id} id={id} onOpen={onOpen} />
          ))}
        </div>
      </DrawerSection>
      <LocationRows locations={locations} onOpen={onOpen} />
      <DrawerSection label="Possible downstream impact">
        <div className="trackspace-downbox">{event.downstream}</div>
      </DrawerSection>
      <DrawerSection label="Sources & provenance">
        <SourceList sources={event.sources} />
      </DrawerSection>
    </>
  );
}

function MetricRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="trackspace-metric">
      <span className="trackspace-metric-label">{label}</span>
      <span className="trackspace-metric-value">{children}</span>
    </div>
  );
}

function CapabilityMetricsSection({ metrics }: { metrics: CapabilityMetrics }) {
  const { provider, contract, funding, target, slip } = metrics;
  return (
    <DrawerSection label="Funding & schedule">
      <div className="trackspace-metrics">
        {provider && (
          <MetricRow label="Provider">
            {provider}
            {contract && (
              <span className="trackspace-metric-tag">{contract}</span>
            )}
          </MetricRow>
        )}
        {funding && <MetricRow label="Funding">{funding}</MetricRow>}
        {target && <MetricRow label="Target">{target}</MetricRow>}
        {slip && <MetricRow label="Schedule slip">{slip}</MetricRow>}
      </div>
    </DrawerSection>
  );
}

function CapabilityBody({
  capability,
  onOpen,
}: {
  capability: Capability;
  onOpen: (selection: DrawerSelection) => void;
}) {
  const dataset = useDataset();
  const downstream = getDownstream(capability.id, dataset.capabilities);
  const events = getEventsForCapability(capability.id, dataset.events);
  const locations = getLocationsForCapability(capability.id, dataset);
  const milestone = milestoneById(dataset.milestones)[capability.milestone];

  return (
    <>
      <DrawerSection label="Capability">
        <p>{capability.blurb}</p>
      </DrawerSection>
      <DrawerSection label="Readiness">
        <div className="trackspace-readiness-bar">
          <span
            className={`trackspace-bg-${capability.status}`}
            style={{ width: `${capability.readiness}%` }}
          />
        </div>
        <p className="trackspace-readiness-note">
          {capability.readiness}% · {STATUS[capability.status].desc}
        </p>
      </DrawerSection>
      {capability.metrics && (
        <CapabilityMetricsSection metrics={capability.metrics} />
      )}
      <DrawerSection label="Depends on (upstream)">
        {capability.deps.length ? (
          <div className="trackspace-capset">
            {capability.deps.map((id) => (
              <CapabilityTag key={id} id={id} onOpen={onOpen} />
            ))}
          </div>
        ) : (
          <p className="trackspace-muted">
            No upstream dependencies — this is a foundation capability.
          </p>
        )}
      </DrawerSection>
      <DrawerSection label="Blocks (downstream)">
        {downstream.length ? (
          <div className="trackspace-capset">
            {downstream.map((c) => (
              <CapabilityTag key={c.id} id={c.id} onOpen={onOpen} />
            ))}
          </div>
        ) : (
          <p className="trackspace-muted">
            Nothing currently depends on this node.
          </p>
        )}
      </DrawerSection>
      {milestone && (
        <DrawerSection label="Tied milestone">
          <button
            type="button"
            className="trackspace-crow"
            onClick={() => onOpen({ type: "milestone", id: milestone.id })}
          >
            <span className="trackspace-crow-date">{milestone.date}</span>
            <span className="trackspace-crow-main">
              <span className="trackspace-crow-title">
                {milestone.code} · {milestone.name}
              </span>
            </span>
          </button>
        </DrawerSection>
      )}
      {events.length > 0 && (
        <DrawerSection label="Related events">
          <div className="trackspace-rows">
            {events.map((event) => (
              <EventRow key={event.id} event={event} onOpen={onOpen} />
            ))}
          </div>
        </DrawerSection>
      )}
      <LocationRows locations={locations} onOpen={onOpen} />
      <DrawerSection label="Sources & provenance">
        <SourceList sources={capability.sources} />
      </DrawerSection>
    </>
  );
}

function formatLocationKind(kind: Location["kind"]): string {
  return kind.replaceAll("-", " ");
}

function formatCoordinate(value: number, positive: string, negative: string): string {
  const suffix = value >= 0 ? positive : negative;
  return `${Math.abs(value).toFixed(2)}°${suffix}`;
}

function LocationBody({
  location,
  onOpen,
}: {
  location: Location;
  onOpen: (selection: DrawerSelection) => void;
}) {
  const dataset = useDataset();
  const byCapability = capabilityById(dataset.capabilities);
  const byMilestone = milestoneById(dataset.milestones);
  const events = location.relatedEvents
    .map((id) => eventById(dataset.events)[id])
    .filter((event): event is TrackspaceEvent => Boolean(event));

  const coordinates =
    typeof location.lat === "number" && typeof location.lon === "number"
      ? `${formatCoordinate(location.lat, "N", "S")} · ${formatCoordinate(
          location.lon,
          "E",
          "W",
        )}`
      : "Orbit / region context";

  return (
    <>
      <DrawerSection label="Spatial anchor">
        <p>{location.summary}</p>
      </DrawerSection>
      <DrawerSection label="Coordinates">
        <div className="trackspace-metrics">
          <MetricRow label="Body">{location.body}</MetricRow>
          <MetricRow label="Type">{formatLocationKind(location.kind)}</MetricRow>
          <MetricRow label="Position">{coordinates}</MetricRow>
          {location.radiusKm && (
            <MetricRow label="Region radius">
              {location.radiusKm.toLocaleString()} km
            </MetricRow>
          )}
        </div>
      </DrawerSection>
      {location.relatedCapabilities.length > 0 && (
        <DrawerSection label="Related capabilities">
          <div className="trackspace-capset">
            {location.relatedCapabilities.map((id) =>
              byCapability[id] ? (
                <CapabilityTag key={id} id={id} onOpen={onOpen} />
              ) : null,
            )}
          </div>
        </DrawerSection>
      )}
      {events.length > 0 && (
        <DrawerSection label="Related events">
          <div className="trackspace-rows">
            {events.map((event) => (
              <EventRow key={event.id} event={event} onOpen={onOpen} />
            ))}
          </div>
        </DrawerSection>
      )}
      {location.relatedMilestones.length > 0 && (
        <DrawerSection label="Related milestones">
          <div className="trackspace-rows">
            {location.relatedMilestones.map((id) => {
              const milestone = byMilestone[id];
              if (!milestone) return null;
              return (
                <button
                  type="button"
                  className="trackspace-crow"
                  key={id}
                  onClick={() => onOpen({ type: "milestone", id })}
                >
                  <span className="trackspace-crow-date">{milestone.date}</span>
                  <span className="trackspace-crow-main">
                    <span className="trackspace-crow-title">
                      {milestone.code} · {milestone.name}
                    </span>
                    <span className="trackspace-crow-meta">
                      <StatusChip status={milestone.status} />
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </DrawerSection>
      )}
      <DrawerSection label="Sources & provenance">
        <SourceList sources={location.sources} />
      </DrawerSection>
    </>
  );
}

function MilestoneBody({
  milestone,
  onOpen,
}: {
  milestone: Milestone;
  onOpen: (selection: DrawerSelection) => void;
}) {
  const dataset = useDataset();
  const events = getEventsForMilestone(milestone.id, dataset);
  const locations = getLocationsForMilestone(milestone.id, dataset);

  return (
    <>
      <DrawerSection label="Objective">
        <p>{milestone.objective}</p>
      </DrawerSection>
      <DrawerSection label="Assessment">
        <p className="trackspace-muted">{milestone.summary}</p>
      </DrawerSection>
      <DrawerSection label="Required capabilities">
        <div className="trackspace-capset">
          {milestone.caps.map((id) => (
            <CapabilityTag key={id} id={id} onOpen={onOpen} />
          ))}
        </div>
      </DrawerSection>
      <DrawerSection label="Related events">
        <div className="trackspace-rows">
          {events.map((event) => (
            <EventRow key={event.id} event={event} onOpen={onOpen} withConfidence />
          ))}
        </div>
      </DrawerSection>
      <LocationRows locations={locations} onOpen={onOpen} />
      <DrawerSection label="Sources & provenance">
        <SourceList sources={milestone.sources} />
      </DrawerSection>
    </>
  );
}
