"use client";

import { useState } from "react";
import { ConfidenceChip } from "../components/ConfidenceChip";
import type { DrawerSelection } from "../components/DetailDrawer";
import { StatusChip } from "../components/StatusChip";
import { useDataset } from "../data/dataset-context";
import { CAPABILITY_GROUPS, STATUS, STATUS_LIST } from "../data/seed";
import { capabilityById, getDependencyEdges } from "../data/selectors";
import type {
  Capability,
  CapabilityGroup,
  CapabilityId,
  Status,
} from "../data/types";

// Fixed layout: capabilities flow left to right from foundations to the
// surface systems that depend on them. Positions are node centers.
const NODE_WIDTH = 172;
const GRAPH_WIDTH = 1180;
const GRAPH_HEIGHT = 760;

const NODE_POSITIONS: Record<CapabilityId, { x: number; y: number }> = {
  sls: { x: 150, y: 120 },
  esm: { x: 150, y: 255 },
  cryo: { x: 150, y: 390 },
  suit: { x: 150, y: 525 },
  power: { x: 150, y: 660 },
  orion: { x: 430, y: 150 },
  gateway: { x: 430, y: 300 },
  hls: { x: 430, y: 440 },
  ltv: { x: 430, y: 570 },
  isru: { x: 430, y: 690 },
  comms: { x: 730, y: 330 },
  hab: { x: 1010, y: 560 },
};

const COLUMN_HEADERS = [
  { x: 150, title: "Foundations" },
  { x: 430, title: "Enablers" },
  { x: 730, title: "Relay" },
  { x: 1010, title: "Surface" },
];

function edgePath(from: CapabilityId, to: CapabilityId): string {
  const a = NODE_POSITIONS[from];
  const b = NODE_POSITIONS[to];
  const x1 = a.x + NODE_WIDTH / 2;
  const x2 = b.x - NODE_WIDTH / 2;
  const mx = (x1 + x2) / 2;
  return `M${x1},${a.y} C${mx},${a.y} ${mx},${b.y} ${x2},${b.y}`;
}

function statusColor(status: Status): string {
  return `var(--ts-${status})`;
}

function toggle<T>(values: T[], value: T): T[] {
  return values.includes(value)
    ? values.filter((v) => v !== value)
    : [...values, value];
}

type DependencyMapProps = {
  onOpen: (selection: DrawerSelection) => void;
};

