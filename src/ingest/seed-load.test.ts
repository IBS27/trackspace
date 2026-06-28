// @vitest-environment node

import { afterEach, describe, expect, it } from "vitest";

import { createDb, type TrackspaceDb } from "@/db";
import { ensureSchema } from "@/db/migrate";
import { CURATED } from "@/features/trackspace/data/selectors";

import { loadDataset } from "./load-dataset";
import { seedCurated } from "./seed-db";

function freshDb(): TrackspaceDb {
  const db = createDb(":memory:");
  ensureSchema(db);
  return db;
}

let open: TrackspaceDb[] = [];
function track(db: TrackspaceDb): TrackspaceDb {
  open.push(db);
  return db;
}
afterEach(() => {
  open = [];
});

describe("seed + load round-trip", () => {
  it("falls back when the default database cannot be opened", () => {
    const original = process.env.DB_FILE_NAME;
    process.env.DB_FILE_NAME = "/definitely/missing/trackspace/local.db";
    try {
      expect(loadDataset()).toBe(CURATED);
    } finally {
      if (original === undefined) delete process.env.DB_FILE_NAME;
      else process.env.DB_FILE_NAME = original;
    }
  });

  it("reconstructs the curated dataset exactly through SQLite", () => {
    const db = track(freshDb());
    const counts = seedCurated(db);

    expect(counts.capabilities).toBe(CURATED.capabilities.length);
    expect(counts.milestones).toBe(CURATED.milestones.length);
    expect(counts.events).toBe(CURATED.events.length);
    expect(counts.locations).toBe(CURATED.locations.length);

    // Every field, every source, in the canonical order.
    expect(loadDataset(db)).toEqual(CURATED);
  });

  it("is idempotent — re-seeding does not duplicate rows or sources", () => {
    const db = track(freshDb());
    const first = seedCurated(db);
    const second = seedCurated(db);

    expect(second).toEqual(first);
    expect(loadDataset(db)).toEqual(CURATED);
  });

  it("falls back to the curated baseline when the database is empty", () => {
    const db = track(freshDb());
    // Same object reference — proves it took the fallback path, not a DB read.
    expect(loadDataset(db)).toBe(CURATED);
  });

  it("round-trips capability metrics through the JSON column", () => {
    const db = track(freshDb());
    seedCurated(db);
    const loaded = loadDataset(db);

    const hls = loaded.capabilities.find((c) => c.id === "hls");
    expect(hls?.metrics?.provider).toBe("SpaceX (Starship HLS)");
    expect(hls?.metrics?.contract).toBe("fixed-price");
    expect(hls?.metrics?.risk).toEqual({ likelihood: "high", severity: "high" });
    // Every capability carries a risk assessment (the Step-3 risk register).
    expect(loaded.capabilities.every((c) => c.metrics?.risk)).toBe(true);
  });

  it("keeps milestones in their canonical order", () => {
    const db = track(freshDb());
    seedCurated(db);
    expect(loadDataset(db).milestones.map((m) => m.id)).toEqual([
      "a1",
      "a2",
      "a3",
      "gw",
      "base",
    ]);
  });
});
