"use client";

import { useEffect, useState } from "react";
import { AppShell, type TrackspaceNavItem } from "./components/AppShell";
import {
  DetailDrawer,
  type DrawerSelection,
} from "./components/DetailDrawer";
import { getSummary } from "./data/selectors";
import { CommandCenter } from "./screens/CommandCenter";
import { DependencyMap } from "./screens/DependencyMap";
import { MilestonesScreen } from "./screens/MilestonesScreen";
import { TimelineScreen } from "./screens/TimelineScreen";

type TrackspaceView = "command" | "dependency" | "timeline" | "milestones";

const NAV_ITEMS: TrackspaceNavItem[] = [
  { id: "command", icon: "⊕", label: "CMD", name: "Command Center" },
  { id: "dependency", icon: "⧉", label: "DEP", name: "Dependency Map" },
  { id: "timeline", icon: "≣", label: "TML", name: "Timeline" },
  { id: "milestones", icon: "◎", label: "MIL", name: "Milestones" },
];

const SUMMARY = getSummary();

export function TrackspaceApp() {
  const [activeView, setActiveView] = useState<TrackspaceView>("command");
  const [selection, setSelection] = useState<DrawerSelection | null>(null);
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
      drawer={
        selection && (
          <DetailDrawer
            selection={selection}
            onOpen={setSelection}
            onClose={() => setSelection(null)}
          />
        )
      }
      navItems={NAV_ITEMS}
      nextGate={`${SUMMARY.nextMilestone.code} · ${SUMMARY.nextMilestone.date}`}
      onNavChange={(view) => {
        if (isTrackspaceView(view)) {
          setActiveView(view);
          setSelection(null);
        }
      }}
      presenceIndex={SUMMARY.overall}
      utcTime={utcTime}
    >
      {activeView === "command" ? (
        <CommandCenter onOpen={setSelection} />
      ) : activeView === "dependency" ? (
        <DependencyMap onOpen={setSelection} />
      ) : activeView === "timeline" ? (
        <TimelineScreen onOpen={setSelection} />
      ) : (
        <MilestonesScreen onOpen={setSelection} />
      )}
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
