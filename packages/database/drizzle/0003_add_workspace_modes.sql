CREATE TABLE `workspace_modes` (
	`id` text PRIMARY KEY NOT NULL,
	`mode_id` text NOT NULL,
	`name` text NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`color` text,
	`model` text,
	`prompt` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`workspace_id` text NOT NULL REFERENCES `workspaces`(`id`) ON DELETE cascade,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_modes_workspace_mode` ON `workspace_modes` (`workspace_id`, `mode_id`);
--> statement-breakpoint
CREATE INDEX `idx_modes_workspace` ON `workspace_modes` (`workspace_id`);
