import { STATUS } from "../data/seed";
import type { Status } from "../data/types";

export function StatusChip({
  status,
  compact = false,
}: {
  status: Status;
  /** Square-only variant for tight spots like graph node cards. */
  compact?: boolean;
}) {
  return (
    <span
      className={`trackspace-schip trackspace-schip-${status}`}
      aria-label={compact ? STATUS[status].label : undefined}
    >
      <i className="trackspace-schip-square" aria-hidden="true" />
      {!compact && STATUS[status].label}
    </span>
  );
}
