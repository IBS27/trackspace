import { memo, useState } from "react";

import { MissionAtlas } from "../atlas/MissionAtlas";
import type { AtlasSelection } from "../atlas/model";

import { ConfidenceChip } from "../components/ConfidenceChip";
import type { DrawerSelection } from "../components/DetailDrawer";
import { StatusChip } from "../components/StatusChip";
import { useDataset } from "../data/dataset-context";
import { STATUS, STATUS_LIST } from "../data/seed";
import {
  getSummary,
  getUpcomingMilestones,
} from "../data/selectors";

type CommandCenterProps = {
  onOpen: (selection: DrawerSelection) => void;
};

export const CommandCenter = memo(function CommandCenter({ onOpen }: CommandCenterProps) {
  const dataset = useDataset();
  const summary = getSummary(dataset);
  const upcomingMilestones = getUpcomingMilestones(3, dataset.milestones);
  const [atlasSelection, setAtlasSelection] = useState<AtlasSelection | null>(null);
  // Milestones are in chronological order, so the last achieved one is the most
  // recent program milestone reached — derived, not a hardcoded delta.
  const lastAchieved = dataset.milestones.filter((m) => m.status === "ready").at(-1);

  return (
    <div className="trackspace-cc">
      <div className="trackspace-cc-stage">
        <MissionAtlas
          dataset={dataset}
          selection={atlasSelection}
          onSelectionChange={setAtlasSelection}
          onOpen={onOpen}
        />
      </div>

      <div className="trackspace-cc-side">
        <section className="trackspace-side-section">
          <h2 className="trackspace-side-heading">
            Lunar-Base Readiness
            <span className="trackspace-side-heading-note">
              {summary.capabilityCount} capabilities
            </span>
          </h2>
          <div className="trackspace-side-readout">
            <div className="trackspace-side-readout-num trackspace-tabular">
              {summary.overall}
              <small>%</small>
            </div>
            <div className="trackspace-side-readout-meta">
              <div>{summary.label}</div>
              {lastAchieved && (
                <div className="trackspace-side-readout-delta">
                  ▲ {lastAchieved.code} achieved · {lastAchieved.date}
                </div>
              )}
            </div>
          </div>
          <div className="trackspace-side-statusbar" aria-hidden="true">
            {STATUS_LIST.map((status) =>
              summary.statusCounts[status] > 0 ? (
                <span
                  key={status}
                  className={`trackspace-side-statusbar-seg trackspace-bg-${status}`}
                  style={{ flexGrow: summary.statusCounts[status] }}
                />
              ) : null,
            )}
          </div>
          <div className="trackspace-side-statuskey">
            {STATUS_LIST.map((status) => (
              <span className="trackspace-side-statuskey-item" key={status}>
                <i
                  className={`trackspace-side-statuskey-dot trackspace-bg-${status}`}
                  aria-hidden="true"
                />
                <b className="trackspace-tabular">
                  {summary.statusCounts[status]}
                </b>
                {STATUS[status].label}
              </span>
            ))}
          </div>
        </section>

        <section className="trackspace-side-section">
          <h2 className="trackspace-side-heading">Top Blockers</h2>
          <div className="trackspace-side-list">
            {summary.blockers.map((capability) => (
              <button
                type="button"
                className="trackspace-side-blocker"
                key={capability.id}
                aria-pressed={atlasSelection?.kind === "capability" && atlasSelection.id === capability.id}
                onClick={() => setAtlasSelection({ kind: "capability", id: capability.id })}
              >
                <span className="trackspace-side-blocker-top">
                  <span className="trackspace-side-blocker-name">
                    {capability.name}
                  </span>
                  <span className="trackspace-side-blocker-pct trackspace-tabular">
                    {capability.readiness}
                    <small>%</small>
                  </span>
                </span>
                <span className="trackspace-side-blocker-desc">
                  {capability.blurb}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="trackspace-side-section">
          <h2 className="trackspace-side-heading">Recent Changes</h2>
          <div className="trackspace-side-list">
            {summary.recentChanges.map((event) => (
              <button
                type="button"
                className="trackspace-side-row"
                key={event.id}
                aria-pressed={atlasSelection?.kind === "event" && atlasSelection.id === event.id}
                onClick={() => setAtlasSelection({ kind: "event", id: event.id })}
              >
                <span className="trackspace-side-row-date trackspace-tabular">
                  {event.date}
                </span>
                <span className="trackspace-side-row-main">
                  <span className="trackspace-side-row-title">
                    {event.title}
                  </span>
                  <span className="trackspace-side-row-meta">
                    <StatusChip status={event.status} />
                    <ConfidenceChip confidence={event.conf} />
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="trackspace-side-section">
          <h2 className="trackspace-side-heading">Next Milestones</h2>
          <div className="trackspace-side-list">
            {upcomingMilestones.map((milestone) => (
              <button
                type="button"
                className="trackspace-side-row"
                key={milestone.id}
                aria-pressed={atlasSelection?.kind === "milestone" && atlasSelection.id === milestone.id}
                onClick={() => setAtlasSelection({ kind: "milestone", id: milestone.id })}
              >
                <span className="trackspace-side-row-date trackspace-tabular">
                  {milestone.date}
                </span>
                <span className="trackspace-side-row-main">
                  <span className="trackspace-side-row-title">
                    {milestone.code} · {milestone.name}
                  </span>
                  <span className="trackspace-side-row-meta">
                    <StatusChip status={milestone.status} />
                    {milestone.critical && (
                      <span className="trackspace-cchip trackspace-cchip-critical">
                        Critical path
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
});
