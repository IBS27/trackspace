CREATE TABLE `capabilities` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`short` text NOT NULL,
	`capability_group` text NOT NULL,
	`status` text NOT NULL,
	`conf` text NOT NULL,
	`readiness` integer NOT NULL,
	`blurb` text NOT NULL,
	`milestone` text NOT NULL,
	`deps` text NOT NULL,
	`last_verified` text NOT NULL,
	CONSTRAINT "capabilities_status_ck" CHECK("capabilities"."status" in ('ready', 'watch', 'blocker', 'unknown')),
	CONSTRAINT "capabilities_conf_ck" CHECK("capabilities"."conf" in ('confirmed', 'reported', 'inferred', 'conceptual', 'unverified')),
	CONSTRAINT "capabilities_group_ck" CHECK("capabilities"."capability_group" in ('launch', 'crew', 'landing', 'logistics', 'surface', 'comms')),
	CONSTRAINT "capabilities_readiness_ck" CHECK("capabilities"."readiness" between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`title` text NOT NULL,
	`status` text NOT NULL,
	`conf` text NOT NULL,
	`impact` text NOT NULL,
	`future` integer NOT NULL,
	`caps` text NOT NULL,
	`what` text NOT NULL,
	`confirmed` text NOT NULL,
	`unknown` text NOT NULL,
	`downstream` text NOT NULL,
	`last_verified` text NOT NULL,
	CONSTRAINT "events_status_ck" CHECK("events"."status" in ('ready', 'watch', 'blocker', 'unknown')),
	CONSTRAINT "events_conf_ck" CHECK("events"."conf" in ('confirmed', 'reported', 'inferred', 'conceptual', 'unverified')),
	CONSTRAINT "events_impact_ck" CHECK("events"."impact" in ('high', 'med', 'low'))
);
--> statement-breakpoint
CREATE TABLE `milestones` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`date` text NOT NULL,
	`date_conf` text NOT NULL,
	`status` text NOT NULL,
	`objective` text NOT NULL,
	`summary` text NOT NULL,
	`critical` integer NOT NULL,
	`caps` text NOT NULL,
	`last_verified` text NOT NULL,
	CONSTRAINT "milestones_status_ck" CHECK("milestones"."status" in ('ready', 'watch', 'blocker', 'unknown')),
	CONSTRAINT "milestones_date_conf_ck" CHECK("milestones"."date_conf" in ('confirmed', 'reported', 'inferred', 'conceptual', 'unverified'))
);
--> statement-breakpoint
CREATE TABLE `sources` (
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
	CONSTRAINT "sources_tier_ck" CHECK("sources"."tier" between 1 and 4),
	CONSTRAINT "sources_entity_type_ck" CHECK("sources"."entity_type" in ('capability', 'milestone', 'event'))
);
--> statement-breakpoint
CREATE INDEX `sources_entity_idx` ON `sources` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `sources_entity_position_unq` ON `sources` (`entity_type`,`entity_id`,`position`);--> statement-breakpoint
CREATE TABLE `discoveries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`url` text NOT NULL,
	`title` text NOT NULL,
	`source` text NOT NULL,
	`published_at` text,
	`found_at` text NOT NULL,
	`status` text NOT NULL,
	`note` text,
	CONSTRAINT "discoveries_status_ck" CHECK("discoveries"."status" in ('new', 'reviewed', 'dismissed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `discoveries_url_unique` ON `discoveries` (`url`);--> statement-breakpoint
CREATE TABLE `ingestion_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`started_at` text NOT NULL,
	`finished_at` text,
	`ok` integer NOT NULL,
	`summary` text NOT NULL
);
