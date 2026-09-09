import { describe, expect, it } from "vitest";
import { CURATED } from "../data/selectors";
import type { Capability, CapabilityId, Dataset, Location } from "../data/types";
import { deriveAtlasContext, getAtlasInfrastructure, isAtlasLocation } from "./model";

function capability(id: CapabilityId, deps: CapabilityId[] = []): Capability {
  return { ...CURATED.capabilities[0], id, deps };
}

function location(id: string, relatedCapabilities: CapabilityId[]): Location {
  return { ...CURATED.locations[0], id, relatedCapabilities, relatedEvents: [], relatedMilestones: [] };
}

describe("atlas selection", () => {
  it("traces complete dependency paths without pulling in siblings of upstream requirements", () => {
    const dataset: Dataset = {
      ...CURATED,
      capabilities: [capability("power"), capability("ice"), capability("isru", ["power", "ice"]), capability("hab", ["isru"]), capability("health", ["hab"]), capability("thermal", ["power"])],
      locations: [location("power-site", ["power"]), location("ice-site", ["ice"]), location("isru-site", ["isru"]), location("hab-site", ["hab"]), location("thermal-site", ["thermal"])],
    };
    const context = deriveAtlasContext(dataset, { kind: "capability", id: "isru" });
    expect(context.upstream.map((item) => item.id)).toEqual(["power", "ice"]);
    expect(context.downstream.map((item) => item.id)).toEqual(["hab", "health"]);
    expect(context.capabilityIds).toEqual(["isru", "power", "ice", "hab", "health"]);
    expect(context.locations.map((item) => item.id)).toEqual(["isru-site", "power-site", "ice-site", "hab-site"]);
    expect(context.primaryLocationId).toBe("isru-site");
  });

  it("terminates on dependency cycles and ignores missing linked capabilities", () => {
    const dataset = {
      ...CURATED,
      capabilities: [capability("ice", ["isru", "comms"]), capability("isru", ["ice"])],
    };
    const context = deriveAtlasContext(dataset, { kind: "capability", id: "ice" });
    expect(context.upstream.map((item) => item.id)).toEqual(["isru"]);
    expect(context.downstream.map((item) => item.id)).toEqual(["isru"]);
    expect(context.capabilityIds).toEqual(["ice", "isru"]);
  });

  it("frames explicit event locations before broader capability links", () => {
    const event = { ...CURATED.events[0], id: "event", caps: ["ice"] as CapabilityId[] };
    const dataset = {
      ...CURATED,
      events: [event],
      locations: [location("broad-context", ["ice"]), { ...location("event-site", []), relatedEvents: [event.id] }],
    };
    const context = deriveAtlasContext(dataset, { kind: "event", id: event.id });
    expect(context.primaryLocationId).toBe("event-site");
    expect(context.locations.map((item) => item.id)).toEqual(["event-site", "broad-context"]);
    expect(context.sources).toEqual(event.sources);
  });

  it("finds a capability location for new events without a location backlink", () => {
    const dataset = {
      ...CURATED,
      events: [{ ...CURATED.events[0], id: "new-event", caps: ["dust"] as CapabilityId[] }],
    };
    const context = deriveAtlasContext(dataset, { kind: "event", id: "new-event" });
    expect(context.primaryLocationId).toBe("mare-crisium-blue-ghost");
  });

  it("keeps an explicitly selected place primary even when its capabilities have other sites", () => {
    const context = deriveAtlasContext(CURATED, { kind: "location", id: "im2-prime1" });
    expect(context.primaryLocationId).toBe("im2-prime1");
    expect(context.subtitle).toContain("prevented the drilling result");
    expect(context.locations.some((item) => item.id === "mons-mouton")).toBe(true);
  });

  it("resolves milestone requirements and deduplicates their locations", () => {
    const context = deriveAtlasContext(CURATED, { kind: "milestone", id: "base" });
    const milestone = CURATED.milestones.find((item) => item.id === "base")!;
    expect(context.capabilityIds).toEqual(expect.arrayContaining(milestone.caps));
    expect(new Set(context.locations.map((item) => item.id)).size).toBe(context.locations.length);
    expect(context.sources).toEqual(milestone.sources);
  });

  it.each(["capability", "milestone", "event", "location"] as const)("resets a stale %s selection instead of rendering broken focus", (kind) => {
    expect(deriveAtlasContext(CURATED, { kind, id: "deleted" })).toEqual(deriveAtlasContext(CURATED, null));
  });

  it("excludes malformed coordinates while accepting the poles and zero", () => {
    expect(isAtlasLocation({ ...CURATED.locations[0], lat: 0, lon: 0 })).toBe(true);
    expect(isAtlasLocation({ ...CURATED.locations[0], lat: -90, lon: 180 })).toBe(true);
    for (const lat of [NaN, Infinity, 91, -91]) {
      expect(isAtlasLocation({ ...CURATED.locations[0], lat })).toBe(false);
    }
    expect(isAtlasLocation({ ...CURATED.locations[0], lon: -181 })).toBe(false);
    expect(isAtlasLocation({ ...CURATED.locations[0], body: "cislunar" })).toBe(false);
  });
});

describe("infrastructure evidence", () => {
  it("keeps the completed dust demo at Mare Crisium and does not claim failed prospecting demonstrated extraction", () => {
    const infrastructure = getAtlasInfrastructure(CURATED);
    const demonstrated = infrastructure.filter((item) => item.stage === "demonstrated");
    expect(demonstrated.map((item) => item.capabilityId)).toEqual(["dust"]);
    expect(demonstrated[0].locationId).toBe("mare-crisium-blue-ghost");
    expect(demonstrated[0].description).toContain("mission has ended");
    expect(infrastructure.find((item) => item.capabilityId === "ice")?.stage).toBe("planned");
    expect(infrastructure.some((item) => item.locationId === "im2-prime1")).toBe(false);
  });

  it("marks all base layouts as conceptual placement independently of development stage", () => {
    const base = getAtlasInfrastructure(CURATED).filter((item) => item.locationId === "lunar-south-pole");
    expect(base.length).toBeGreaterThan(0);
    expect(base.every((item) => item.placement.kind === "conceptual-layout")).toBe(true);
    expect(base.some((item) => item.stage === "planned")).toBe(true);
    expect(base.some((item) => item.stage === "conceptual")).toBe(true);
  });

  it("never upgrades an infrastructure stage from a capability readiness score", () => {
    const dataset = { ...CURATED, capabilities: CURATED.capabilities.map((item) => ({ ...item, readiness: 100, status: "ready" as const })) };
    expect(getAtlasInfrastructure(dataset).map((item) => item.stage)).toEqual(getAtlasInfrastructure(CURATED).map((item) => item.stage));
  });

  it("omits catalog items whose supporting records or evidence are absent", () => {
    expect(getAtlasInfrastructure({ ...CURATED, locations: [] })).toEqual([]);
    expect(getAtlasInfrastructure({ ...CURATED, capabilities: [] })).toEqual([]);
    expect(getAtlasInfrastructure({
      ...CURATED,
      capabilities: CURATED.capabilities.map((item) => ({ ...item, sources: [] })),
      locations: CURATED.locations.map((item) => ({ ...item, sources: [] })),
    })).toEqual([]);
  });
});
