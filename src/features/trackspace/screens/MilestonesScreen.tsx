"use client";

import { useState } from "react";
import { ConfidenceChip } from "../components/ConfidenceChip";
import type { DrawerSelection } from "../components/DetailDrawer";
import { StatusChip } from "../components/StatusChip";
import { useDataset } from "../data/dataset-context";
import { STATUS } from "../data/seed";
import {
  capabilityById,
  getEventsForMilestone,
  getMilestoneBlockers,
  getMilestoneReadyCount,
  milestoneById,
} from "../data/selectors";
import type { MilestoneId, Status } from "../data/types";

function statusColor(status: Status): string {
  return `var(--ts-${status})`;
}

type MilestonesScreenProps = {
  onOpen: (selection: DrawerSelection) => void;
};

export function MilestonesScreen({ onOpen }: MilestonesScreenProps) {
  const dataset = useDataset();
  const [current, setCurrent] = useState<MilestoneId>("a3");
  const capById = capabilityById(dataset.capabilities);
  const milestone = milestoneById(dataset.milestones)[current];
  const events = getEventsForMilestone(current, dataset);
  const blockers = getMilestoneBlockers(current, dataset);
  const readyCount = getMilestoneReadyCount(current, dataset);

  return (
    <div className="trackspace-mst">
      <nav className="trackspace-msrail" aria-label="Missions and phases">
        <div className="trackspace-msrail-head">Missions / Phases</div>
        {dataset.milestones.map((item) => (
          <button
            type="button"
            key={item.id}
            className={`trackspace-msri${current === item.id ? " is-on" : ""}`}
            aria-current={current === item.id ? "true" : undefined}
            onClick={() => setCurrent(item.id)}
          >
            <span className="trackspace-msri-main">
              <span className="trackspace-msri-code">{item.code}</span>
              <span className="trackspace-msri-name">{item.name}</span>
              <span className="trackspace-msri-detail">
                {item.date} · {STATUS[item.status].label.toUpperCase()}
                {item.critical && " · CRIT"}
              </span>
            </span>
            <span
              className="trackspace-msri-dot"
              style={{
                background: statusColor(item.status),
                boxShadow: `0 0 7px ${statusColor(item.status)}`,
              }}
              aria-hidden="true"
            />
          </button>
        ))}
      </nav>

      <div className="trackspace-mspage" key={current}>
        <div className="trackspace-mspage-kicker">
          {milestone.code} · target {milestone.date}
        </div>
        <h1>{milestone.name}</h1>
        <div className="trackspace-mspage-meta">
          <StatusChip status={milestone.status} />
          <span className="trackspace-cchip trackspace-cchip-up">
            {milestone.dateConf} date confidence
          </span>
          {milestone.critical && (
            <span className="trackspace-cchip trackspace-cchip-up trackspace-cchip-critical">
              ■ Critical path
            </span>
          )}
          <span className="trackspace-cchip trackspace-cchip-up trackspace-tabular">
            {readyCount}/{milestone.caps.length} caps ready
          </span>
        </div>
        <p className="trackspace-mspage-objective">{milestone.objective}</p>
        <div className="trackspace-assess">
          <span className="trackspace-assess-label">ASSESSMENT</span>
          {milestone.summary}
        </div>

        <div className="trackspace-mscols">
          <section className="trackspace-mssec">
            <h3>
              Required capabilities <b>{milestone.caps.length}</b>
            </h3>
            {milestone.caps.map((id) => {
              const capability = capById[id];
              return (
                <button
                  type="button"
                  className="trackspace-caprow"
                  key={id}
                  onClick={() => onOpen({ type: "capability", id })}
                >
                  <span
                    className="trackspace-caprow-dot"
                    style={{ background: statusColor(capability.status) }}
                    aria-hidden="true"
                  />
                  <span className="trackspace-caprow-name">
                    {capability.name}
                  </span>
                  <span className="trackspace-caprow-bar" aria-hidden="true">
                    <span
                      style={{
                        width: `${capability.readiness}%`,
                        background: statusColor(capability.status),
                      }}
                    />
                  </span>
                  <span className="trackspace-caprow-pct trackspace-tabular">
                    {capability.readiness}%
                  </span>
                </button>
              );
            })}

            <h3 className="trackspace-mssec-gap">
              Open blockers on path <b>{blockers.length}</b>
            </h3>
            {blockers.length > 0 ? (
              blockers.map((capability) => (
                <button
                  type="button"
                  className="trackspace-caprow"
                  key={capability.id}
                  onClick={() =>
                    onOpen({ type: "capability", id: capability.id })
                  }
                >
                  <span
                    className="trackspace-caprow-dot"
                    style={{ background: statusColor("blocker") }}
                    aria-hidden="true"
                  />
                  <span className="trackspace-caprow-name">
                    {capability.name}
                  </span>
                  <span className="trackspace-caprow-flag">BLOCKER</span>
                </button>
              ))
            ) : (
              <p className="trackspace-mssec-empty">
                No hard blockers on the required set — risk is in Watch items.
              </p>
            )}
          </section>

          <section className="trackspace-mssec">
            <h3>
              Related events <b>{events.length}</b>
            </h3>
            <div className="trackspace-rows">
              {events.length > 0 ? (
                events.map((event) => (
                  <button
                    type="button"
                    className="trackspace-crow"
                    key={event.id}
                    onClick={() => onOpen({ type: "event", id: event.id })}
                  >
                    <span className="trackspace-crow-date">{event.date}</span>
                    <span className="trackspace-crow-main">
                      <span className="trackspace-crow-title">
                        {event.title}
                      </span>
                      <span className="trackspace-crow-meta">
                        <StatusChip status={event.status} />
                        <ConfidenceChip confidence={event.conf} />
                      </span>
                    </span>
                  </button>
                ))
              ) : (
                <p className="trackspace-mssec-empty">
                  No logged events tied to this phase yet.
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
