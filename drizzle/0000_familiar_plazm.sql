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
	`last_verified` text NOT NULL
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
	`last_verified` text NOT NULL
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
	`last_verified` text NOT NULL
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
	`ico` text
);
--> statement-breakpoint
CREATE INDEX `sources_entity_idx` ON `sources` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE TABLE `discoveries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`url` text NOT NULL,
	`title` text NOT NULL,
	`source` text NOT NULL,
	`published_at` text,
	`found_at` text NOT NULL,
	`status` text NOT NULL,
	`note` text
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
