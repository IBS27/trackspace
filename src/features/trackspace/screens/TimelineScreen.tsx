"use client";

import { Fragment, useState } from "react";
import { ConfidenceChip } from "../components/ConfidenceChip";
import type { DrawerSelection } from "../components/DetailDrawer";
import { StatusChip } from "../components/StatusChip";
import { STATUS, STATUS_LIST } from "../data/seed";
import { getSortedEvents } from "../data/selectors";
import type { Impact, Status } from "../data/types";

const EVENTS = getSortedEvents();
const FIRST_FUTURE_INDEX = EVENTS.findIndex((e) => e.future);

const IMPACT_COLOR: Record<Impact, string> = {
  high: "var(--ts-watch)",
  med: "var(--ts-dim)",
  low: "var(--ts-faint)",
};

const MONTHS = [
  "jan", "feb", "mar", "apr", "may", "jun",
  "jul", "aug", "sep", "oct", "nov", "dec",
];

/** "now" marker label: the model knows events up to the latest logged one. */
function epochLabel(): string {
  const lastLogged = EVENTS.filter((e) => !e.future).at(-1);
  if (!lastLogged) return "now · model epoch";
  const [year, month] = lastLogged.date.split("-");
  const name = MONTHS[Number(month) - 1] ?? month;
  return `now · model epoch · ${name} ${year}`;
}

function statusColor(status: Status): string {
  return `var(--ts-${status})`;
}

type TimelineScreenProps = {
  onOpen: (selection: DrawerSelection) => void;
};

export function TimelineScreen({ onOpen }: TimelineScreenProps) {
  const [statusFilter, setStatusFilter] = useState<Status[]>([]);

  const toggle = (status: Status) =>
    setStatusFilter(
      statusFilter.includes(status)
        ? statusFilter.filter((s) => s !== status)
        : [...statusFilter, status],
    );
  const shows = (status: Status) =>
    statusFilter.length === 0 || statusFilter.includes(status);

  return (
    <div className="trackspace-tline">
      <div className="trackspace-dep-bar">
        <span className="trackspace-dep-title">Event Timeline</span>
        <div
          className="trackspace-dep-filters"
          role="group"
          aria-label="Status filters"
        >
          <button
            type="button"
            className={`trackspace-fchip${statusFilter.length === 0 ? " is-on" : ""}`}
            aria-pressed={statusFilter.length === 0}
            onClick={() => setStatusFilter([])}
          >
            All
          </button>
          {STATUS_LIST.map((status) => (
            <button
              type="button"
              key={status}
              className={`trackspace-fchip${statusFilter.includes(status) ? " is-on" : ""}`}
              aria-pressed={statusFilter.includes(status)}
              onClick={() => toggle(status)}
            >
              {STATUS[status].label}
            </button>
          ))}
        </div>
        <span className="trackspace-grow" />
        <div className="trackspace-dep-legend" aria-hidden="true">
          <span className="trackspace-dep-legend-item is-static">
            <span className="trackspace-tlnode-lg">
              <span />
            </span>
            Logged
          </span>
          <span className="trackspace-dep-legend-item is-static">
            <span className="trackspace-tlnode-lg is-fut" />
            Projected
          </span>
        </div>
      </div>

      <div className="trackspace-tlscroll">
        <div className="trackspace-tlwrap">
          <div className="trackspace-tlspine" aria-hidden="true" />
          {EVENTS.map((event, index) => (
            <Fragment key={event.id}>
              {index === FIRST_FUTURE_INDEX && (
                <div className="trackspace-tlnow">
                  <span>{epochLabel()}</span>
                </div>
              )}
              <div
                className="trackspace-tlrow"
                style={{ opacity: shows(event.status) ? 1 : 0.18 }}
              >
                <div className="trackspace-tldate">
                  <b className="trackspace-tabular">{event.date}</b>
                  {event.future ? "projected" : "logged"}
                </div>
                <div
                  className={`trackspace-tlnode${event.future ? " is-fut" : ""}`}
                  style={{ borderColor: statusColor(event.status) }}
                  aria-hidden="true"
                >
                  {!event.future && (
                    <span
                      className="trackspace-tlnode-core"
                      style={{ background: statusColor(event.status) }}
                    />
                  )}
                </div>
                <button
                  type="button"
                  className="trackspace-tlcard"
                  onClick={() => onOpen({ type: "event", id: event.id })}
                >
                  <span className="trackspace-tlcard-top">
                    <span className="trackspace-tlcard-title">
                      {event.title}
                    </span>
                    <span
                      className="trackspace-tlcard-impact"
                      style={{ color: IMPACT_COLOR[event.impact] }}
                    >
                      {event.impact} impact
                    </span>
                  </span>
                  <span className="trackspace-tlcard-meta">
                    <StatusChip status={event.status} />
                    <ConfidenceChip confidence={event.conf} />
                  </span>
                  <span className="trackspace-tlcard-what">{event.what}</span>
                </button>
              </div>
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
