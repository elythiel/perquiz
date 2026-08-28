PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_app_state` (
	`id` integer PRIMARY KEY NOT NULL,
	`phase` text DEFAULT 'preparation' NOT NULL,
	`locked_at` integer,
	`reveal_seed` text,
	CONSTRAINT "app_state_singleton" CHECK("__new_app_state"."id" = 1)
);
--> statement-breakpoint
INSERT INTO `__new_app_state`("id", "phase", "locked_at", "reveal_seed") SELECT "id", "phase", "locked_at", "reveal_seed" FROM `app_state`;--> statement-breakpoint
DROP TABLE `app_state`;--> statement-breakpoint
ALTER TABLE `__new_app_state` RENAME TO `app_state`;--> statement-breakpoint
PRAGMA foreign_keys=ON;