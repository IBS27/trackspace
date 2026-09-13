import {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";

import { useDataset } from "../data/dataset-context";
import { getSummary } from "../data/selectors";
import { VIEWS } from "../views";
import { CloseIcon } from "./icons";
import { ReadinessSummary } from "./ReadinessSummary";
import { StatusChip } from "./StatusChip";

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

export function IntroBriefing({
  onNavigate,
  requested,
  onRequestClose,
}: {
  onNavigate: (view: string) => void;
  requested: boolean;
  onRequestClose: () => void;
}) {
  const summary = getSummary(useDataset());

  // Server snapshot says "seen" so nothing renders during SSR/hydration;
  // the briefing appears only after the client confirms it was never dismissed.
  const seen = useSyncExternalStore(subscribeToNothing, readSeen, () => true);
  const [dismissed, setDismissed] = useState(false);
  const open = requested || (!seen && !dismissed);

  const dismiss = useCallback(() => {
    setDismissed(true);
    onRequestClose();
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Best effort — worst case the briefing shows again next visit.
    }
  }, [onRequestClose]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // Digits switch views via the app-level shortcut; close so the change is visible.
      if (e.key === "Escape" || /^[1-9]$/.test(e.key)) dismiss();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, dismiss]);

  if (!open) return null;

  return (
    <>
      <div className="trackspace-scrim is-top" onClick={dismiss} aria-hidden="true" />
      <div
        className="trackspace-intro"
        role="dialog"
        aria-modal="true"
        aria-labelledby="trackspace-intro-title"
      >
        <button
          type="button"
          className="trackspace-iconbtn trackspace-intro-close"
          onClick={dismiss}
          aria-label="Dismiss briefing"
          autoFocus
        >
          <CloseIcon size={14} />
        </button>

        <div className="trackspace-intro-scroll">
          <div className="trackspace-intro-head">
            <span className="trackspace-eyebrow">Mission briefing</span>
            <h2 id="trackspace-intro-title">How close is a permanent Moon base?</h2>
            <p>
              Trackspace follows the missions, hardware, and program decisions a
              lunar base depends on, and rolls them into one readiness picture
              built from the public record.
            </p>
          </div>

          <div className="trackspace-intro-status">
            <ReadinessSummary summary={summary} />
            <dl className="trackspace-intro-facts">
              <div>
                <dt>Hard blockers</dt>
                <dd
                  className={`trackspace-tabular${
                    summary.blockers.length > 0 ? " is-blocker" : ""
                  }`}
                >
                  {summary.blockers.length}
                </dd>
              </div>
              <div>
                <dt>Next gate</dt>
                <dd>
                  {summary.nextMilestone.code} · {summary.nextMilestone.date}
                  <StatusChip status={summary.nextMilestone.status} />
                </dd>
              </div>
            </dl>
          </div>

          <nav className="trackspace-intro-views" aria-label="Views">
            {VIEWS.map((item, index) => {
              const Icon = item.icon;
              return (
                <button
                  type="button"
                  key={item.id}
                  className="trackspace-intro-view"
                  onClick={() => {
                    onNavigate(item.id);
                    dismiss();
                  }}
                >
                  <span className="trackspace-intro-view-icon">
                    <Icon size={16} />
                  </span>
                  <span className="trackspace-intro-view-text">
                    <span className="trackspace-intro-view-name">{item.name}</span>
                    <span className="trackspace-intro-view-note">
                      {item.note}
                    </span>
                  </span>
                  <kbd>{index + 1}</kbd>
                </button>
              );
            })}
          </nav>

          <div className="trackspace-intro-foot">
            <span>
              Press <kbd>1</kbd>–<kbd>5</kbd> to switch views at any time.
            </span>
            <button type="button" className="trackspace-btn-primary" onClick={dismiss}>
              Start exploring
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