export function DependencyMap({ onOpen }: DependencyMapProps) {
  const dataset = useDataset();
  const capById = capabilityById(dataset.capabilities);
  const edges = getDependencyEdges(dataset.capabilities);
  const [groupFilter, setGroupFilter] = useState<CapabilityGroup[]>([]);
  const [statusFilter, setStatusFilter] = useState<Status[]>([]);
  const [hovered, setHovered] = useState<CapabilityId | null>(null);

  const matches = (capability: Capability) =>
    (groupFilter.length === 0 || groupFilter.includes(capability.group)) &&
    (statusFilter.length === 0 || statusFilter.includes(capability.status));

  return (
    <div className="trackspace-dep">
      <div className="trackspace-dep-bar">
        <span className="trackspace-dep-title">Dependency Map</span>
        <div
          className="trackspace-dep-filters"
          role="group"
          aria-label="Capability group filters"
        >
          <button
            type="button"
            className={`trackspace-fchip${groupFilter.length === 0 ? " is-on" : ""}`}
            aria-pressed={groupFilter.length === 0}
            onClick={() => setGroupFilter([])}
          >
            All caps
          </button>
          {CAPABILITY_GROUPS.map((group) => (
            <button
              type="button"
              key={group}
              className={`trackspace-fchip${groupFilter.includes(group) ? " is-on" : ""}`}
              aria-pressed={groupFilter.includes(group)}
              onClick={() => setGroupFilter(toggle(groupFilter, group))}
            >
              {group}
            </button>
          ))}
        </div>
        <span className="trackspace-grow" />
        <div
          className="trackspace-dep-legend"
          role="group"
          aria-label="Status filters"
        >
          {STATUS_LIST.map((status) => (
            <button
              type="button"
              key={status}
              className={`trackspace-dep-legend-item${statusFilter.includes(status) ? " is-on" : ""}`}
              aria-pressed={statusFilter.includes(status)}
              onClick={() => setStatusFilter(toggle(statusFilter, status))}
            >
              <span
                className="trackspace-dep-legend-swatch"
                style={{
                  background: statusColor(status),
                  opacity:
                    statusFilter.length === 0 || statusFilter.includes(status)
                      ? 1
                      : 0.3,
                }}
                aria-hidden="true"
              />
              {STATUS[status].label}
            </button>
          ))}
        </div>
      </div>

      <div className="trackspace-graph">
        <div className="trackspace-graph-inner">
          {COLUMN_HEADERS.map((column) => (
            <div
              key={column.title}
              className="trackspace-colhdr"
              style={{ left: column.x }}
            >
              {column.title}
            </div>
          ))}

          <svg
            className="trackspace-edges"
            viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`}
            aria-hidden="true"
          >
            <defs>
              <marker
                id="trackspace-arrowhead"
                markerWidth="7"
                markerHeight="7"
                refX="6"
                refY="3.5"
                orient="auto"
              >
                <path d="M0,0 L7,3.5 L0,7 z" fill="#3a475c" />
              </marker>
            </defs>
            {edges.map((edge) => {
              const active =
                matches(capById[edge.from]) &&
                matches(capById[edge.to]);
              const hot = hovered === edge.from || hovered === edge.to;
              return (
                <path
                  key={`${edge.from}-${edge.to}`}
                  d={edgePath(edge.from, edge.to)}
                  fill="none"
                  markerEnd="url(#trackspace-arrowhead)"
                  strokeDasharray={
                    edge.status === "blocker" ? "6 4" : undefined
                  }
                  style={{
                    stroke: hot
                      ? statusColor(edge.status)
                      : edge.status === "blocker"
                        ? "rgba(255, 84, 104, 0.45)"
                        : "#2a3445",
                    strokeWidth: hot ? 2.2 : 1.4,
                    opacity: active ? 1 : 0.12,
                  }}
                />
              );
            })}
          </svg>

          {dataset.capabilities.map((capability) => {
            const position = NODE_POSITIONS[capability.id];
            if (!position) return null;
            const on = matches(capability);
            return (
              <button
                type="button"
                key={capability.id}
                className={`trackspace-gnode${on ? "" : " is-dim"}${
                  hovered === capability.id ? " is-sel" : ""
                }`}
                style={{ left: position.x, top: position.y }}
                onMouseEnter={() => setHovered(capability.id)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(capability.id)}
                onBlur={() => setHovered(null)}
                onClick={() =>
                  onOpen({ type: "capability", id: capability.id })
                }
              >
                <span className="trackspace-gnode-top">
                  <span className="trackspace-gnode-name">
                    {capability.name}
                  </span>
                  <span
                    className="trackspace-gnode-dot"
                    style={{
                      background: statusColor(capability.status),
                      boxShadow: `0 0 8px ${statusColor(capability.status)}`,
                    }}
                    aria-hidden="true"
                  />
                </span>
                <span className="trackspace-gnode-status">
                  <StatusChip status={capability.status} compact />
                  <span className="trackspace-gnode-readiness trackspace-tabular">
                    {capability.readiness}%
                  </span>
                </span>
                <span className="trackspace-gnode-bar" aria-hidden="true">
                  <span
                    style={{
                      width: `${capability.readiness}%`,
                      background: statusColor(capability.status),
                    }}
                  />
                </span>
                <span className="trackspace-gnode-meta">
                  <ConfidenceChip confidence={capability.conf} />
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
