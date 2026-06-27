"use client";

import { useState, type ReactNode } from "react";

import type { DrawerSelection } from "../components/DetailDrawer";
import { StatusChip } from "../components/StatusChip";
import { useDataset } from "../data/dataset-context";
import {
  getProgramRegister,
  getProgramSummary,
  type ProgramEntry,
} from "../data/selectors";
import type { Capability, Status } from "../data/types";

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

  const attention = register.filter(
    (entry) => entry.status === "blocker" || entry.status === "watch",
  );
  const schedule = register.filter((entry) => entry.hasScheduleSignal);
  const funding = register.filter((entry) => entry.hasFundingSignal);
  const ready = register.filter((entry) => entry.status === "ready");
  const signals = register.filter(
    (entry) => entry.hasScheduleSignal || entry.hasFundingSignal,
  );

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
    status?: Status;
  }[] = [
    {
      id: "attention",
      label: "Needs attention",
      detail: `${summary.blockers} blockers · ${summary.watch} watch`,
      count: attention.length,
      status: summary.blockers > 0 ? "blocker" : "watch",
    },
    {
      id: "schedule",
      label: "Schedule signals",
      detail: "Documented slips and timing pressure",
      count: schedule.length,
      status: "watch",
    },
    {
      id: "funding",
      label: "Funding signals",
      detail: "Public contract or budget figures",
      count: funding.length,
      status: "ready",
    },
    {
      id: "ready",
      label: "Stable",
      detail: "Tracked records already marked ready",
      count: ready.length,
      status: "ready",
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
      <nav className="trackspace-prog-rail" aria-label="Program views">
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
              <span
                className="trackspace-prog-lens-dot"
                style={{
                  background: row.status
                    ? `var(--ts-${row.status})`
                    : "var(--ts-accent)",
                  boxShadow: row.status
                    ? `0 0 7px var(--ts-${row.status})`
                    : "0 0 7px var(--ts-accent)",
                }}
                aria-hidden="true"
              />
            </span>
          </button>
        ))}
      </nav>

      <div className="trackspace-prog-page">
        <div className="trackspace-prog-kicker">
          Program · funding + schedule
        </div>
        <h1>Program Health</h1>
        <div className="trackspace-prog-meta">
          <span className="trackspace-cchip trackspace-cchip-up trackspace-tabular">
            {summary.tracked}/{dataset.capabilities.length} tracked
          </span>
          <StatusChip status="blocker" />
          <span className="trackspace-cchip trackspace-cchip-up trackspace-cchip-critical trackspace-tabular">
            {summary.blockers} blockers
          </span>
          <StatusChip status="watch" />
          <span className="trackspace-cchip trackspace-cchip-up trackspace-tabular">
            {summary.watch} watch
          </span>
          <span className="trackspace-cchip trackspace-cchip-up trackspace-tabular">
            {summary.withSlip} schedule
          </span>
          <span className="trackspace-cchip trackspace-cchip-up trackspace-tabular">
            {summary.withFunding} funding
          </span>
        </div>

        <p className="trackspace-prog-objective">
          Public program data for the capabilities that carry funding,
          provider, target, or schedule records. Blocker and watch records show
          where schedule, hardware, or contract pressure is currently
          concentrated.
        </p>

        <div className="trackspace-assess trackspace-prog-assess">
          <span className="trackspace-assess-label">CURRENT READ</span>
          {programRead(summary, attention)}
        </div>

        <div className="trackspace-prog-cols">
          <section className="trackspace-mssec">
            <h3>
              Needs attention <b>{attention.length}</b>
            </h3>
            <div className="trackspace-rows">
              {attention.length > 0 ? (
                attention.slice(0, 6).map((entry) => (
                  <ProgramCompactRow
                    key={entry.capability.id}
                    entry={entry}
                    onOpen={onOpen}
                  />
                ))
              ) : (
                <p className="trackspace-mssec-empty">
                  No blockers or watch items in the tracked program records.
                </p>
              )}
            </div>
          </section>

          <section className="trackspace-mssec">
            <h3>
              Schedule / funding <b>{signals.length}</b>
            </h3>
            <div className="trackspace-rows">
              {signals.length > 0 ? (
                signals.slice(0, 6).map((entry) => (
                  <ProgramSignalRow
                    key={entry.capability.id}
                    entry={entry}
                    onOpen={onOpen}
                  />
                ))
              ) : (
                <p className="trackspace-mssec-empty">
                  No schedule or funding signal is attached to the current
                  tracked records.
                </p>
              )}
            </div>
          </section>
        </div>

        <section className="trackspace-mssec trackspace-prog-register">
          <h3>
            {currentLens.label} <b>{visible.length}</b>
          </h3>
          <div className="trackspace-prog-list">
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
    .map((entry) => entry.capability.short)
    .join(", ");
  return `${summary.blockers} blockers and ${summary.watch} watch items need attention first. Highest-pressure records: ${lead}.`;
}

