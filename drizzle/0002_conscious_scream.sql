CREATE TABLE `collaborators` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`member_id` text NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_collaborators_document` ON `collaborators` (`document_id`,`member_id`);--> statement-breakpoint
CREATE TABLE `comments` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`actor` text NOT NULL,
	`content` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_comments_document` ON `comments` (`document_id`);--> statement-breakpoint
CREATE TABLE `imports` (
	`id` text PRIMARY KEY NOT NULL,
	`fingerprint` text NOT NULL,
	`result` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `members` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`role` text DEFAULT 'teacher' NOT NULL,
	`state` text DEFAULT 'pending' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `documents` ADD `library` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `documents` ADD `library_fields` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `documents` ADD `owner_id` text;--> statement-breakpoint
ALTER TABLE `documents` ADD `submitted_at` text DEFAULT '' NOT NULL;