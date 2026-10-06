CREATE TABLE `customers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text NOT NULL,
	`business` text NOT NULL,
	`address` text NOT NULL,
	`notes` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_customers_email` ON `customers` (`email`);--> statement-breakpoint
CREATE TABLE `invoice_access` (
	`document_id` text PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	`token_hash` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `invoice_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`amount` integer NOT NULL,
	`method` text NOT NULL,
	`reference` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_invoice_payments_document` ON `invoice_payments` (`document_id`);