import { STATUS } from "../data/seed";
import type { Status } from "../data/types";

export function StatusChip({ status }: { status: Status }) {
  return (
    <span className={`trackspace-schip trackspace-schip-${status}`}>
      <i className="trackspace-schip-square" aria-hidden="true" />
      {STATUS[status].label}
    </span>
  );
}
