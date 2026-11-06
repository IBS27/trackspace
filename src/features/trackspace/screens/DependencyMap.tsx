"use client";

import { useState, type CSSProperties } from "react";
import type { DrawerSelection } from "../components/DetailDrawer";
import { useMediaQuery } from "../components/useMediaQuery";
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
const NODE_WIDTH = 196;
const GRAPH_WIDTH = 1190;
const GRAPH_HEIGHT = 676;
const LANE_WIDTH = 252;

const NODE_POSITIONS: Record<CapabilityId, { x: number; y: number }> = {
  // Foundations — launch, propulsion, crew and power everything builds on.
  sls: { x: 160, y: 96 },
  esm: { x: 160, y: 222 },
  cryo: { x: 160, y: 348 },
  suit: { x: 160, y: 474 },
  power: { x: 160, y: 600 },
  // Enablers — reaching and moving around the surface, plus prospecting.
  orion: { x: 450, y: 96 },
  gateway: { x: 450, y: 222 },
  hls: { x: 450, y: 348 },
  ltv: { x: 450, y: 474 },
  ice: { x: 450, y: 600 },
  // Infrastructure — relay, resource processing, construction, thermal, storage.
  comms: { x: 740, y: 96 },
  isru: { x: 740, y: 222 },
  build: { x: 740, y: 348 },
  thermal: { x: 740, y: 474 },
  night: { x: 740, y: 600 },
  // Surface systems — keeping a crew alive against the lunar environment.
  rad: { x: 1030, y: 96 },
  dust: { x: 1030, y: 222 },
  health: { x: 1030, y: 348 },
  eclss: { x: 1030, y: 474 },
  hab: { x: 1030, y: 600 },
};

const COLUMN_HEADERS = [
  { x: 160, title: "Foundations" },
  { x: 450, title: "Enablers" },
  { x: 740, title: "Infrastructure" },
  { x: 1030, title: "Surface systems" },
];

/** Capabilities per column, top to bottom. */
const LANES = COLUMN_HEADERS.map((column) => ({
  title: column.title,
  ids: (Object.keys(NODE_POSITIONS) as CapabilityId[])
    .filter((id) => NODE_POSITIONS[id].x === column.x)
    .sort((a, b) => NODE_POSITIONS[a].y - NODE_POSITIONS[b].y),
}));

const COLUMN_X = COLUMN_HEADERS.map((column) => column.x);
const ROW_Y = [...new Set(Object.values(NODE_POSITIONS).map((p) => p.y))].sort((a, b) => a - b);
const ROW_STEP = ROW_Y[1] - ROW_Y[0];
// Horizontal channels run through the gaps between rows (and below the last row).
const CHANNELS = ROW_Y.map((y) => y + ROW_STEP / 2);

/**
 * Edges between neighboring tiers curve across the gutter. Edges that skip a
 * tier drop into the nearest row gap, run along it, and rise into the target,
 * so they never pass through a card.
 */
function edgePath(from: CapabilityId, to: CapabilityId): string | null {
  const a = NODE_POSITIONS[from];
  const b = NODE_POSITIONS[to];
  if (!a || !b) return null;
  const x1 = a.x + NODE_WIDTH / 2;
  const x2 = b.x - NODE_WIDTH / 2;
  const span = COLUMN_X.indexOf(b.x) - COLUMN_X.indexOf(a.x);
  if (span <= 1) {
    const mx = (x1 + x2) / 2;
    return `M${x1},${a.y} C${mx},${a.y} ${mx},${b.y} ${x2},${b.y}`;
  }
  const gutter = COLUMN_X[1] - COLUMN_X[0] - NODE_WIDTH;
  const mid = (a.y + b.y) / 2;
  const channel = CHANNELS.reduce((best, y) =>
    Math.abs(y - mid) < Math.abs(best - mid) ? y : best,
  );
  const enter = x1 + gutter;
  const exit = x2 - gutter;
  const m1 = x1 + gutter / 2;
  const m2 = x2 - gutter / 2;
  return [
    `M${x1},${a.y}`,
    `C${m1},${a.y} ${m1},${channel} ${enter},${channel}`,
    `L${exit},${channel}`,
    `C${m2},${channel} ${m2},${b.y} ${x2},${b.y}`,
  ].join(" ");
}

function statusColor(status: Status): string {
  return `var(--ts-${status})`;
}

