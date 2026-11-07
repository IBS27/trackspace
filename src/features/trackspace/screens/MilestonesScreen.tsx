"use client";

import { useState } from "react";
import type { DrawerSelection } from "../components/DetailDrawer";
import { ClampedText, EventRow } from "../components/DetailDrawer";
import { ConfidenceChip } from "../components/ConfidenceChip";
import { StatusChip } from "../components/StatusChip";
import { useActiveIntoView } from "../components/useActiveIntoView";
import { useDataset } from "../data/dataset-context";
import { STATUS } from "../data/seed";
import {
  capabilityById,
  getEventsForMilestone,
  getMilestoneReadyCount,
  milestoneById,
  displayCode,
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
  const readyCount = getMilestoneReadyCount(current, dataset);
  const railRef = useActiveIntoView<HTMLElement>(".trackspace-msri.is-on", current);

  return (
    <div className="trackspace-mst">
      <nav ref={railRef} className="trackspace-msrail" aria-label="Missions and phases">
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
              <span className="trackspace-msri-code">{displayCode(item.code)}</span>
              <span className="trackspace-msri-name">{item.name}</span>
              <span className="trackspace-msri-detail">
                {item.date} · {STATUS[item.status].label}
                {item.critical && " · Critical path"}
              </span>
            </span>
            <span
              className="trackspace-msri-dot"
              style={{ background: statusColor(item.status) }}
              aria-hidden="true"
            />
          </button>
        ))}
      </nav>

      <div className="trackspace-mspage" key={current}>
        <div className="trackspace-eyebrow">
          {displayCode(milestone.code)} · target {milestone.date}
        </div>
        <h1>{milestone.name}</h1>
        <div className="trackspace-page-meta">
          <StatusChip status={milestone.status} />
          <span className="trackspace-tag">
            Date confidence <ConfidenceChip confidence={milestone.dateConf} />
          </span>
          {milestone.critical && (
            <span className="trackspace-tag is-critical">Critical path</span>
          )}
          <span className="trackspace-tag trackspace-tabular">
            {readyCount}/{milestone.caps.length} capabilities ready
          </span>
        </div>
        <ClampedText text={milestone.objective} className="trackspace-page-lede" />
        <div className="trackspace-note">
          <span className="trackspace-eyebrow">Assessment</span>
          <ClampedText text={milestone.summary} />
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
                  {/* Blockers on the path are flagged in place, not listed twice. */}
                  {capability.status === "blocker" && (
                    <span className="trackspace-caprow-flag">Blocker</span>
                  )}
                </button>
              );
            })}

          </section>

          <section className="trackspace-mssec">
            <h3>
              Related events <b>{events.length}</b>
            </h3>
            <div className="trackspace-rows">
              {events.length > 0 ? (
                events.map((event) => (
                  <EventRow
                    key={event.id}
                    event={event}
                    onOpen={onOpen}
                    withConfidence
                  />
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
