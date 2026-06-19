import { RISK_TONE } from "../data/selectors";
import type { RiskLevel } from "../data/types";

/** A risk level (low / medium / high) toned by the status palette. */
export function RiskChip({ level }: { level: RiskLevel }) {
  return (
    <span className={`trackspace-riskchip trackspace-bg-${RISK_TONE[level]}`}>
      {level}
    </span>
  );
}
