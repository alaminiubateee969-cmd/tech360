-- TECH360 — Marketing Dashboard: social accounts + post queue.
-- Added models: SocialAccount, SocialPost.
-- Secrets are NEVER stored in these tables: SocialAccount records only
-- which host env vars a connection uses (names), verification state and
-- the last error. SocialPost stores drafts and provider-confirmed
-- results (external post id/URL) for the approve-first publishing flow.

-- CreateTable
CREATE TABLE `SocialAccount` (
    `id` VARCHAR(191) NOT NULL,
    `platform` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NULL,
    `externalId` VARCHAR(191) NULL,
    `state` VARCHAR(191) NOT NULL DEFAULT 'NOT_CONFIGURED',
    `envKeys` TEXT NOT NULL,
    `lastVerifiedAt` DATETIME(3) NULL,
    `lastError` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SocialAccount_platform_key`(`platform`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SocialPost` (
    `id` VARCHAR(191) NOT NULL,
    `campaignId` VARCHAR(191) NULL,
    `assetId` VARCHAR(191) NULL,
    `platform` VARCHAR(191) NOT NULL,
    `text` LONGTEXT NOT NULL,
    `hashtags` TEXT NULL,
    `mediaUrl` TEXT NULL,
    `mediaPrompt` TEXT NULL,
    `cta` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
    `externalId` VARCHAR(191) NULL,
    `externalUrl` TEXT NULL,
    `error` TEXT NULL,
    `scheduledAt` DATETIME(3) NULL,
    `publishedAt` DATETIME(3) NULL,
    `createdBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `SocialPost_platform_idx`(`platform`),
    INDEX `SocialPost_status_idx`(`status`),
    INDEX `SocialPost_campaignId_idx`(`campaignId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
