CREATE TABLE `model_configs` (
	`id` text PRIMARY KEY NOT NULL,
	`model` text,
	`api_key` text,
	`temperature` real,
	`top_p` real,
	`top_k` integer,
	`max_tokens` integer,
	`max_retries` integer DEFAULT 3,
	`seed` integer,
	`frequency_penalty` real,
	`presence_penalty` real,
	`provider_options` text,
	`workspace_id` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `model_configs_workspace_id_unique` ON `model_configs` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `vision_configs` (
	`id` text PRIMARY KEY NOT NULL,
	`model` text,
	`api_key` text,
	`max_tokens` integer,
	`provider_options` text,
	`workspace_id` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vision_configs_workspace_id_unique` ON `vision_configs` (`workspace_id`);--> statement-breakpoint
DROP INDEX IF EXISTS `idx_embed_workspace`;--> statement-breakpoint
CREATE TABLE `embedding_configs_new` (
	`id` text PRIMARY KEY NOT NULL,
	`model` text,
	`api_key` text,
	`dimension` integer,
	`workspace_id` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
INSERT INTO `embedding_configs_new` (`id`, `model`, `workspace_id`, `created_at`, `updated_at`)
	SELECT `id`, `provider` || '/' || `model`, `workspace_id`, `created_at`, `updated_at` FROM `embedding_configs`;--> statement-breakpoint
DROP TABLE `embedding_configs`;--> statement-breakpoint
ALTER TABLE `embedding_configs_new` RENAME TO `embedding_configs`;--> statement-breakpoint
CREATE UNIQUE INDEX `embedding_configs_workspace_id_unique` ON `embedding_configs` (`workspace_id`);
