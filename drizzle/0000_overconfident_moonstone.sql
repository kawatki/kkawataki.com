CREATE TABLE `rate_limit_counters` (
	`count` integer DEFAULT 0 NOT NULL,
	`expires_at` integer NOT NULL,
	`key` text NOT NULL,
	`window_start` integer NOT NULL,
	PRIMARY KEY(`key`, `window_start`)
);
