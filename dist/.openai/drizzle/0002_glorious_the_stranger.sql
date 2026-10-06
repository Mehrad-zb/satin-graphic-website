CREATE TABLE `pricing_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`path` text NOT NULL,
	`config` text NOT NULL,
	`revision` integer NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_pricing_path` ON `pricing_rules` (`path`);--> statement-breakpoint
CREATE TABLE `studio_cart_items` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`design_id` text NOT NULL,
	`design` text NOT NULL,
	`price` text NOT NULL,
	`status` text NOT NULL,
	`order_id` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_studio_cart_session` ON `studio_cart_items` (`session_id`);--> statement-breakpoint
CREATE TABLE `studio_designs` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`design` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `studio_files` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`design_id` text,
	`object_key` text NOT NULL,
	`name` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`role` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_studio_files_session` ON `studio_files` (`session_id`);--> statement-breakpoint
CREATE TABLE `studio_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`day` text NOT NULL,
	`count` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `studio_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`customer` text NOT NULL,
	`totals` text NOT NULL,
	`status` text NOT NULL,
	`admin_notes` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `studio_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL
);
