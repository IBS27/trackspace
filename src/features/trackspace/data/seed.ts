// Trackspace seed data, ported from the canonical mock (docs/mock-design.html).
//
// Mission names are real (Artemis / Moon-to-Mars program); status,
// readiness, and confidence values are invented for design purposes
// and are NOT factual claims.

import type {
  Capability,
  CapabilityGroup,
  Confidence,
  ConfidenceMeta,
  Milestone,
  Status,
  StatusMeta,
  TrackspaceEvent,
} from "./types";

export const STATUS: Record<Status, StatusMeta> = {
  ready: {
    id: "ready",
    label: "Ready",
    glyph: "▲",
    desc: "Capability demonstrated and operational.",
  },
  watch: {
    id: "watch",
    label: "Watch",
    glyph: "◆",
    desc: "On track but carrying risk or open work.",
  },
  blocker: {
    id: "blocker",
    label: "Blocker",
    glyph: "■",
    desc: "A hard dependency is unmet; downstream items wait.",
  },
  unknown: {
    id: "unknown",
    label: "Unknown",
    glyph: "○",
    desc: "Insufficient public evidence to assess.",
  },
};

export const CONFIDENCE: Record<Confidence, ConfidenceMeta> = {
  confirmed: {
    id: "confirmed",
    label: "Confirmed",
    rank: 5,
    desc: "Official source, on the record.",
  },
  reported: {
    id: "reported",
    label: "Reported",
    rank: 4,
    desc: "Credible reporting; not yet official.",
  },
  inferred: {
    id: "inferred",
    label: "Inferred",
    rank: 3,
    desc: "Derived from adjacent public data.",
  },
  conceptual: {
    id: "conceptual",
    label: "Conceptual",
    rank: 2,
    desc: "Planned / on paper; no hardware yet.",
  },
  unverified: {
    id: "unverified",
    label: "Unverified",
    rank: 1,
    desc: "Single weak source or rumor.",
  },
};

export const STATUS_LIST: Status[] = ["ready", "watch", "blocker", "unknown"];

export const CONFIDENCE_LIST: Confidence[] = [
  "confirmed",
  "reported",
  "inferred",
  "conceptual",
  "unverified",
];

export const CAPABILITY_GROUPS: CapabilityGroup[] = [
  "launch",
  "crew",
  "landing",
  "logistics",
  "surface",
  "comms",
];

export const CAPABILITIES: Capability[] = [
  {
    id: "sls",
    name: "SLS Block 1",
    short: "SLS",
    group: "launch",
    status: "ready",
    conf: "confirmed",
    readiness: 96,
    blurb:
      "Super heavy-lift launch vehicle. Flew Artemis I to TLI; Block 1 human-rated for early Artemis crews.",
    deps: [],
    milestone: "a1",
  },
  {
    id: "orion",
    name: "Orion Crew Vehicle",
    short: "Orion",
    group: "crew",
    status: "watch",
    conf: "reported",
    readiness: 78,
    blurb:
      "Crew module for cislunar flight. Heat-shield char loss under review is the pacing item for Artemis II crew certification.",
    deps: ["sls"],
    milestone: "a2",
  },
  {
    id: "esm",
    name: "European Service Module",
    short: "ESM",
    group: "crew",
    status: "ready",
    conf: "confirmed",
    readiness: 90,
    blurb:
      "Provides Orion propulsion, power and life-support consumables. Built by ESA/Airbus.",
    deps: [],
    milestone: "a2",
  },
  {
    id: "hls",
    name: "Human Landing System",
    short: "HLS",
    group: "landing",
    status: "blocker",
    conf: "reported",
    readiness: 41,
    blurb:
      "Crewed lander (Starship HLS) for Artemis III surface access. Gated by orbital propellant transfer and an uncrewed demo.",
    deps: ["cryo", "sls"],
    milestone: "a3",
  },
  {
    id: "cryo",
    name: "Cryo Propellant Transfer",
    short: "Cryo",
    group: "logistics",
    status: "blocker",
    conf: "inferred",
    readiness: 33,
    blurb:
      "Orbital ship-to-ship cryogenic transfer at scale. No full-scale demonstration on record; long-pole for HLS.",
    deps: [],
    milestone: "a3",
  },
  {
    id: "suit",
    name: "AxEMU Surface Suit",
    short: "Suit",
    group: "crew",
    status: "watch",
    conf: "reported",
    readiness: 64,
    blurb:
      "Next-gen extravehicular suit for the lunar south pole. Thermal & dust-tolerance qualification ongoing.",
    deps: [],
    milestone: "a3",
  },
  {
    id: "gateway",
    name: "Lunar Gateway",
    short: "GTWY",
    group: "logistics",
    status: "watch",
    conf: "reported",
    readiness: 58,
    blurb:
      "Cislunar station (PPE + HALO) as staging point for sustained operations. Co-manifest launch in integration.",
    deps: ["sls"],
    milestone: "gw",
  },
  {
    id: "ltv",
    name: "Lunar Terrain Vehicle",
    short: "LTV",
    group: "surface",
    status: "watch",
    conf: "reported",
    readiness: 52,
    blurb:
      "Unpressurized crew rover for south-pole mobility. Three vendor designs in preliminary development.",
    deps: ["suit"],
    milestone: "base",
  },
  {
    id: "comms",
    name: "LunaNet Comms / PNT",
    short: "Comms",
    group: "comms",
    status: "watch",
    conf: "inferred",
    readiness: 47,
    blurb:
      "Relay + position/navigation/timing architecture for surface and cislunar assets. Early relay nodes only.",
    deps: ["gateway"],
    milestone: "base",
  },
  {
    id: "power",
    name: "Fission Surface Power",
    short: "FSP",
    group: "surface",
    status: "unknown",
    conf: "conceptual",
    readiness: 22,
    blurb:
      "~40 kW class surface reactor for sustained night survival. Design contracts let; no flight unit.",
    deps: [],
    milestone: "base",
  },
  {
    id: "isru",
    name: "ISRU / Regolith Processing",
    short: "ISRU",
    group: "surface",
    status: "unknown",
    conf: "conceptual",
    readiness: 14,
    blurb:
      "Extracting oxygen, water and metals from regolith to reduce resupply. Lab-scale only.",
    deps: ["power"],
    milestone: "base",
  },
  {
    id: "hab",
    name: "Surface Habitat",
    short: "Hab",
    group: "surface",
    status: "unknown",
    conf: "conceptual",
    readiness: 9,
    blurb:
      "Pressurized long-duration shelter for the lunar surface. Requirements phase; no contracted flight hardware.",
    deps: ["power", "comms"],
    milestone: "base",
  },
];