/** Everything upstream and downstream of `id`, including `id` itself. */
function relatedTo(
  id: CapabilityId,
  edges: { from: CapabilityId; to: CapabilityId }[],
): Set<CapabilityId> {
  const related = new Set<CapabilityId>([id]);
  for (const direction of ["up", "down"] as const) {
    const queue: CapabilityId[] = [id];
    while (queue.length > 0) {
      const current = queue.shift() as CapabilityId;
      for (const edge of edges) {
        const [near, far] = direction === "up" ? [edge.to, edge.from] : [edge.from, edge.to];
        if (near === current && !related.has(far)) {
          related.add(far);
          queue.push(far);
        }
      }
    }
  }
  return related;
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

  const related = hovered ? relatedTo(hovered, edges) : null;
  // Phones get a stacked list per tier instead of a sideways-scrolling canvas.
  const stacked = useMediaQuery("(max-width: 680px)");

  const matches = (capability: Capability) =>
    (groupFilter.length === 0 || groupFilter.includes(capability.group)) &&
    (statusFilter.length === 0 || statusFilter.includes(capability.status));

  return (
    <div className="trackspace-dep">
      <div className="trackspace-dep-bar">
        <span className="trackspace-dep-title">Dependency map</span>
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
            All
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

      {stacked ? (
        <div className="trackspace-deplist">
          {LANES.map((lane) => (
            <section className="trackspace-deplane" key={lane.title}>
              <h3 className="trackspace-deplane-title">{lane.title}</h3>
              {lane.ids.map((id) => {
                const capability = capById[id];
                if (!capability) return null;
                const needs = capability.deps
                  .map((dep) => capById[dep]?.name)
                  .filter(Boolean)
                  .join(", ");
                return (
                  <button
                    type="button"
                    key={id}
                    className={`trackspace-dcard${matches(capability) ? "" : " is-dim"}`}
                    style={{ "--node-status": statusColor(capability.status) } as CSSProperties}
                    onClick={() => onOpen({ type: "capability", id })}
                  >
                    <span className="trackspace-dcard-top">
                      <span className="trackspace-gnode-name">{capability.name}</span>
                      <span
                        className={`trackspace-gnode-state trackspace-${capability.status}`}
                      >
                        {STATUS[capability.status].label}
                      </span>
                    </span>
                    <span className="trackspace-dcard-bar">
                      <span className="trackspace-gnode-bar" aria-hidden="true">
                        <span
                          style={{
                            width: `${capability.readiness}%`,
                            background: statusColor(capability.status),
                          }}
                        />
                      </span>
                      <span className="trackspace-gnode-readiness trackspace-tabular">
                        {capability.readiness}%
                      </span>
                    </span>
                    {needs && <span className="trackspace-dcard-needs">Needs {needs}</span>}
                  </button>
                );
              })}
            </section>
          ))}
        </div>
      ) : (
        <div className="trackspace-graph">
          <div
            className="trackspace-graph-inner"
            style={{ width: GRAPH_WIDTH, height: GRAPH_HEIGHT }}
          >
            {COLUMN_HEADERS.map((column) => (
              <div
                key={column.title}
                className="trackspace-lane"
                style={{ left: column.x - LANE_WIDTH / 2, width: LANE_WIDTH }}
              >
                <span className="trackspace-colhdr">{column.title}</span>
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
                  <path d="M0,0 L7,3.5 L0,7 z" fill="context-stroke" />
                </marker>
              </defs>
              {edges.map((edge) => {
                const path = edgePath(edge.from, edge.to);
                if (!path) return null;
                const active =
                  matches(capById[edge.from]) &&
                  matches(capById[edge.to]);
                const hot =
                  related !== null && related.has(edge.from) && related.has(edge.to);
                const faded = related !== null && !hot;
                return (
                  <path
                    key={`${edge.from}-${edge.to}`}
                    d={path}
                    fill="none"
                    markerEnd="url(#trackspace-arrowhead)"
                    strokeDasharray={
                      edge.status === "blocker" ? "6 4" : undefined
                    }
                    style={{
                      stroke: hot
                        ? statusColor(edge.status)
                        : edge.status === "blocker"
                          ? "rgba(242, 100, 116, 0.55)"
                          : "#3a404c",
                      strokeWidth: hot ? 2 : 1.4,
                      opacity: !active ? 0.1 : faded ? 0.18 : 1,
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
                  }${related && !related.has(capability.id) ? " is-faded" : ""}`}
                  style={
                    {
                      left: position.x,
                      top: position.y,
                      "--node-status": statusColor(capability.status),
                    } as CSSProperties
                  }
                  onMouseEnter={() => setHovered(capability.id)}
                  onMouseLeave={() => setHovered(null)}
                  onFocus={() => setHovered(capability.id)}
                  onBlur={() => setHovered(null)}
                  onClick={() =>
                    onOpen({ type: "capability", id: capability.id })
                  }
                >
                  <span className="trackspace-gnode-name">
                    {capability.name}
                  </span>
                  <span className="trackspace-gnode-bar" aria-hidden="true">
                    <span
                      style={{
                        width: `${capability.readiness}%`,
                        background: statusColor(capability.status),
                      }}
                    />
                  </span>
                  <span className="trackspace-gnode-foot">
                    <span className="trackspace-gnode-readiness trackspace-tabular">
                      {capability.readiness}%
                    </span>
                    <span
                      className={`trackspace-gnode-state trackspace-${capability.status}`}
                    >
                      {STATUS[capability.status].label}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