function ProgramCompactRow({
  entry,
  onOpen,
}: {
  entry: ProgramEntry;
  onOpen: (selection: DrawerSelection) => void;
}) {
  const fact = primaryProgramFact(entry.capability);

  return (
    <button
      type="button"
      className="trackspace-crow trackspace-prog-crow"
      onClick={() => onOpen({ type: "capability", id: entry.capability.id })}
    >
      <span className="trackspace-crow-date">{entry.capability.short}</span>
      <span className="trackspace-crow-main">
        <span className="trackspace-crow-title">{entry.capability.name}</span>
        <span className="trackspace-crow-meta">
          <StatusChip status={entry.status} />
          <span className="trackspace-cchip trackspace-tabular">
            {entry.capability.readiness}% ready
          </span>
          <span className="trackspace-cchip">{fact.label}</span>
        </span>
      </span>
    </button>
  );
}

function ProgramSignalRow({
  entry,
  onOpen,
}: {
  entry: ProgramEntry;
  onOpen: (selection: DrawerSelection) => void;
}) {
  const facts = signalFacts(entry.capability);

  return (
    <button
      type="button"
      className="trackspace-crow trackspace-prog-crow"
      onClick={() => onOpen({ type: "capability", id: entry.capability.id })}
    >
      <span className="trackspace-crow-date">{entry.capability.short}</span>
      <span className="trackspace-crow-main">
        <span className="trackspace-crow-title">{entry.capability.name}</span>
        <span className="trackspace-prog-signal-lines">
          {facts.map((fact) => (
            <span className="trackspace-prog-signal-line" key={fact.label}>
              <span>{fact.label}</span>
              {fact.value}
            </span>
          ))}
        </span>
      </span>
    </button>
  );
}

function ProgramCapabilityRow({
  entry,
  onOpen,
}: {
  entry: ProgramEntry;
  onOpen: (selection: DrawerSelection) => void;
}) {
  const capability = entry.capability;
  const fact = primaryProgramFact(capability);

  return (
    <button
      type="button"
      className="trackspace-prog-row"
      onClick={() => onOpen({ type: "capability", id: capability.id })}
    >
      <span
        className="trackspace-prog-row-dot"
        style={{ background: `var(--ts-${entry.status})` }}
        aria-hidden="true"
      />
      <span className="trackspace-prog-row-main">
        <span className="trackspace-prog-row-name">{capability.name}</span>
        <span className="trackspace-prog-row-sub">
          {capability.group} · {capability.short}
        </span>
      </span>
      <span className="trackspace-prog-row-status">
        <StatusChip status={entry.status} />
      </span>
      <span className="trackspace-prog-row-fact">
        <span className="trackspace-prog-fact-label">{fact.label}</span>
        <span className="trackspace-prog-fact-val">{fact.value}</span>
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

function primaryProgramFact(capability: Capability): ProgramFact {
  const metrics = capability.metrics;
  if (metrics?.slip) return { label: "Schedule", value: metrics.slip };
  if (metrics?.funding) return { label: "Funding", value: metrics.funding };
  if (metrics?.target) return { label: "Target", value: metrics.target };
  if (metrics?.provider) return { label: "Provider", value: metrics.provider };
  return { label: "Program", value: "Tracked" };
}

function signalFacts(capability: Capability): ProgramFact[] {
  const metrics = capability.metrics;
  if (!metrics) return [];

  const facts: ProgramFact[] = [];
  if (metrics.slip) facts.push({ label: "Schedule", value: metrics.slip });
  if (metrics.funding) facts.push({ label: "Funding", value: metrics.funding });
  if (facts.length === 0 && metrics.target) {
    facts.push({ label: "Target", value: metrics.target });
  }

  return facts;
}
