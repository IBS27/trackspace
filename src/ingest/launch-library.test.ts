// @vitest-environment node

import { describe, expect, it } from "vitest";

import { hasFlown, normalizeLaunch, succeeded } from "./launch-library";

// Shaped like a real Launch Library 2 launch object (trimmed).
const RAW_ARTEMIS_II = {
  id: "41699701-2ef4-4b0c-ac9d-6757820cde87",
  name: "SLS Block 1 | Artemis II",
  net: "2026-04-01T22:35:12Z",
  net_precision: { name: "Second" },
  status: { name: "Launch Successful", abbrev: "Success" },
  last_updated: "2026-04-02T06:17:44Z",
  launch_service_provider: { name: "National Aeronautics and Space Administration" },
  mission: { name: "Artemis II" },
  url: "https://ll.thespacedevs.com/2.2.0/launch/41699701/",
};

describe("normalizeLaunch", () => {
  it("flattens the nested LL2 shape", () => {
    const launch = normalizeLaunch(RAW_ARTEMIS_II);
    expect(launch).not.toBeNull();
    expect(launch).toMatchObject({
      id: "41699701-2ef4-4b0c-ac9d-6757820cde87",
      missionName: "Artemis II",
      net: "2026-04-01T22:35:12Z",
      netPrecision: "Second",
      statusName: "Launch Successful",
      statusAbbrev: "Success",
      provider: "National Aeronautics and Space Administration",
    });
  });

  it("returns null without an id", () => {
    expect(normalizeLaunch({ name: "no id" })).toBeNull();
  });

  it("tolerates missing nested fields", () => {
    const launch = normalizeLaunch({ id: "x", name: "Bare" });
    expect(launch).toMatchObject({
      id: "x",
      missionName: null,
      statusAbbrev: null,
      provider: null,
    });
  });
});

describe("flight-status helpers", () => {
  const success = normalizeLaunch(RAW_ARTEMIS_II)!;
  const upcoming = normalizeLaunch({
    id: "y",
    name: "SLS Block 1 | Artemis III",
    status: { name: "To Be Determined", abbrev: "TBD" },
  })!;

  it("detects a completed, successful flight", () => {
    expect(hasFlown(success)).toBe(true);
    expect(succeeded(success)).toBe(true);
  });

  it("treats an undetermined launch as not yet flown", () => {
    expect(hasFlown(upcoming)).toBe(false);
    expect(succeeded(upcoming)).toBe(false);
  });
});
