CREATE TABLE `locations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`body` text NOT NULL,
	`kind` text NOT NULL,
	`lat` real,
	`lon` real,
	`radius_km` real,
	`status` text NOT NULL,
	`conf` text NOT NULL,
	`summary` text NOT NULL,
	`related_capabilities` text NOT NULL,
	`related_events` text NOT NULL,
	`related_milestones` text NOT NULL,
	`last_verified` text NOT NULL,
	CONSTRAINT "locations_body_ck" CHECK("locations"."body" in ('earth', 'moon', 'cislunar')),
	CONSTRAINT "locations_kind_ck" CHECK("locations"."kind" in ('launch-site', 'test-site', 'contractor-site', 'landing-region', 'surface-site', 'orbit')),
	CONSTRAINT "locations_status_ck" CHECK("locations"."status" in ('ready', 'watch', 'blocker', 'unknown')),
	CONSTRAINT "locations_conf_ck" CHECK("locations"."conf" in ('confirmed', 'reported', 'inferred', 'conceptual', 'unverified')),
	CONSTRAINT "locations_lat_ck" CHECK("locations"."lat" is null or "locations"."lat" between -90 and 90),
	CONSTRAINT "locations_lon_ck" CHECK("locations"."lon" is null or "locations"."lon" between -180 and 180),
	CONSTRAINT "locations_radius_ck" CHECK("locations"."radius_km" is null or "locations"."radius_km" > 0)
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_sources` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`position` integer NOT NULL,
	`publisher` text NOT NULL,
	`title` text NOT NULL,
	`url` text NOT NULL,
	`tier` integer NOT NULL,
	`date` text,
	`ico` text,
	CONSTRAINT "sources_tier_ck" CHECK("__new_sources"."tier" between 1 and 4),
	CONSTRAINT "sources_entity_type_ck" CHECK("__new_sources"."entity_type" in ('capability', 'milestone', 'event', 'location'))
);
--> statement-breakpoint
INSERT INTO `__new_sources`("id", "entity_type", "entity_id", "position", "publisher", "title", "url", "tier", "date", "ico") SELECT "id", "entity_type", "entity_id", "position", "publisher", "title", "url", "tier", "date", "ico" FROM `sources`;--> statement-breakpoint
DROP TABLE `sources`;--> statement-breakpoint
ALTER TABLE `__new_sources` RENAME TO `sources`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `sources_entity_idx` ON `sources` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `sources_entity_position_unq` ON `sources` (`entity_type`,`entity_id`,`position`);