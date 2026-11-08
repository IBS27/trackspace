"use client";

import { Fragment, useState } from "react";
import { ConfidenceChip } from "../components/ConfidenceChip";
import type { DrawerSelection } from "../components/DetailDrawer";
import { StatusChip } from "../components/StatusChip";
import { useDataset } from "../data/dataset-context";
import { STATUS, STATUS_LIST } from "../data/seed";
import { futureEventKind, getSortedEvents } from "../data/selectors";
import type { Status } from "../data/types";
import { ImpactTag } from "../components/ImpactTag";
import { useEdgeFade } from "../components/useEdgeFade";

const kindOf = futureEventKind;

function statusColor(status: Status): string {
  return `var(--ts-${status})`;
}

type TimelineScreenProps = {
  onOpen: (selection: DrawerSelection) => void;
};

export function TimelineScreen({ onOpen }: TimelineScreenProps) {
  const dataset = useDataset();
  const events = getSortedEvents(dataset.events);
  const firstFutureIndex = events.findIndex((e) => e.future);
  const [statusFilter, setStatusFilter] = useState<Status[]>([]);
  const filtersRef = useEdgeFade<HTMLDivElement>();

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
        <div
          ref={filtersRef}
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
            <span className="trackspace-tlnode-lg is-announced" />
            Announced
          </span>
          <span className="trackspace-dep-legend-item is-static">
            <span className="trackspace-tlnode-lg is-fut" />
            Target
          </span>
        </div>
      </div>

      <div className="trackspace-tlscroll">
        <div className="trackspace-tlwrap">
          <div className="trackspace-tlspine" aria-hidden="true" />
          {events.map((event, index) => (
            <Fragment key={event.id}>
              {index === firstFutureIndex && (
                <div className="trackspace-tlnow">
                  <span>Announced plans and targets</span>
                </div>
              )}
              <div
                className="trackspace-tlrow"
                style={{ opacity: shows(event.status) ? 1 : 0.18 }}
              >
                {kindOf(event) === "announced" ? (
                  // The date is when the plan was announced, not when it happens.
                  <div className="trackspace-tldate is-announced">
                    announced
                    <b className="trackspace-tabular">{event.date}</b>
                  </div>
                ) : (
                  <div className="trackspace-tldate">
                    <b className="trackspace-tabular">{event.date}</b>
                    {kindOf(event) === "target" && "target"}
                  </div>
                )}
                <div
                  className={`trackspace-tlnode${event.future ? ` is-fut is-${kindOf(event)}` : ""}`}
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
                  className={`trackspace-tlcard${event.future ? " is-fut" : ""}`}
                  onClick={() => onOpen({ type: "event", id: event.id })}
                >
                  <span className="trackspace-tlcard-title">{event.title}</span>
                  <span className="trackspace-tlcard-meta">
                    <StatusChip status={event.status} />
                    <ConfidenceChip confidence={event.conf} />
                    <ImpactTag impact={event.impact} />
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