export const MILESTONES: Milestone[] = [
  {
    id: "a1",
    code: "ARTEMIS I",
    name: "Uncrewed Flight Test",
    date: "2022-12",
    dateConf: "confirmed",
    status: "ready",
    objective:
      "Validate SLS + Orion on a high-energy cislunar trajectory and re-entry, uncrewed.",
    caps: ["sls", "orion"],
    critical: false,
    summary:
      "Splashdown achieved after a 25.5-day flight. Core systems validated; established the baseline for crewed flight.",
  },
  {
    id: "a2",
    code: "ARTEMIS II",
    name: "Crewed Lunar Flyby",
    date: "2026-Q2",
    dateConf: "reported",
    status: "watch",
    objective:
      "First crewed flight: four astronauts on a free-return lunar flyby to certify life support.",
    caps: ["sls", "orion", "esm"],
    critical: true,
    summary:
      "Pacing item is Orion heat-shield certification following Artemis I char-loss findings. Crew assigned; training underway.",
  },
  {
    id: "a3",
    code: "ARTEMIS III",
    name: "Crewed South-Pole Landing",
    date: "2027-Q4",
    dateConf: "inferred",
    status: "blocker",
    objective:
      "Return crew to the surface at the lunar south pole using HLS; first AxEMU surface EVAs.",
    caps: ["hls", "cryo", "suit", "orion"],
    critical: true,
    summary:
      "Schedule is gated by HLS readiness — specifically an uncrewed demo landing and orbital cryo propellant transfer.",
  },
  {
    id: "gw",
    code: "GATEWAY",
    name: "Cislunar Staging Station",
    date: "2028+",
    dateConf: "conceptual",
    status: "watch",
    objective:
      "Establish a crew-tended station in near-rectilinear halo orbit as a staging and aggregation point.",
    caps: ["gateway", "comms"],
    critical: false,
    summary:
      "PPE and HALO in integration. Enables longer surface stays and international/commercial logistics.",
  },
  {
    id: "base",
    code: "PHASE · BASE",
    name: "Sustained Surface Presence",
    date: "2030s",
    dateConf: "conceptual",
    status: "unknown",
    objective:
      "Stand up power, mobility, comms and habitation for recurring multi-week crewed surface campaigns.",
    caps: ["ltv", "comms", "power", "isru", "hab"],
    critical: true,
    summary:
      "The long horizon. Almost entirely conceptual hardware today — power and habitation are the deepest unknowns.",
  },
];

