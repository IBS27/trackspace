"use client";

import { useEffect, useState } from "react";
import { useQueries } from "convex/react";
import { AppShell, type DataStatus } from "./components/AppShell";
import {
  DetailDrawer,
  type DrawerSelection,
} from "./components/DetailDrawer";
import { IntroBriefing } from "./components/IntroBriefing";
import { DatasetProvider } from "./data/dataset-context";
import { CURATED, getSummary } from "./data/selectors";
import type { Dataset } from "./data/types";
import { CommandCenter } from "./screens/CommandCenter";
import { DependencyMap } from "./screens/DependencyMap";
import { MilestonesScreen } from "./screens/MilestonesScreen";
import { ProgramScreen } from "./screens/ProgramScreen";
import { TimelineScreen } from "./screens/TimelineScreen";
import { api } from "@/lib/convex";
import { isTrackspaceView, VIEWS, type TrackspaceView } from "./views";


export function TrackspaceApp({
  dataset = CURATED,
  live = false,
}: {
  dataset?: Dataset;
  live?: boolean;
}) {
  if (live) return <LiveTrackspaceApp initialDataset={dataset} />;
  return <TrackspaceWorkspace dataset={dataset} />;
}

const DATASET_QUERY = { dataset: { query: api.trackspace.dataset, args: {} } };

function LiveTrackspaceApp({ initialDataset }: { initialDataset: Dataset }) {
  // Unlike useQuery, useQueries returns query errors instead of throwing them.
  const { dataset: result } = useQueries(DATASET_QUERY) as {
    dataset: Dataset | null | undefined | Error;
  };
  const liveDataset = result instanceof Error ? null : result;
  const [lastDataset, setLastDataset] = useState(initialDataset);
  if (liveDataset && liveDataset !== lastDataset) setLastDataset(liveDataset);

  return (
    <TrackspaceWorkspace
      dataset={liveDataset ?? lastDataset}
      dataStatus={liveDataset ? "live" : result === undefined ? "connecting" : "snapshot"}
    />
  );
}

function TrackspaceWorkspace({
  dataset,
  dataStatus = "snapshot",
}: {
  dataset: Dataset;
  dataStatus?: DataStatus;
}) {
  const [activeView, setActiveView] = useState<TrackspaceView>("command");
  const [selection, setSelection] = useState<DrawerSelection | null>(null);
  const [briefingRequested, setBriefingRequested] = useState(false);
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
      const item = VIEWS[index];
      if (item) {
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
        dataStatus={dataStatus}
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
        nextGate={`${summary.nextMilestone.code} · ${summary.nextMilestone.date}`}
        overlay={
          <IntroBriefing
                onNavigate={(view) => {
              if (isTrackspaceView(view)) {
                setActiveView(view);
                setSelection(null);
              }
            }}
            requested={briefingRequested}
            onRequestClose={() => setBriefingRequested(false)}
          />
        }
        onOpenBriefing={() => setBriefingRequested(true)}
        onNavChange={(view) => {
          if (isTrackspaceView(view)) {
            setActiveView(view);
            setSelection(null);
          }
        }}
        utcTime={utcTime}
      >
        {activeView === "command" ? (
          <CommandCenter onOpen={setSelection} />
        ) : activeView === "dependency" ? (
          <DependencyMap onOpen={setSelection} />
        ) : activeView === "timeline" ? (
          <TimelineScreen onOpen={setSelection} />
        ) : activeView === "milestones" ? (
          <MilestonesScreen onOpen={setSelection} />
        ) : (
          <ProgramScreen onOpen={setSelection} />
        )}
      </AppShell>
    </DatasetProvider>
  );
}
