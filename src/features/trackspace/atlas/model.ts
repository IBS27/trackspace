import type {
  Capability,
  CapabilityId,
  Dataset,
  Location,
  Source,
} from "../data/types";

export type AtlasView = "system" | "earth" | "moon" | "surface";
export type InfrastructureStage = "demonstrated" | "planned" | "conceptual";
export type AtlasSelection =
  | { kind: "capability"; id: string }
  | { kind: "milestone"; id: string }
  | { kind: "event"; id: string }
  | { kind: "location"; id: string };

export type AtlasContext = {
  selection: AtlasSelection | null;
  title: string;
  subtitle: string;
  locations: Location[];
  primaryLocationId: string | null;
  /** Selected capabilities followed by their transitive requirements and effects. */
  capabilityIds: CapabilityId[];
  upstream: Capability[];
  downstream: Capability[];
  sources: Source[];
};

/** Coordinates must be usable by both the globe and the regional view. */
export function isAtlasLocation(location: Location): boolean {
  return (
    (location.body === "earth" || location.body === "moon") &&
    typeof location.lat === "number" &&
    Number.isFinite(location.lat) &&
    Math.abs(location.lat) <= 90 &&
    typeof location.lon === "number" &&
    Number.isFinite(location.lon) &&
    Math.abs(location.lon) <= 180
  );
}

function uniqueSources(sources: Source[]): Source[] {
  return [...new Map(sources.map((source) => [source.url, source])).values()];
}

function walkCapabilities(
  roots: CapabilityId[],
  capabilities: Capability[],
  direction: "upstream" | "downstream",
): Capability[] {
  const byId = new Map(capabilities.map((capability) => [capability.id, capability]));
  const visited = new Set(roots);
  const queue = [...roots];
  const result: Capability[] = [];
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const id = queue[cursor];
    const neighbors = direction === "upstream"
      ? byId.get(id)?.deps ?? []
      : capabilities.filter((capability) => capability.deps.includes(id)).map((capability) => capability.id);
    for (const neighborId of neighbors) {
      const neighbor = byId.get(neighborId);
      if (!neighbor || visited.has(neighborId)) continue;
      visited.add(neighborId);
      queue.push(neighborId);
      result.push(neighbor);
    }
  }
  return result;
}

export function deriveAtlasContext(
  dataset: Dataset,
  selection: AtlasSelection | null,
): AtlasContext {
  const sceneLocations = dataset.locations.filter(isAtlasLocation);
  const overview: AtlasContext = {
    selection: null,
    title: "Earth–Moon atlas",
    subtitle: "Explore the places and capabilities behind a sustained lunar presence.",
    locations: sceneLocations,
    primaryLocationId: null,
    capabilityIds: [],
    upstream: [],
    downstream: [],
    sources: [],
  };
  if (!selection) return overview;

  let title: string;
  let subtitle: string;
  let rootIds: CapabilityId[];
  let sources: Source[];
  let directLocations: Location[];

  switch (selection.kind) {
    case "capability": {
      const capability = dataset.capabilities.find((item) => item.id === selection.id);
      if (!capability) return overview;
      title = capability.name;
      subtitle = capability.blurb;
      rootIds = [capability.id];
      sources = capability.sources;
      directLocations = sceneLocations.filter((location) => location.relatedCapabilities.includes(capability.id));
      // Surface work is best framed at its lunar destination when one is known.
      if (capability.group === "surface" || capability.group === "comms") {
        directLocations = [...directLocations].sort((a, b) => Number(b.body === "moon") - Number(a.body === "moon"));
      }
      break;
    }
    case "milestone": {
      const milestone = dataset.milestones.find((item) => item.id === selection.id);
      if (!milestone) return overview;
      title = `${milestone.code} · ${milestone.name}`;
      subtitle = milestone.summary;
      rootIds = milestone.caps;
      sources = milestone.sources;
      directLocations = sceneLocations.filter((location) => location.relatedMilestones.includes(milestone.id));
      break;
    }
    case "event": {
      const event = dataset.events.find((item) => item.id === selection.id);
      if (!event) return overview;
      title = event.title;
      subtitle = event.what;
      rootIds = event.caps;
      sources = event.sources;
      directLocations = sceneLocations.filter((location) => location.relatedEvents.includes(event.id));
      // New events may arrive before a location receives an explicit backlink.
      if (directLocations.length === 0) {
        directLocations = sceneLocations.filter((location) => location.relatedCapabilities.some((id) => rootIds.includes(id)));
      }
      break;
    }
    case "location": {
      const location = dataset.locations.find((item) => item.id === selection.id);
      if (!location) return overview;
      title = location.name;
      subtitle = location.summary;
      rootIds = location.relatedCapabilities;
      sources = location.sources;
      directLocations = isAtlasLocation(location) ? [location] : [];
      break;
    }
  }

  // Live snapshots can temporarily omit a linked capability.
  rootIds = [...new Set(rootIds)].filter((id) => dataset.capabilities.some((capability) => capability.id === id));
  const upstream = walkCapabilities(rootIds, dataset.capabilities, "upstream");
  const downstream = walkCapabilities(rootIds, dataset.capabilities, "downstream");
  const capabilityIds = [...new Set([...rootIds, ...upstream.map((item) => item.id), ...downstream.map((item) => item.id)])];
  const relevantIds = new Set(capabilityIds);
  const relatedLocations = sceneLocations.filter((location) => location.relatedCapabilities.some((id) => relevantIds.has(id)));
  const locations = [...new Map([...directLocations, ...relatedLocations].map((location) => [location.id, location])).values()];
  return {
    selection,
    title,
    subtitle,
    locations,
    primaryLocationId: directLocations[0]?.id ?? locations[0]?.id ?? null,
    capabilityIds,
    upstream,
    downstream,
    sources: uniqueSources(sources),
  };
}

