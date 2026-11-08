import type { Impact } from "../data/types";

const LABEL: Record<Impact, string> = {
  high: "High impact",
  med: "Medium impact",
  low: "Low impact",
};

/** Neutral impact marker. Status colors stay reserved for status. */
export function ImpactTag({ impact }: { impact: Impact }) {
  return (
    <span className="trackspace-impact" data-impact={impact}>
      {LABEL[impact]}
    </span>
  );
}
