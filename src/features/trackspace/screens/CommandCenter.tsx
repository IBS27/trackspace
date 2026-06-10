import { ConfidenceChip } from "../components/ConfidenceChip";
import type { DrawerSelection } from "../components/DetailDrawer";
import { StatusChip } from "../components/StatusChip";
import { STATUS, STATUS_LIST } from "../data/seed";
import { getSummary, getUpcomingMilestones } from "../data/selectors";
import { EarthMoonScene } from "../scene/EarthMoonScene";

const SUMMARY = getSummary();
const UPCOMING_MILESTONES = getUpcomingMilestones();

type CommandCenterProps = {
  onOpen: (selection: DrawerSelection) => void;
};

export function CommandCenter({ onOpen }: CommandCenterProps) {
  return (
    <div className="trackspace-cc">
      <div className="trackspace-cc-stage">
        <EarthMoonScene />
        <span className="trackspace-corner trackspace-corner-tl" />
        <span className="trackspace-corner trackspace-corner-tr" />
        <span className="trackspace-corner trackspace-corner-bl" />
        <span className="trackspace-corner trackspace-corner-br" />
        <div className="trackspace-hud">
          <div className="trackspace-hud-top">
            <div className="trackspace-hud-lead">EARTH · MOON SYSTEM</div>
            <div>VIEW · CISLUNAR / LIVE ORBIT</div>
            <div>DRAG TO ORBIT · SCROLL TO ZOOM</div>
            <div>DBL-CLICK EARTH / MOON TO REFOCUS</div>
          </div>
          <div className="trackspace-hud-readout">
            <div className="trackspace-hud-readout-title">
              Sustained-Presence Index
            </div>
            <div className="trackspace-hud-row">
              <span>Composite readiness</span>
              <b>{SUMMARY.overall}%</b>
            </div>
            <div className="trackspace-hud-row">
              <span>Hard blockers</span>
              <b className="trackspace-blocker">{SUMMARY.blockers.length}</b>
            </div>
            <div className="trackspace-hud-row">
              <span>Next crewed flight</span>
              <b>{SUMMARY.nextMilestone.code}</b>
            </div>
            <div className="trackspace-hud-row">
              <span>Target window</span>
              <b>{SUMMARY.nextMilestone.date}</b>
            </div>
          </div>
          <div className="trackspace-hud-hint">
            ◦ {SUMMARY.capabilityCount} TRACKED CAPABILITIES ·{" "}
            {SUMMARY.milestoneCount} MILESTONES · MODEL v0.1 ◦
          </div>
        </div>
      </div>

      <div className="trackspace-cc-side">
        <section className="trackspace-panel">
          <h2>Lunar-Base Readiness</h2>
          <div className="trackspace-gauge">
            <div className="trackspace-gauge-num trackspace-tabular">
              {SUMMARY.overall}
              <small>%</small>
            </div>
            <div className="trackspace-gauge-meta">
              <div>{SUMMARY.label}</div>
              <div className="trackspace-gauge-delta">▲ +3 pts / 90 days</div>
              <div className="trackspace-gauge-note">
                weighted across {SUMMARY.capabilityCount} caps
              </div>
            </div>
          </div>
          <div className="trackspace-status-counts">
            {STATUS_LIST.map((status) => (
              <div className="trackspace-status-count" key={status}>
                <span
                  className={`trackspace-status-count-num trackspace-tabular trackspace-${status}`}
                >
                  {SUMMARY.statusCounts[status]}
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
            {SUMMARY.blockers.map((capability) => (
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
            {SUMMARY.recentChanges.map((event) => (
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
            {UPCOMING_MILESTONES.map((milestone) => (
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
