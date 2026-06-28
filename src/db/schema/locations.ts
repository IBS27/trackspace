import { sql } from "drizzle-orm";
import { check, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

import type {
  CapabilityId,
  Confidence,
  LocationKind,
  MilestoneId,
  SpatialBody,
  Status,
} from "@/features/trackspace/data/types";

// Locations — launch pads, test stands, lunar surface regions, and orbit
// context. Relations stay as JSON arrays for the small read-mostly MVP.
export const locations = sqliteTable(
  "locations",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    body: text("body").notNull().$type<SpatialBody>(),
    kind: text("kind").notNull().$type<LocationKind>(),
    lat: real("lat"),
    lon: real("lon"),
    radiusKm: real("radius_km"),
    status: text("status").notNull().$type<Status>(),
    conf: text("conf").notNull().$type<Confidence>(),
    summary: text("summary").notNull(),
    relatedCapabilities: text("related_capabilities", { mode: "json" })
      .notNull()
      .$type<CapabilityId[]>(),
    relatedEvents: text("related_events", { mode: "json" })
      .notNull()
      .$type<string[]>(),
    relatedMilestones: text("related_milestones", { mode: "json" })
      .notNull()
      .$type<MilestoneId[]>(),
    lastVerified: text("last_verified").notNull(),
  },
  (t) => [
    check("locations_body_ck", sql`${t.body} in ('earth', 'moon', 'cislunar')`),
    check(
      "locations_kind_ck",
      sql`${t.kind} in ('launch-site', 'test-site', 'contractor-site', 'landing-region', 'surface-site', 'orbit')`,
    ),
    check("locations_status_ck", sql`${t.status} in ('ready', 'watch', 'blocker', 'unknown')`),
    check(
      "locations_conf_ck",
      sql`${t.conf} in ('confirmed', 'reported', 'inferred', 'conceptual', 'unverified')`,
    ),
    check("locations_lat_ck", sql`${t.lat} is null or ${t.lat} between -90 and 90`),
    check(
      "locations_lon_ck",
      sql`${t.lon} is null or ${t.lon} between -180 and 180`,
    ),
    check("locations_radius_ck", sql`${t.radiusKm} is null or ${t.radiusKm} > 0`),
  ],
);
