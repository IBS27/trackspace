import { useEffect } from "react";

import { STATUS } from "../data/seed";
import {
  CAPABILITY_BY_ID,
  EVENT_BY_ID,
  MILESTONE_BY_ID,
  getDownstream,
  getEventsForCapability,
  getEventsForMilestone,
  getSourcesForConfidence,
} from "../data/selectors";
import type {
  Capability,
  CapabilityId,
  Confidence,
  Milestone,
  MilestoneId,
  TrackspaceEvent,
} from "../data/types";
import { ConfidenceChip } from "./ConfidenceChip";
import { StatusChip } from "./StatusChip";

export type DrawerSelection =
  | { type: "capability"; id: CapabilityId }
  | { type: "event"; id: string }
  | { type: "milestone"; id: MilestoneId };

type DetailDrawerProps = {
  selection: DrawerSelection;
  onOpen: (selection: DrawerSelection) => void;
  onClose: () => void;
};

export function DetailDrawer({ selection, onOpen, onClose }: DetailDrawerProps) {
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
    const event = EVENT_BY_ID[selection.id];
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
    const capability = CAPABILITY_BY_ID[selection.id];
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
  } else {
    const milestone = MILESTONE_BY_ID[selection.id];
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
  const capability = CAPABILITY_BY_ID[id];
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

function SourceList({ confidence }: { confidence: Confidence }) {
  return (
    <div className="trackspace-sources">
      {getSourcesForConfidence(confidence).map((source) => (
        <span className="trackspace-source" key={source.title}>
          <span className="trackspace-source-ico">{source.ico}</span>
          {source.title}
          <span className="trackspace-source-url">↗ {source.url}</span>
        </span>
      ))}
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

function EventBody({
  event,
  onOpen,
}: {
  event: TrackspaceEvent;
  onOpen: (selection: DrawerSelection) => void;
}) {
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
            Nothing officially confirmed yet — projected event.
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
      <DrawerSection label="Possible downstream impact">
        <div className="trackspace-downbox">{event.downstream}</div>
      </DrawerSection>
      <DrawerSection label="Sources & provenance">
        <SourceList confidence={event.conf} />
      </DrawerSection>
    </>
  );
}

function CapabilityBody({
  capability,
  onOpen,
}: {
  capability: Capability;
  onOpen: (selection: DrawerSelection) => void;
}) {
  const downstream = getDownstream(capability.id);
  const events = getEventsForCapability(capability.id);
  const milestone = MILESTONE_BY_ID[capability.milestone];

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
      {events.length > 0 && (
        <DrawerSection label="Related events">
          <div className="trackspace-rows">
            {events.map((event) => (
              <EventRow key={event.id} event={event} onOpen={onOpen} />
            ))}
          </div>
        </DrawerSection>
      )}
      <DrawerSection label="Sources & provenance">
        <SourceList confidence={capability.conf} />
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
  const events = getEventsForMilestone(milestone.id);

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
      <DrawerSection label="Sources & provenance">
        <SourceList confidence={milestone.dateConf} />
      </DrawerSection>
    </>
  );
}
