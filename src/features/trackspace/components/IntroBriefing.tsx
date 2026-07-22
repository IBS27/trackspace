import {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";

import { useDataset } from "../data/dataset-context";
import { getSummary } from "../data/selectors";
import { STATUS_LIST } from "../data/seed";

const STORAGE_KEY = "trackspace:intro-dismissed";

const subscribeToNothing = () => () => {};

function readSeen(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    // Storage unavailable — skip the briefing rather than show it every visit.
    return true;
  }
}

const VIEWS = [
  {
    id: "command",
    icon: "⊕",
    name: "Command Center",
    note: "Live Earth–Moon view and the overall readiness index",
  },
  {
    id: "dependency",
    icon: "⧉",
    name: "Dependency Map",
    note: "Which capabilities have to work before which",
  },
  {
    id: "timeline",
    icon: "≣",
    name: "Timeline",
    note: "Logged events, and what is projected next",
  },
  {
    id: "milestones",
    icon: "◎",
    name: "Milestones",
    note: "The program's major gates, mission by mission",
  },
  {
    id: "program",
    icon: "⌘",
    name: "Program",
    note: "Program health at a glance",
  },
];

export function IntroBriefing({
  onNavigate,
}: {
  onNavigate: (view: string) => void;
}) {
  const summary = getSummary(useDataset());

  // Server snapshot says "seen" so nothing renders during SSR/hydration;
  // the briefing appears only after the client confirms it was never dismissed.
  const seen = useSyncExternalStore(subscribeToNothing, readSeen, () => true);
  const [dismissed, setDismissed] = useState(false);
  const open = !seen && !dismissed;

  const dismiss = useCallback(() => {
    setDismissed(true);
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Best effort — worst case the briefing shows again next visit.
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, dismiss]);

  if (!open) return null;

  return (
    <>
      <div
        className="trackspace-intro-scrim"
        onClick={dismiss}
        aria-hidden="true"
      />
      <div
        className="trackspace-intro"
        role="dialog"
        aria-modal="true"
        aria-labelledby="trackspace-intro-title"
      >
        <div className="trackspace-intro-head">
          <div className="trackspace-intro-kicker">Mission briefing</div>
          <h2 id="trackspace-intro-title">
            How close is a permanent Moon base?
          </h2>
          <button
            type="button"
            className="trackspace-drawer-close"
            onClick={dismiss}
            aria-label="Dismiss briefing"
            autoFocus
          >
            ✕
          </button>
        </div>
        <div className="trackspace-intro-body">
          <p>
            Trackspace follows the missions, hardware, and program decisions a
            permanent lunar base depends on, and rolls them up into one live
            readiness picture. As of today:
          </p>
          <div className="trackspace-intro-stats">
            <div className="trackspace-intro-stat">
              <span>Readiness</span>
              <b className="trackspace-intro-stat-accent">{summary.overall}%</b>
            </div>
            <div className="trackspace-intro-stat">
              <span>Hard blockers</span>
              <b
                className={
                  summary.blockers.length > 0
                    ? "trackspace-intro-stat-blocker"
                    : undefined
                }
              >
                {summary.blockers.length}
              </b>
            </div>
            <div className="trackspace-intro-stat">
              <span>Next gate</span>
              <b>
                <i
                  className={`trackspace-intro-stat-dot trackspace-bg-${summary.nextMilestone.status}`}
                  aria-hidden="true"
                />
                {summary.nextMilestone.code} · {summary.nextMilestone.date}
              </b>
            </div>
            <div className="trackspace-intro-statusbar" aria-hidden="true">
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
          </div>
          <ul className="trackspace-intro-views">
            {VIEWS.map((view) => (
              <li key={view.id}>
                <button
                  type="button"
                  className="trackspace-intro-view"
                  onClick={() => {
                    onNavigate(view.id);
                    dismiss();
                  }}
                >
                  <span className="trackspace-intro-glyph" aria-hidden="true">
                    {view.icon}
                  </span>
                  <span className="trackspace-intro-view-name">
                    {view.name}
                  </span>
                  <span className="trackspace-intro-view-note">
                    {view.note}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}
