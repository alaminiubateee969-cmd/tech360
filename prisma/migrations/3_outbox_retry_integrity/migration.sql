-- Outbox retry integrity for the Communication table.
--
-- Before this migration a FAILED outbound row carried no attempt count and no
-- backoff deadline, so the operations loop re-selected the same row every cycle
-- for the whole 7-day scan window and re-dispatched it through a code path that
-- INSERTED A NEW ROW. Permanent failures (bad recipient, rejected credentials)
-- were retried as aggressively as transient ones, and the outbox grew instead
-- of draining.
--
-- These columns make the retry policy in src/lib/outbox-retry.ts enforceable in
-- the database: `attempts` is written under an optimistic-concurrency guard so
-- two concurrent dispatchers cannot both send the same message, and
-- `nextRetryAt` is the backoff deadline (NULL = eligible now).
--
-- All columns are added with safe defaults, so existing rows keep working and no
-- data is rewritten or dropped.
ALTER TABLE `Communication`
    ADD COLUMN `attempts` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `lastAttemptAt` DATETIME(3) NULL,
    ADD COLUMN `nextRetryAt` DATETIME(3) NULL,
    ADD INDEX `Communication_status_nextRetryAt_idx`(`status`, `nextRetryAt`);
