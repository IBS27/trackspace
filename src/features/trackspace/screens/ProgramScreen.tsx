"use client";

import { useState, type ReactNode } from "react";

import type { DrawerSelection } from "../components/DetailDrawer";
import { StatusChip } from "../components/StatusChip";
import { useActiveIntoView } from "../components/useActiveIntoView";
import { useDataset } from "../data/dataset-context";
import {
  getProgramRegister,
  getProgramSummary,
  type ProgramEntry,
} from "../data/selectors";
import type { Capability } from "../data/types";

type ProgramScreenProps = {
  onOpen: (selection: DrawerSelection) => void;
};

type ProgramLens = "attention" | "schedule" | "funding" | "ready" | "all";

type ProgramFact = {
  label: string;
  value: ReactNode;
};

export function ProgramScreen({ onOpen }: ProgramScreenProps) {
  const dataset = useDataset();
  const register = getProgramRegister(dataset.capabilities);
  const summary = getProgramSummary(dataset.capabilities);
  const [lens, setLens] = useState<ProgramLens>("attention");
  const railRef = useActiveIntoView<HTMLElement>(".trackspace-prog-lens.is-on", lens);

  const attention = register.filter(
    (entry) => entry.status === "blocker" || entry.status === "watch",
  );
  const schedule = register.filter((entry) => entry.hasScheduleSignal);
  const funding = register.filter((entry) => entry.hasFundingSignal);
  const ready = register.filter((entry) => entry.status === "ready");

  const visible =
    lens === "attention"
      ? attention
      : lens === "schedule"
        ? schedule
        : lens === "funding"
          ? funding
          : lens === "ready"
            ? ready
            : register;

  const lensRows: {
    id: ProgramLens;
    label: string;
    detail: string;
    count: number;
  }[] = [
    {
      id: "attention",
      label: "Needs attention",
      detail: `${summary.blockers} blockers · ${summary.watch} watch`,
      count: attention.length,
    },
    {
      id: "schedule",
      label: "Schedule signals",
      detail: "Documented slips and timing pressure",
      count: schedule.length,
    },
    {
      id: "funding",
      label: "Funding signals",
      detail: "Public contract or budget figures",
      count: funding.length,
    },
    {
      id: "ready",
      label: "Stable",
      detail: "Tracked records already marked ready",
      count: ready.length,
    },
    {
      id: "all",
      label: "All tracked",
      detail: `${summary.tracked} of ${dataset.capabilities.length} capabilities`,
      count: register.length,
    },
  ];
  const currentLens = lensRows.find((row) => row.id === lens) ?? lensRows[0];

  return (
    <div className="trackspace-prog">
      <nav ref={railRef} className="trackspace-prog-rail" aria-label="Program views">
        <div className="trackspace-prog-rail-head">Program Views</div>
        {lensRows.map((row) => (
          <button
            type="button"
            key={row.id}
            className={`trackspace-prog-lens${lens === row.id ? " is-on" : ""}`}
            aria-current={lens === row.id ? "true" : undefined}
            onClick={() => setLens(row.id)}
          >
            <span className="trackspace-prog-lens-main">
              <span className="trackspace-prog-lens-label">{row.label}</span>
              <span className="trackspace-prog-lens-detail">{row.detail}</span>
            </span>
            <span className="trackspace-prog-lens-side">
              <span className="trackspace-prog-lens-count trackspace-tabular">
                {row.count}
              </span>
            </span>
          </button>
        ))}
      </nav>

      <div className="trackspace-prog-page">
        <div className="trackspace-eyebrow">
          Program · funding and schedule
        </div>
        <h1>Program Health</h1>
        <div className="trackspace-page-meta">
          <span className="trackspace-tag trackspace-tabular">
            {summary.tracked}/{dataset.capabilities.length} tracked
          </span>
          <span
            className={`trackspace-tag trackspace-tabular${summary.blockers > 0 ? " is-critical" : ""}`}
          >
            {summary.blockers} blockers
          </span>
          <span
            className={`trackspace-tag trackspace-tabular${summary.watch > 0 ? " is-watch" : ""}`}
          >
            {summary.watch} watch
          </span>
          <span className="trackspace-tag trackspace-tabular">
            {summary.withSlip} schedule
          </span>
          <span className="trackspace-tag trackspace-tabular">
            {summary.withFunding} funding
          </span>
        </div>

        <p className="trackspace-page-lede">{programRead(summary, attention)}</p>

        <section className="trackspace-mssec trackspace-prog-register">
          <h3>
            {currentLens.label} <b>{visible.length}</b>
          </h3>
          <div className="trackspace-prog-list">
            <div className="trackspace-prog-head" aria-hidden="true">
              <span>Capability</span>
              <span>Status</span>
              <span>Schedule and funding</span>
              <span>Readiness</span>
            </div>
            {visible.map((entry) => (
              <ProgramCapabilityRow
                key={entry.capability.id}
                entry={entry}
                onOpen={onOpen}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function programRead(
  summary: ReturnType<typeof getProgramSummary>,
  attention: ProgramEntry[],
): string {
  if (attention.length === 0) {
    return `${summary.ready} tracked capabilities are marked ready, with no blockers or watch items in the program records.`;
  }

  const lead = attention
    .slice(0, 3)
    .map((entry) => entry.capability.name)
    .join(", ");
  return `${summary.blockers} blockers and ${summary.watch} watch items need attention first. Most pressing: ${lead}.`;
}

function ProgramCapabilityRow({
  entry,
  onOpen,
}: {
  entry: ProgramEntry;
  onOpen: (selection: DrawerSelection) => void;
}) {
  const capability = entry.capability;
  const facts = programFacts(capability);

  return (
    <button
      type="button"
      className="trackspace-prog-row"
      onClick={() => onOpen({ type: "capability", id: capability.id })}
    >
      <span className="trackspace-prog-row-main">
        <span className="trackspace-prog-row-name">{capability.name}</span>
        <span className="trackspace-prog-row-sub">
          {capability.group}
        </span>
      </span>
      <span className="trackspace-prog-row-status">
        <StatusChip status={entry.status} />
      </span>
      <span className="trackspace-prog-row-facts">
        {facts.map((fact) => (
          <span className="trackspace-prog-row-fact" key={fact.label}>
            <span className="trackspace-prog-fact-label">{fact.label}</span>
            <span className="trackspace-prog-fact-val">{fact.value}</span>
          </span>
        ))}
      </span>
      <span className="trackspace-prog-row-readiness">
        <span className="trackspace-readiness-bar">
          <span
            className={`trackspace-bg-${capability.status}`}
            style={{ width: `${capability.readiness}%` }}
          />
        </span>
        <span className="trackspace-prog-row-pct trackspace-tabular">
          {capability.readiness}%
        </span>
      </span>
    </button>
  );
}

/** Schedule and funding first; fall back to target or provider so no row is empty. */
function programFacts(capability: Capability): ProgramFact[] {
  const metrics = capability.metrics;
  const facts: ProgramFact[] = [];
  if (metrics?.slip) facts.push({ label: "Schedule", value: metrics.slip });
  if (metrics?.funding) facts.push({ label: "Funding", value: metrics.funding });
  if (facts.length === 0 && metrics?.target) {
    facts.push({ label: "Target", value: metrics.target });
  }
  if (facts.length === 0 && metrics?.provider) {
    facts.push({ label: "Provider", value: metrics.provider });
  }
  if (facts.length === 0) facts.push({ label: "Program", value: "Tracked" });
  return facts;
}
