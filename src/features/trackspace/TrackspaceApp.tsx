"use client";

import { useEffect, useState } from "react";
import { AppShell, type TrackspaceNavItem } from "./components/AppShell";
import {
  DetailDrawer,
  type DrawerSelection,
} from "./components/DetailDrawer";
import { DatasetProvider } from "./data/dataset-context";
import { CURATED, getSummary } from "./data/selectors";
import type { Dataset } from "./data/types";
import { CommandCenter } from "./screens/CommandCenter";
import { DependencyMap } from "./screens/DependencyMap";
import { MilestonesScreen } from "./screens/MilestonesScreen";
import { TimelineScreen } from "./screens/TimelineScreen";

type TrackspaceView = "command" | "dependency" | "timeline" | "milestones";

const NAV_ITEMS: TrackspaceNavItem[] = [
  { id: "command", icon: "⊕", name: "Command Center" },
  { id: "dependency", icon: "⧉", name: "Dependency Map" },
  { id: "timeline", icon: "≣", name: "Timeline" },
  { id: "milestones", icon: "◎", name: "Milestones" },
];

export function TrackspaceApp({ dataset = CURATED }: { dataset?: Dataset }) {
  const [activeView, setActiveView] = useState<TrackspaceView>("command");
  const [selection, setSelection] = useState<DrawerSelection | null>(null);
  const [utcTime, setUtcTime] = useState("00:00:00");

  const summary = getSummary(dataset);

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
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
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
    <DatasetProvider value={dataset}>
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
        nextGate={`${summary.nextMilestone.code} · ${summary.nextMilestone.date}`}
        onNavChange={(view) => {
          if (isTrackspaceView(view)) {
            setActiveView(view);
            setSelection(null);
          }
        }}
        presenceIndex={summary.overall}
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
    </DatasetProvider>
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