export const EVENTS: TrackspaceEvent[] = [
  {
    id: "e1",
    date: "2022-12-11",
    title: "Artemis I splashes down",
    status: "ready",
    conf: "confirmed",
    impact: "high",
    future: false,
    caps: ["sls", "orion"],
    what: "Orion returned from a 25.5-day uncrewed cislunar mission with a successful Pacific splashdown.",
    confirmed: [
      "Flight completed",
      "Re-entry & recovery nominal",
      "SLS Block 1 performance within margins",
    ],
    unknown: ["Full heat-shield material behavior (later flagged for review)"],
    downstream: "Cleared the path to crewed flight; baseline for Artemis II.",
  },
  {
    id: "e2",
    date: "2024-12-05",
    title: "Orion heat-shield findings released",
    status: "watch",
    conf: "confirmed",
    impact: "high",
    future: false,
    caps: ["orion"],
    what: "Independent review attributed Artemis I char loss to trapped gases; a revised re-entry profile was adopted rather than a redesign.",
    confirmed: ["Root cause identified", "Re-entry trajectory change adopted"],
    unknown: [
      "Margin under all crewed return cases",
      "Knock-on effect to Artemis II date",
    ],
    downstream: "Directly affects Artemis II crew certification timing.",
  },
  {
    id: "e3",
    date: "2025-08-14",
    title: "AxEMU thermal-vacuum test campaign",
    status: "watch",
    conf: "reported",
    impact: "med",
    future: false,
    caps: ["suit"],
    what: "Surface-suit prototype entered an extended thermal-vacuum campaign simulating south-pole shadowed terrain.",
    confirmed: ["Test campaign started"],
    unknown: [
      "Dust-seal life",
      "Glove dexterity at temperature",
      "Final qualification date",
    ],
    downstream: "Suit readiness is a gate for Artemis III surface EVAs.",
  },
  {
    id: "e4",
    date: "2026-01-22",
    title: "HLS uncrewed demo slips right",
    status: "blocker",
    conf: "reported",
    impact: "high",
    future: false,
    caps: ["hls", "cryo"],
    what: "Reporting indicates the uncrewed HLS demonstration landing moved later, pending propellant-transfer milestones.",
    confirmed: ["Schedule pressure acknowledged"],
    unknown: [
      "New demo date",
      "Number of tanker flights required",
      "Boil-off performance",
    ],
    downstream: "Pushes risk onto the Artemis III landing date.",
  },
  {
    id: "e5",
    date: "2026-Q2",
    title: "Artemis II crewed flyby",
    status: "watch",
    conf: "reported",
    impact: "high",
    future: true,
    caps: ["sls", "orion", "esm"],
    what: "Planned first crewed Artemis flight — a four-person free-return flyby of the Moon.",
    confirmed: ["Crew assigned", "Hardware in stacking flow"],
    unknown: ["Firm launch date pending heat-shield certification close-out"],
    downstream: "Certifies Orion life support for Artemis III.",
  },
  {
    id: "e6",
    date: "2026-Q4",
    title: "Orbital cryo transfer demo (target)",
    status: "blocker",
    conf: "inferred",
    impact: "high",
    future: true,
    caps: ["cryo"],
    what: "Targeted demonstration of large-scale ship-to-ship cryogenic propellant transfer in orbit.",
    confirmed: [],
    unknown: [
      "Whether a full-scale transfer is attempted",
      "Boil-off & quantity-gauging results",
    ],
    downstream: "The single biggest unlock for the HLS lander.",
  },
  {
    id: "e7",
    date: "2027-Q4",
    title: "Artemis III landing (target)",
    status: "blocker",
    conf: "inferred",
    impact: "high",
    future: true,
    caps: ["hls", "suit", "orion", "cryo"],
    what: "Planned crewed return to the lunar surface at the south pole.",
    confirmed: [],
    unknown: [
      "Date highly sensitive to HLS & cryo progress",
      "Landing site final selection",
    ],
    downstream: "First sustained-presence surface objectives begin after this.",
  },
  {
    id: "e8",
    date: "2028+",
    title: "Gateway co-manifest launch (target)",
    status: "watch",
    conf: "conceptual",
    impact: "med",
    future: true,
    caps: ["gateway", "comms"],
    what: "Planned launch of the integrated Power & Propulsion Element with the HALO habitat module.",
    confirmed: [],
    unknown: ["Integrated launch date", "Logistics resupply cadence"],
    downstream:
      "Enables longer crewed stays and aggregation for surface campaigns.",
  },
];
