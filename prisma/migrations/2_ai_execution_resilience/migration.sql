-- Add execution lifecycle timestamps and safe provider metadata.
ALTER TABLE `AiAgentExecution`
    ADD COLUMN `metadata` TEXT NULL,
    ADD COLUMN `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `completedAt` DATETIME(3) NULL,
    ADD INDEX `AiAgentExecution_createdAt_idx`(`createdAt`),
    ADD INDEX `AiAgentExecution_startedAt_idx`(`startedAt`);

-- Database-backed lease used by the in-process production AI operations driver.
-- The lease expires so a crashed process cannot permanently disable cycles.
CREATE TABLE `AiOpsLock` (
    `id` VARCHAR(191) NOT NULL,
    `owner` VARCHAR(191) NULL,
    `lockedUntil` DATETIME(3) NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AiOpsLock_lockedUntil_idx`(`lockedUntil`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
