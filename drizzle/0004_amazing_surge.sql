CREATE TABLE `checkout_drafts` (
	`session_id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`revision` integer NOT NULL,
	`updated_at` text NOT NULL
);
