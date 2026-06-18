"use client";

import { Fragment, type ReactNode, useState } from "react";

import type { DrawerSelection } from "../components/DetailDrawer";
import { RiskChip } from "../components/RiskChip";
import { useDataset } from "../data/dataset-context";
import {
  RISK_LIKELIHOODS_DESC,
  RISK_SEVERITIES_ASC,
  type RiskCell,
  type RiskEntry,
  getProgramSummary,
  getRiskBand,
  getRiskMatrix,
  getRiskRegister,
} from "../data/selectors";
import type { RiskLevel } from "../data/types";

type ProgramScreenProps = {
  onOpen: (selection: DrawerSelection) => void;
};

type CellKey = { likelihood: RiskLevel; severity: RiskLevel };

/** Short axis labels that fit the matrix gutters. */
const AXIS_LABEL: Record<RiskLevel, string> = {
  low: "LOW",
  medium: "MED",
  high: "HIGH",
};

const sameCell = (a: CellKey | null, b: CellKey) =>
  !!a && a.likelihood === b.likelihood && a.severity === b.severity;

export function ProgramScreen({ onOpen }: ProgramScreenProps) {
  const dataset = useDataset();
  const register = getRiskRegister(dataset.capabilities);
  const matrix = getRiskMatrix(dataset.capabilities);
  const summary = getProgramSummary(dataset.capabilities);
  const [active, setActive] = useState<CellKey | null>(null);

  const shown = active
    ? register.filter((e) => sameCell(active, e.risk))
    : register;

  const toggle = (cell: RiskCell) => {
    if (!cell.capabilities.length) return;
    setActive((cur) => (sameCell(cur, cell) ? null : { ...cell }));
  };

  return (
    <div className="trackspace-prog">
      <aside className="trackspace-prog-rail">
        <div className="trackspace-prog-head">
          <div className="trackspace-prog-kicker">Program · beyond readiness</div>
          <h1>Risk, Funding &amp; Schedule</h1>
          <p className="trackspace-prog-intro">
            Programs are killed by money and time, not just technical maturity.
            Risk is likelihood × severity, kept separate from the readiness
            number.
          </p>
        </div>

        <section>
          <div className="trackspace-prog-sectlabel">Risk matrix</div>
          <div className="trackspace-prog-axiscap">
            rows ↓ likelihood · columns → severity
          </div>
          <div className="trackspace-prog-matrix">
            <span className="trackspace-corner trackspace-corner-tl" />
            <span className="trackspace-corner trackspace-corner-tr" />
            <span className="trackspace-corner trackspace-corner-bl" />
            <span className="trackspace-corner trackspace-corner-br" />
            <div className="trackspace-prog-grid">
              <span className="trackspace-prog-axis trackspace-prog-axis-corner">
                caps
              </span>
              {RISK_SEVERITIES_ASC.map((sev) => (
                <span key={sev} className="trackspace-prog-axis">
                  {AXIS_LABEL[sev]}
                </span>
              ))}
              {RISK_LIKELIHOODS_DESC.map((lk, r) => (
                <Fragment key={lk}>
                  <span className="trackspace-prog-axis trackspace-prog-axis-row">
                    {AXIS_LABEL[lk]}
                  </span>
                  {RISK_SEVERITIES_ASC.map((sev, c) => {
                    const cell = matrix[r * RISK_SEVERITIES_ASC.length + c];
                    const n = cell.capabilities.length;
                    const on = sameCell(active, cell);
                    return (
                      <button
                        type="button"
                        key={sev}
                        className={`trackspace-prog-cell trackspace-cellbg-${cell.band}${
                          on ? " is-active" : ""
                        }${n ? "" : " is-empty"}`}
                        onClick={() => toggle(cell)}
                        disabled={n === 0}
                        aria-pressed={on}
                        aria-label={`${lk} likelihood × ${sev} severity — ${n} capabilities`}
                      >
                        {n > 0 && (
                          <span className="trackspace-prog-cell-n">{n}</span>
                        )}
                      </button>
                    );
                  })}
                </Fragment>
              ))}
            </div>
          </div>
          <div className="trackspace-prog-legend">
            <span>
              <i className="trackspace-bg-ready" /> low
            </span>
            <span>
              <i className="trackspace-bg-watch" /> elevated
            </span>
            <span>
              <i className="trackspace-bg-blocker" /> critical
            </span>
            <span className="trackspace-prog-legend-hint">click a cell to filter</span>
          </div>
        </section>

        <section className="trackspace-prog-readout">
          <div className="trackspace-prog-readout-title">Program exposure</div>
          <ReadoutRow
            label="Tracked"
            value={`${summary.tracked} / ${dataset.capabilities.length}`}
          />
          <ReadoutRow label="Critical · 9" value={summary.critical} tone="blocker" />
          <ReadoutRow
            label="Elevated · ≥6"
            value={summary.elevatedRisk}
            tone="watch"
          />
          <ReadoutRow label="Schedule slips" value={summary.withSlip} />
          <ReadoutRow label="Funding figures" value={summary.withFunding} />
        </section>
      </aside>

      <div className="trackspace-prog-list">
        <header className="trackspace-prog-listhead">
          <div className="trackspace-prog-sectlabel">
            Risk register ·{" "}
            {active
              ? `${active.likelihood} × ${active.severity} likelihood–severity`
              : "most exposed first"}
          </div>
          <div className="trackspace-prog-listmeta">
            <span className="trackspace-prog-count trackspace-tabular">
              {shown.length}
            </span>
            {active && (
              <button
                type="button"
                className="trackspace-prog-clear"
                onClick={() => setActive(null)}
              >
                show all
              </button>
            )}
          </div>
        </header>
        <div className="trackspace-prog-cards">
          {shown.map((entry) => (
            <RegisterCard
              key={entry.capability.id}
              entry={entry}
              onOpen={onOpen}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ReadoutRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: "blocker" | "watch";
}) {
  return (
    <div className="trackspace-prog-readout-row">
      <span>{label}</span>
      <b className={tone ? `trackspace-${tone}` : undefined}>{value}</b>
    </div>
  );
}

function RegisterCard({
  entry,
  onOpen,
}: {
  entry: RiskEntry;
  onOpen: (selection: DrawerSelection) => void;
}) {
  const { capability, risk, score } = entry;
  const m = capability.metrics;
  const band = getRiskBand(score);

  const facts: { label: string; value: ReactNode }[] = [];
  if (m?.provider) {
    facts.push({
      label: "Provider",
      value: (
        <>
          {m.provider}
          {m.contract && (
            <span className="trackspace-metric-tag">{m.contract}</span>
          )}
        </>
      ),
    });
  }
  if (m?.funding) facts.push({ label: "Funding", value: m.funding });
  if (m?.slip) facts.push({ label: "Slip", value: m.slip });
  if (m?.target) facts.push({ label: "Target", value: m.target });

  return (
    <button
      type="button"
      className="trackspace-prog-card"
      onClick={() => onOpen({ type: "capability", id: capability.id })}
    >
      <span className="trackspace-prog-card-top">
        <span className={`trackspace-prog-score trackspace-cellbg-${band}`}>
          <i
            className="trackspace-prog-dot"
            style={{
              background: `var(--ts-${band})`,
              boxShadow: `0 0 8px var(--ts-${band})`,
            }}
            aria-hidden="true"
          />
          {score}
        </span>
        <span className="trackspace-prog-card-id">
          <span className="trackspace-prog-card-name">{capability.name}</span>
          <span className="trackspace-prog-card-sub">
            {capability.group} · {capability.short}
          </span>
        </span>
        <span className="trackspace-prog-card-risk">
          <RiskChip level={risk.likelihood} />
          <span className="trackspace-metric-x" aria-hidden="true">
            ×
          </span>
          <RiskChip level={risk.severity} />
        </span>
      </span>

      <span className="trackspace-prog-card-bar">
        <span className="trackspace-readiness-bar">
          <span
            className={`trackspace-bg-${capability.status}`}
            style={{ width: `${capability.readiness}%` }}
          />
        </span>
        <span className="trackspace-prog-card-pct trackspace-tabular">
          {capability.readiness}%
        </span>
      </span>

      {facts.length > 0 && (
        <span className="trackspace-prog-facts">
          {facts.map((f) => (
            <span className="trackspace-prog-fact" key={f.label}>
              <span className="trackspace-prog-fact-label">{f.label}</span>
              <span className="trackspace-prog-fact-val">{f.value}</span>
            </span>
          ))}
        </span>
      )}
    </button>
  );
}
