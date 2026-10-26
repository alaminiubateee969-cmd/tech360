-- Unified-inbox triage signal (AiPraktor-inspired).
--
-- Reference: aipraktor.com — "the AI agent answers day and night; humans
-- step in when needed". The inbox needs to answer one triage question at
-- a glance: who has the last word in this thread? `unreadCount` says
-- "new, not yet read"; it does NOT say "the visitor is still waiting for
-- a reply" — after an admin opens a thread, unread resets to 0 even when
-- the visitor's message still needs an answer.
--
-- `lastSender` is denormalized exactly like the existing
-- `lastMessageAt` / `lastMessagePreview` fields: every message writer
-- (visitor send, admin reply, system close/reopen notes) updates it in
-- the same transaction path. NULL for brand-new conversations with no
-- messages yet. Existing rows backfill as NULL — honest: unknown until
-- the next message lands.
ALTER TABLE `ChatConversation`
    ADD COLUMN `lastSender` VARCHAR(191) NULL;
