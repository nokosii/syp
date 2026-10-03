CREATE TABLE `governance_events` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`action` text NOT NULL,
	`actor` text NOT NULL,
	`reason` text NOT NULL,
	`snapshot` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_governance_document` ON `governance_events` (`document_id`);--> statement-breakpoint
ALTER TABLE `documents` ADD `access_level` text DEFAULT 'editor' NOT NULL;--> statement-breakpoint
ALTER TABLE `documents` ADD `ai_allowed` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `documents` ADD `review_state` text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `documents` ADD `community` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `documents` ADD `cultural_context` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `documents` ADD `review_note` text DEFAULT '' NOT NULL;