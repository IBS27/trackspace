import { CONFIDENCE } from "../data/seed";
import type { Confidence } from "../data/types";

const PIP_RANKS = [1, 2, 3, 4, 5];

export function ConfidenceChip({ confidence }: { confidence: Confidence }) {
  const meta = CONFIDENCE[confidence];

  return (
    <span className="trackspace-cchip" title={meta.desc}>
      <span className="trackspace-pips" aria-hidden="true">
        {PIP_RANKS.map((rank) => (
          <i key={rank} className={rank <= meta.rank ? "is-on" : undefined} />
        ))}
      </span>
      {meta.label}
    </span>
  );
}
