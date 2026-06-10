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

const SUMMARY = getSummary();

const NAV_ITEMS: TrackspaceNavItem[] = [
  { id: "command", icon: "⊕", name: "Command Center" },
  { id: "dependency", icon: "⧉", name: "Dependency Map" },
  { id: "timeline", icon: "≣", name: "Timeline" },
  { id: "milestones", icon: "◎", name: "Milestones" },
];

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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const index = Number(event.key) - 1;
      const item = NAV_ITEMS[index];
      if (item && isTrackspaceView(item.id)) {
        setActiveView(item.id);
        setSelection(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
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
