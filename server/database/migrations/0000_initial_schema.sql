CREATE TABLE `app_state` (
	`id` integer PRIMARY KEY NOT NULL,
	`phase` text DEFAULT 'open' NOT NULL,
	`locked_at` integer,
	CONSTRAINT "app_state_singleton" CHECK("app_state"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE `guesses` (
	`guesser_id` integer NOT NULL,
	`room_user_id` integer NOT NULL,
	`guessed_user_id` integer NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`guesser_id`, `room_user_id`),
	FOREIGN KEY (`guesser_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`room_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`guessed_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "guesses_not_own_room" CHECK("guesses"."guesser_id" <> "guesses"."room_user_id"),
	CONSTRAINT "guesses_not_self" CHECK("guesses"."guessed_user_id" <> "guesses"."guesser_id")
);
--> statement-breakpoint
CREATE INDEX `guesses_room_idx` ON `guesses` (`room_user_id`);--> statement-breakpoint
CREATE TABLE `identities` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`provider` text NOT NULL,
	`subject` text NOT NULL,
	`secret_hash` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `identities_provider_subject_unique` ON `identities` (`provider`,`subject`);--> statement-breakpoint
CREATE INDEX `identities_user_idx` ON `identities` (`user_id`);--> statement-breakpoint
CREATE TABLE `photos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`filename` text NOT NULL,
	`position` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `photos_user_position_idx` ON `photos` (`user_id`,`position`);--> statement-breakpoint
CREATE UNIQUE INDEX `photos_filename_unique` ON `photos` (`filename`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`display_name` text NOT NULL,
	`is_admin` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_display_name_ci_unique` ON `users` (lower("display_name"));