import { memo, useState } from "react";

import { MissionAtlas } from "../atlas/MissionAtlas";
import type { AtlasSelection } from "../atlas/model";

import { ConfidenceChip } from "../components/ConfidenceChip";
import type { DrawerSelection } from "../components/DetailDrawer";
import { ReadinessSummary } from "../components/ReadinessSummary";
import { StatusChip } from "../components/StatusChip";
import { useDataset } from "../data/dataset-context";
import { getSummary, getUpcomingMilestones } from "../data/selectors";

type CommandCenterProps = {
  onOpen: (selection: DrawerSelection) => void;
};

export const CommandCenter = memo(function CommandCenter({ onOpen }: CommandCenterProps) {
  const dataset = useDataset();
  const summary = getSummary(dataset);
  const upcomingMilestones = getUpcomingMilestones(3, dataset.milestones);
  const [atlasSelection, setAtlasSelection] = useState<AtlasSelection | null>(null);

  const isSelected = (kind: AtlasSelection["kind"], id: string) =>
    atlasSelection?.kind === kind && atlasSelection.id === id;

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

      <aside className="trackspace-cc-side">
        <section className="trackspace-side-section">
          <h2 className="trackspace-side-heading">
            Lunar-Base Readiness
            <span className="trackspace-side-heading-note">
              {summary.capabilityCount} capabilities
            </span>
          </h2>
          <ReadinessSummary summary={summary} />
        </section>

        <section className="trackspace-side-section">
          <h2 className="trackspace-side-heading">Top Blockers</h2>
          <div className="trackspace-side-list">
            {summary.blockers.map((capability) => (
              <button
                type="button"
                className="trackspace-side-blocker"
                key={capability.id}
                aria-pressed={isSelected("capability", capability.id)}
                onClick={() => setAtlasSelection({ kind: "capability", id: capability.id })}
              >
                <span className="trackspace-side-blocker-top">
                  <span className="trackspace-side-blocker-name">{capability.name}</span>
                  <span className="trackspace-side-blocker-pct trackspace-tabular">
                    {capability.readiness}%
                  </span>
                </span>
                <span className="trackspace-side-blocker-desc">{capability.blurb}</span>
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
                aria-pressed={isSelected("event", event.id)}
                onClick={() => setAtlasSelection({ kind: "event", id: event.id })}
              >
                <span className="trackspace-side-row-date trackspace-tabular">
                  {event.date}
                </span>
                <span className="trackspace-side-row-main">
                  <span className="trackspace-side-row-title">{event.title}</span>
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
                aria-pressed={isSelected("milestone", milestone.id)}
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
                      <span className="trackspace-tag is-critical">Critical path</span>
                    )}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
});