export type AtlasInfrastructure = {
  id: string;
  name: string;
  capabilityId: CapabilityId;
  stage: InfrastructureStage;
  description: string;
  locationId: string;
  placement: {
    /** A region is approximate; a conceptual layout is never a surveyed site plan. */
    kind: "documented-region" | "conceptual-layout";
    anchorLocationId: string;
    /** Relative display units, not geographic coordinates or physical distances. */
    offset: [number, number];
  };
  sources: Source[];
};

type InfrastructureDefinition = Omit<AtlasInfrastructure, "sources">;

const INFRASTRUCTURE: InfrastructureDefinition[] = [
  {
    id: "electrodynamic-dust-shield",
    name: "Dust shield demonstration",
    capabilityId: "dust",
    stage: "demonstrated",
    description: "Blue Ghost demonstrated dust removal from glass and radiator surfaces at Mare Crisium. The mission has ended; this is not an operating base system.",
    locationId: "mare-crisium-blue-ghost",
    placement: { kind: "documented-region", anchorLocationId: "mare-crisium-blue-ghost", offset: [0, 0] },
  },
  {
    id: "viper-prospecting",
    name: "VIPER prospecting rover",
    capabilityId: "ice",
    stage: "planned",
    description: "Planned prospecting in the Mons Mouton target area. No rover is shown as deployed, and the target region is not an exact landing coordinate.",
    locationId: "mons-mouton",
    placement: { kind: "documented-region", anchorLocationId: "mons-mouton", offset: [0, 0] },
  },
  {
    id: "surface-mobility",
    name: "Lunar terrain vehicle",
    capabilityId: "ltv",
    stage: "planned",
    description: "Crew rover in development. Its position in this illustrative layout does not represent a selected delivery site.",
    locationId: "lunar-south-pole",
    placement: { kind: "conceptual-layout", anchorLocationId: "lunar-south-pole", offset: [2.1, 0.7] },
  },
  {
    id: "surface-power",
    name: "Surface power system",
    capabilityId: "power",
    stage: "planned",
    description: "Fission surface power is in development. The reactor form, placement, and separation shown here are illustrative; no integrated flight reactor is deployed.",
    locationId: "lunar-south-pole",
    placement: { kind: "conceptual-layout", anchorLocationId: "lunar-south-pole", offset: [-3.5, -2.4] },
  },
  {
    id: "surface-habitat",
    name: "Surface habitat concept",
    capabilityId: "hab",
    stage: "conceptual",
    description: "Illustrative long-stay shelter. Its design and placement are conceptual; power, communications, and thermal control are upstream requirements.",
    locationId: "lunar-south-pole",
    placement: { kind: "conceptual-layout", anchorLocationId: "lunar-south-pole", offset: [0, 0] },
  },
  {
    id: "resource-processing",
    name: "Resource processing concept",
    capabilityId: "isru",
    stage: "conceptual",
    description: "Illustrative processing equipment. No production plant has operated on the Moon, and water extraction depends on prospecting results.",
    locationId: "lunar-south-pole",
    placement: { kind: "conceptual-layout", anchorLocationId: "lunar-south-pole", offset: [3.2, -2.2] },
  },
  {
    id: "surface-thermal",
    name: "Habitat thermal control concept",
    capabilityId: "thermal",
    stage: "conceptual",
    description: "Illustrative radiator and thermal-control equipment. Earth testing and a lunar dust experiment do not establish an operational habitat cooling system.",
    locationId: "lunar-south-pole",
    placement: { kind: "conceptual-layout", anchorLocationId: "lunar-south-pole", offset: [-1.6, 1.5] },
  },
];

/** Stages describe specific hardware claims, never inferred from readiness scores. */
export function getAtlasInfrastructure(dataset: Dataset): AtlasInfrastructure[] {
  return INFRASTRUCTURE.flatMap((item) => {
    const capability = dataset.capabilities.find((candidate) => candidate.id === item.capabilityId);
    const location = dataset.locations.find((candidate) => candidate.id === item.locationId);
    if (!capability || !location || !isAtlasLocation(location)) return [];
    const sources = uniqueSources(item.placement.kind === "documented-region"
      ? location.sources
      : capability.sources);
    if (sources.length === 0) return [];
    return [{ ...item, placement: { ...item.placement, offset: [...item.placement.offset] as [number, number] }, sources }];
  });
}
