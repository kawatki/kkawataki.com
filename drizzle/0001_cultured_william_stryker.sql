CREATE TABLE `booking_cancellations` (
	`reference` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`event_id` text NOT NULL,
	`email_hash` text NOT NULL,
	`slot_start` text NOT NULL,
	`requested_at` integer NOT NULL,
	`amount_paid` integer NOT NULL,
	`refund_percent` integer NOT NULL,
	`refund_amount` integer NOT NULL,
	`payment_intent` text NOT NULL,
	`refund_id` text,
	`refund_status` text DEFAULT 'not_started' NOT NULL,
	`calendar_released` integer DEFAULT 0 NOT NULL,
	`lock_token` text,
	`locked_until` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `booking_cancellations_session_id_unique` ON `booking_cancellations` (`session_id`);