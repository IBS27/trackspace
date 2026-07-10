import { useCallback, useMemo, type CSSProperties } from "react";

import { ConfidenceChip } from "../components/ConfidenceChip";
import type { DrawerSelection } from "../components/DetailDrawer";
import { StatusChip } from "../components/StatusChip";
import { useDataset } from "../data/dataset-context";
import { STATUS, STATUS_LIST } from "../data/seed";
import {
  getSceneLocations,
  getSummary,
  getUpcomingMilestones,
} from "../data/selectors";
import { EarthMoonScene } from "../scene/EarthMoonScene";

type CommandCenterProps = {
  onOpen: (selection: DrawerSelection) => void;
};

export function CommandCenter({ onOpen }: CommandCenterProps) {
  const dataset = useDataset();
  const summary = getSummary(dataset);
  const upcomingMilestones = getUpcomingMilestones(3, dataset.milestones);
  const sceneLocations = useMemo(() => getSceneLocations(dataset), [dataset]);
  const openLocation = useCallback(
    (id: string) => onOpen({ type: "location", id }),
    [onOpen],
  );
  // Milestones are in chronological order, so the last achieved one is the most
  // recent program milestone reached — derived, not a hardcoded delta.
  const lastAchieved = dataset.milestones.filter((m) => m.status === "ready").at(-1);

  return (
    <div className="trackspace-cc">
      <div className="trackspace-cc-stage">
        <EarthMoonScene locations={sceneLocations} onLocationOpen={openLocation} />
        <span className="trackspace-corner trackspace-corner-tl" />
        <span className="trackspace-corner trackspace-corner-tr" />
        <span className="trackspace-corner trackspace-corner-bl" />
        <span className="trackspace-corner trackspace-corner-br" />
        <div className="trackspace-hud">
          <div className="trackspace-hud-readout">
            <div className="trackspace-hud-readout-title">
              Sustained-Presence Index
            </div>
            <div className="trackspace-hud-row">
              <span>Composite readiness</span>
              <b>{summary.overall}%</b>
            </div>
            <div className="trackspace-hud-row">
              <span>Hard blockers</span>
              <b className="trackspace-blocker">{summary.blockers.length}</b>
            </div>
            <div className="trackspace-hud-row">
              <span>Next crewed flight</span>
              <b>{summary.nextMilestone.code}</b>
            </div>
            <div className="trackspace-hud-row">
              <span>Target window</span>
              <b>{summary.nextMilestone.date}</b>
            </div>
          </div>
          <div className="trackspace-hud-hint">
            DRAG TO ORBIT · SCROLL TO ZOOM · SELECT A SITE FOR EVIDENCE
          </div>
        </div>
      </div>

      <div className="trackspace-cc-side">
        <section className="trackspace-panel">
          <h2>Lunar-Base Readiness</h2>
          <div
            className="trackspace-gauge"
            style={
              { "--trackspace-readiness": `${summary.overall}%` } as CSSProperties
            }
          >
            <div className="trackspace-gauge-num trackspace-tabular">
              {summary.overall}
              <small>%</small>
            </div>
            <div className="trackspace-gauge-meta">
              <div>{summary.label}</div>
              {lastAchieved && (
                <div className="trackspace-gauge-delta">
                  ▲ {lastAchieved.code} achieved · {lastAchieved.date}
                </div>
              )}
              <div className="trackspace-gauge-note">
                weighted across {summary.capabilityCount} caps
              </div>
            </div>
          </div>
          <div className="trackspace-status-counts">
            {STATUS_LIST.map((status) => (
              <div className="trackspace-status-count" key={status}>
                <span
                  className={`trackspace-status-count-num trackspace-tabular trackspace-${status}`}
                >
                  {summary.statusCounts[status]}
                </span>
                <span className="trackspace-status-count-label">
                  <i
                    className={`trackspace-status-count-dot trackspace-bg-${status}`}
                    aria-hidden="true"
                  />
                  {STATUS[status].label}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="trackspace-panel">
          <h2>Top Blockers</h2>
          <div className="trackspace-blockers">
            {summary.blockers.map((capability) => (
              <button
                type="button"
                className="trackspace-blocker-item"
                key={capability.id}
                onClick={() => onOpen({ type: "capability", id: capability.id })}
              >
                <span className="trackspace-blocker-top">
                  <span className="trackspace-blocker-name">
                    {capability.name}
                  </span>
                  <span className="trackspace-blocker-readiness trackspace-tabular">
                    {capability.readiness}%
                  </span>
                </span>
                <span className="trackspace-blocker-desc">
                  {capability.blurb}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="trackspace-panel">
          <h2>Recent Changes</h2>
          <div className="trackspace-rows">
            {summary.recentChanges.map((event) => (
              <button
                type="button"
                className="trackspace-crow"
                key={event.id}
                onClick={() => onOpen({ type: "event", id: event.id })}
              >
                <span className="trackspace-crow-date">{event.date}</span>
                <span className="trackspace-crow-main">
                  <span className="trackspace-crow-title">{event.title}</span>
                  <span className="trackspace-crow-meta">
                    <StatusChip status={event.status} />
                    <ConfidenceChip confidence={event.conf} />
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="trackspace-panel">
          <h2>Next Milestones</h2>
          <div className="trackspace-rows">
            {upcomingMilestones.map((milestone) => (
              <button
                type="button"
                className="trackspace-crow"
                key={milestone.id}
                onClick={() => onOpen({ type: "milestone", id: milestone.id })}
              >
                <span className="trackspace-crow-date">{milestone.date}</span>
                <span className="trackspace-crow-main">
                  <span className="trackspace-crow-title">
                    {milestone.code} · {milestone.name}
                  </span>
                  <span className="trackspace-crow-meta">
                    <StatusChip status={milestone.status} />
                    {milestone.critical && (
                      <span className="trackspace-cchip trackspace-cchip-critical">
                        CRITICAL PATH
                      </span>
                    )}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
