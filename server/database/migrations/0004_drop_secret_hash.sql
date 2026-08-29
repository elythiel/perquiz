CREATE INDEX `guesses_guessed_idx` ON `guesses` (`guessed_user_id`);--> statement-breakpoint
ALTER TABLE `identities` DROP COLUMN `secret_hash`;