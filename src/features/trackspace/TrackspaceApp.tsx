"use client";

import { useEffect, useState } from "react";
import { AppShell, type TrackspaceNavItem } from "./components/AppShell";

type TrackspaceView = "command" | "dependency" | "timeline" | "milestones";

const NAV_ITEMS: TrackspaceNavItem[] = [
  { id: "command", icon: "⊕", label: "CMD", name: "Command Center" },
  { id: "dependency", icon: "⧉", label: "DEP", name: "Dependency Map" },
  { id: "timeline", icon: "≣", label: "TML", name: "Timeline" },
  { id: "milestones", icon: "◎", label: "MIL", name: "Milestones" },
];

const VIEW_TITLES: Record<TrackspaceView, string> = {
  command: "Command Center",
  dependency: "Dependency Map",
  timeline: "Event Timeline",
  milestones: "Milestones",
};

const SHELL_METRICS = [
  { label: "Overall", value: "68%", status: "ready" },
  { label: "Watch", value: "7", status: "watch" },
  { label: "Blockers", value: "2", status: "blocker" },
  { label: "Unknown", value: "4", status: "unknown" },
];

const RECENT_FEED = [
  "HLS docking sequence remains on watch",
  "Surface power path still blocks extended stay",
  "Suit readiness trending toward A3 review",
];

export function TrackspaceApp() {
  const [activeView, setActiveView] = useState<TrackspaceView>("command");
  const [utcTime, setUtcTime] = useState("00:00:00");

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setUtcTime(
        [now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds()]
          .map((part) => part.toString().padStart(2, "0"))
          .join(":"),
      );
    };

    tick();
    const timer = window.setInterval(tick, 1000);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <AppShell
      activeView={activeView}
      drawer={null}
      navItems={NAV_ITEMS}
      onNavChange={(view) => {
        if (isTrackspaceView(view)) {
          setActiveView(view);
        }
      }}
      utcTime={utcTime}
    >
      <MainContentSlot activeView={activeView} />
    </AppShell>
  );
}

function isTrackspaceView(view: string): view is TrackspaceView {
  return (
    view === "command" ||
    view === "dependency" ||
    view === "timeline" ||
    view === "milestones"
  );
}

function MainContentSlot({
  activeView,
}: {
  activeView: TrackspaceView;
}) {
  return (
    <section className="trackspace-main-slot" aria-label={VIEW_TITLES[activeView]}>
      <div className="trackspace-workspace">
        <div className="trackspace-stage" aria-label="Mission workspace">
          <span className="trackspace-corner trackspace-corner-tl" />
          <span className="trackspace-corner trackspace-corner-tr" />
          <span className="trackspace-corner trackspace-corner-bl" />
          <span className="trackspace-corner trackspace-corner-br" />
          <div className="trackspace-orbit trackspace-orbit-wide" />
          <div className="trackspace-orbit trackspace-orbit-tight" />
          <div className="trackspace-planet" />
          <div className="trackspace-moon" />
          <div className="trackspace-stage-readout">
            <span>TRACKSPACE MODEL</span>
            <b>{VIEW_TITLES[activeView]}</b>
            <small>Shell locked / viewport ready</small>
          </div>
        </div>
      </div>

      <aside className="trackspace-side-panel" aria-label="Readiness summary">
        <section className="trackspace-panel">
          <h2>Readiness</h2>
          <div className="trackspace-metric-grid">
            {SHELL_METRICS.map((metric) => (
              <div className="trackspace-metric" key={metric.label}>
                <span>{metric.label}</span>
                <b className={`trackspace-${metric.status}`}>{metric.value}</b>
              </div>
            ))}
          </div>
        </section>

        <section className="trackspace-panel">
          <h2>Current Feed</h2>
          <div className="trackspace-feed">
            {RECENT_FEED.map((item) => (
              <div className="trackspace-feed-row" key={item}>
                <span className="trackspace-feed-dot" aria-hidden="true" />
                <p>{item}</p>
              </div>
            ))}
          </div>
        </section>
      </aside>
    </section>
  );
}
