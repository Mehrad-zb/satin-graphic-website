CREATE TABLE `business_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`data` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `site_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `site_visitors` (
	`id` text PRIMARY KEY NOT NULL,
	`path` text NOT NULL,
	`country` text NOT NULL,
	`city` text NOT NULL,
	`last_seen` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_visitors_last_seen` ON `site_visitors` (`last_seen`);