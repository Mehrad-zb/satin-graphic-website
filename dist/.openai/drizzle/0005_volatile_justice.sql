CREATE TABLE `checkout_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`draft_revision` integer NOT NULL,
	`provider` text NOT NULL,
	`provider_order_id` text,
	`payment_url` text,
	`status` text NOT NULL,
	`snapshot` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_checkout_orders_session` ON `checkout_orders` (`session_id`);