"use client";

import { useState, type CSSProperties } from "react";
import type { DrawerSelection } from "../components/DetailDrawer";
import { useEdgeFade } from "../components/useEdgeFade";
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
const GRAPH_WIDTH = 1306;
const GRAPH_HEIGHT = 692;
const LANE_WIDTH = 268;

const NODE_POSITIONS: Record<CapabilityId, { x: number; y: number }> = {
  // Foundations — launch, propulsion, crew and power everything builds on.
  sls: { x: 170, y: 96 },
  esm: { x: 170, y: 222 },
  cryo: { x: 170, y: 348 },
  suit: { x: 170, y: 474 },
  power: { x: 170, y: 600 },
  // Enablers — reaching and moving around the surface, plus prospecting.
  orion: { x: 492, y: 96 },
  gateway: { x: 492, y: 222 },
  hls: { x: 492, y: 348 },
  ltv: { x: 492, y: 474 },
  ice: { x: 492, y: 600 },
  // Infrastructure — relay, resource processing, construction, thermal, storage.
  comms: { x: 814, y: 96 },
  isru: { x: 814, y: 222 },
  build: { x: 814, y: 348 },
  thermal: { x: 814, y: 474 },
  night: { x: 814, y: 600 },
  // Surface systems — keeping a crew alive against the lunar environment.
  rad: { x: 1136, y: 96 },
  dust: { x: 1136, y: 222 },
  health: { x: 1136, y: 348 },
  eclss: { x: 1136, y: 474 },
  hab: { x: 1136, y: 600 },
};

