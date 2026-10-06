CREATE TABLE `service_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`service` text NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text NOT NULL,
	`preferred_date` text NOT NULL,
	`preferred_time` text NOT NULL,
	`details` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`consent_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_service_requests_email_created` ON `service_requests` (`email`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_service_requests_status_date` ON `service_requests` (`status`,`preferred_date`);