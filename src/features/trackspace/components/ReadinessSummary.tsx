import { STATUS, STATUS_LIST } from "../data/seed";
import type { getSummary } from "../data/selectors";
import { CheckIcon } from "./icons";

type Summary = ReturnType<typeof getSummary>;

/** Overall readiness number, status distribution bar, and per-status key. */
export function ReadinessSummary({ summary }: { summary: Summary }) {
  const { lastAchieved } = summary;
  return (
    <div className="trackspace-readiness">
      <div className="trackspace-readiness-readout">
        <span className="trackspace-readiness-num trackspace-tabular">
          {summary.overall}
          <small>%</small>
        </span>
        <span className="trackspace-readiness-meta">
          <span className="trackspace-readiness-label">{summary.label}</span>
          {lastAchieved && (
            <span className="trackspace-readiness-delta">
              <CheckIcon size={12} />
              {lastAchieved.code} achieved · {lastAchieved.date}
            </span>
          )}
        </span>
      </div>
      <StatusBar counts={summary.statusCounts} />
      <ul className="trackspace-statuskey">
        {STATUS_LIST.map((status) => (
          <li key={status} className={`trackspace-statuskey-item is-${status}`}>
            <b className="trackspace-tabular">{summary.statusCounts[status]}</b>
            {STATUS[status].label}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function StatusBar({ counts }: { counts: Summary["statusCounts"] }) {
  return (
    <div className="trackspace-statusbar" aria-hidden="true">
      {STATUS_LIST.map((status) =>
        counts[status] > 0 ? (
          <span
            key={status}
            className={`trackspace-statusbar-seg trackspace-bg-${status}`}
            style={{ flexGrow: counts[status] }}
          />
        ) : null,
      )}
    </div>
  );
}
