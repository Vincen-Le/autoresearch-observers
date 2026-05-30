CREATE TABLE `harness_firings` (
	`id` text PRIMARY KEY NOT NULL,
	`observed_run_id` text NOT NULL,
	`subagent_span_id` text,
	`subagent_label` text,
	`pattern` text NOT NULL,
	`scope` text NOT NULL,
	`fingerprint` text NOT NULL,
	`summary` text,
	`evidence` text,
	`outcome` text NOT NULL,
	`outcome_reason` text,
	`observer_run_id` text,
	`steering_event_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_harness_observed` ON `harness_firings` (`observed_run_id`,"created_at" desc);--> statement-breakpoint
CREATE INDEX `idx_harness_outcome` ON `harness_firings` (`outcome`);--> statement-breakpoint
CREATE INDEX `idx_harness_observer` ON `harness_firings` (`observer_run_id`) WHERE "harness_firings"."observer_run_id" IS NOT NULL;