const COLUMN_HEADERS = [
  { x: 170, title: "Foundations" },
  { x: 492, title: "Enablers" },
  { x: 814, title: "Infrastructure" },
  { x: 1136, title: "Surface systems" },
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

// Ports spread over most of the card side; channel lanes a few pixels apart.
const PORT_SPAN = 64;
const MAX_PORT_GAP = 16;
const LANE_GAP = 8;

type Edge = { from: CapabilityId; to: CapabilityId };

function spread(count: number, index: number, gap: number): number {
  return (index - (count - 1) / 2) * gap;
}

function portGap(count: number): number {
  return count > 1 ? Math.min(MAX_PORT_GAP, PORT_SPAN / (count - 1)) : 0;
}

/**
 * Lays out every edge. Edges between neighboring tiers curve across the
 * gutter. Edges that skip a tier drop into the nearest row gap, run along it,
 * and rise into the target, so they never pass through a card. Edges sharing a
 * card side or a row gap are fanned a few pixels apart so each stays traceable.
 */
function layoutEdges(edges: Edge[]): Map<string, string> {
  const key = (edge: Edge) => `${edge.from}-${edge.to}`;
  const y = (id: CapabilityId) => NODE_POSITIONS[id]?.y ?? 0;
  const column = (id: CapabilityId) => COLUMN_X.indexOf(NODE_POSITIONS[id]?.x ?? -1);

  const outPort = new Map<string, number>();
  const inPort = new Map<string, number>();
  for (const id of Object.keys(NODE_POSITIONS) as CapabilityId[]) {
    const outgoing = edges.filter((e) => e.from === id).sort((p, q) => y(p.to) - y(q.to));
    outgoing.forEach((e, i) =>
      outPort.set(key(e), spread(outgoing.length, i, portGap(outgoing.length))),
    );
    const incoming = edges.filter((e) => e.to === id).sort((p, q) => y(p.from) - y(q.from));
    incoming.forEach((e, i) =>
      inPort.set(key(e), spread(incoming.length, i, portGap(incoming.length))),
    );
  }

  // Each tier-skipping edge takes a row gap between its endpoints, preferring
  // the least used one so long runs do not stack into a single ribbon.
  const skips = edges
    .filter((e) => column(e.to) - column(e.from) > 1)
    .sort((p, q) => Math.abs(y(q.to) - y(q.from)) - Math.abs(y(p.to) - y(p.from)));
  const load = new Map<number, number>(CHANNELS.map((c) => [c, 0]));
  const assigned = new Map<string, number>();
  for (const e of skips) {
    const low = Math.min(y(e.from), y(e.to)) - ROW_STEP / 2;
    const high = Math.max(y(e.from), y(e.to)) + ROW_STEP / 2;
    const mid = (y(e.from) + y(e.to)) / 2;
    const candidates = CHANNELS.filter((c) => c >= low && c <= high);
    const pick = (candidates.length > 0 ? candidates : CHANNELS).reduce((best, c) => {
      const cost = (c2: number) => (load.get(c2) ?? 0) * ROW_STEP + Math.abs(c2 - mid);
      return cost(c) < cost(best) ? c : best;
    });
    assigned.set(key(e), pick);
    load.set(pick, (load.get(pick) ?? 0) + 1);
  }
  const channelOf = (e: Edge) => assigned.get(key(e)) ?? CHANNELS[0];
  const laneOffset = new Map<string, number>();
  for (const channel of CHANNELS) {
    const group = skips
      .filter((e) => channelOf(e) === channel)
      .sort((p, q) => y(p.from) - y(q.from) || y(p.to) - y(q.to));
    group.forEach((e, i) => laneOffset.set(key(e), spread(group.length, i, LANE_GAP)));
  }

  const gutter = COLUMN_X[1] - COLUMN_X[0] - NODE_WIDTH;
  const paths = new Map<string, string>();
  for (const e of edges) {
    const a = NODE_POSITIONS[e.from];
    const b = NODE_POSITIONS[e.to];
    if (!a || !b) continue;
    const x1 = a.x + NODE_WIDTH / 2;
    const x2 = b.x - NODE_WIDTH / 2;
    const y1 = a.y + (outPort.get(key(e)) ?? 0);
    const y2 = b.y + (inPort.get(key(e)) ?? 0);
    if (column(e.to) - column(e.from) <= 1) {
      const mx = (x1 + x2) / 2;
      paths.set(key(e), `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`);
      continue;
    }
    const channel = channelOf(e) + (laneOffset.get(key(e)) ?? 0);
    const m1 = x1 + gutter / 2;
    const m2 = x2 - gutter / 2;
    paths.set(
      key(e),
      [
        `M${x1},${y1}`,
        `C${m1},${y1} ${m1},${channel} ${x1 + gutter},${channel}`,
        `L${x2 - gutter},${channel}`,
        `C${m2},${channel} ${m2},${y2} ${x2},${y2}`,
      ].join(" "),
    );
  }
  return paths;
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

  const edgePaths = layoutEdges(edges);
  const related = hovered ? relatedTo(hovered, edges) : null;
  const barRef = useEdgeFade<HTMLDivElement>();
  // Phones get a stacked list per tier instead of a sideways-scrolling canvas.
  const stacked = useMediaQuery("(max-width: 680px)");

  const matches = (capability: Capability) =>
    (groupFilter.length === 0 || groupFilter.includes(capability.group)) &&
    (statusFilter.length === 0 || statusFilter.includes(capability.status));

  return (
    <div className="trackspace-dep">
      <div ref={barRef} className="trackspace-dep-bar">
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
          <span className="trackspace-dep-legend-item is-static">
            <svg width="18" height="6" aria-hidden="true">
              <line
                x1="0"
                y1="3"
                x2="18"
                y2="3"
                stroke="var(--ts-blocker)"
                strokeWidth="1.5"
                strokeDasharray="4 3"
              />
            </svg>
            Blocked path
          </span>
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
                const path = edgePaths.get(`${edge.from}-${edge.to}`);
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
                          ? "rgba(242, 100, 116, 0.7)"
                          : "#5d6576",
                      strokeWidth: hot ? 2.2 : 1.6,
                      opacity: !active ? 0.1 : faded ? 0.28 : 1,
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
