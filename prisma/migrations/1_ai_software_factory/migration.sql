-- TECH360 — AI Software Factory, Media Studio, Feed Hub and Call/SMS centre.
-- Added models: GeneratedApp, GeneratedAppFile, GeneratedAppEvent,
--               MediaJob, MediaShot, FeedSource, FeedItem, CallLog.
-- All new tables are intentionally self-contained (no foreign keys): client
-- identifiers must survive the source handover and outlive any single record.

-- CreateTable
CREATE TABLE `GeneratedApp` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NULL,
    `projectId` VARCHAR(191) NULL,
    `vertical` VARCHAR(191) NOT NULL DEFAULT 'crm',
    `brief` LONGTEXT NOT NULL,
    `plan` LONGTEXT NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
    `stage` VARCHAR(191) NOT NULL DEFAULT 'BRIEF',
    `fileCount` INTEGER NOT NULL DEFAULT 0,
    `totalBytes` INTEGER NOT NULL DEFAULT 0,
    `createdBy` VARCHAR(191) NULL,
    `deliveredAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `GeneratedApp_code_key`(`code`),
    INDEX `GeneratedApp_status_idx`(`status`),
    INDEX `GeneratedApp_vertical_idx`(`vertical`),
    INDEX `GeneratedApp_clientId_idx`(`clientId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GeneratedAppFile` (
    `id` VARCHAR(191) NOT NULL,
    `appId` VARCHAR(191) NOT NULL,
    `path` VARCHAR(191) NOT NULL,
    `language` VARCHAR(191) NOT NULL DEFAULT 'text',
    `bytes` INTEGER NOT NULL DEFAULT 0,
    `content` LONGTEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `GeneratedAppFile_appId_path_key`(`appId`, `path`),
    INDEX `GeneratedAppFile_appId_idx`(`appId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GeneratedAppEvent` (
    `id` VARCHAR(191) NOT NULL,
    `appId` VARCHAR(191) NOT NULL,
    `stage` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `note` TEXT NULL,
    `actor` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `GeneratedAppEvent_appId_idx`(`appId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MediaJob` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL DEFAULT 'VIDEO',
    `language` VARCHAR(191) NOT NULL DEFAULT 'EN',
    `aspect` VARCHAR(191) NOT NULL DEFAULT '16:9',
    `durationSec` INTEGER NOT NULL DEFAULT 60,
    `script` LONGTEXT NOT NULL,
    `plan` LONGTEXT NOT NULL,
    `captions` LONGTEXT NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
    `renderState` VARCHAR(191) NOT NULL DEFAULT 'RENDER_NOT_CONFIGURED',
    `voiceState` VARCHAR(191) NOT NULL DEFAULT 'NOT_CONFIGURED',
    `provider` VARCHAR(191) NULL,
    `clientId` VARCHAR(191) NULL,
    `projectId` VARCHAR(191) NULL,
    `createdBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `MediaJob_code_key`(`code`),
    INDEX `MediaJob_status_idx`(`status`),
    INDEX `MediaJob_kind_idx`(`kind`),
    INDEX `MediaJob_clientId_idx`(`clientId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MediaShot` (
    `id` VARCHAR(191) NOT NULL,
    `jobId` VARCHAR(191) NOT NULL,
    `seq` INTEGER NOT NULL,
    `startSec` INTEGER NOT NULL,
    `endSec` INTEGER NOT NULL,
    `kind` VARCHAR(191) NOT NULL DEFAULT 'B_ROLL',
    `visual` TEXT NOT NULL,
    `narration` TEXT NOT NULL,
    `overlay` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `MediaShot_jobId_idx`(`jobId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FeedSource` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `url` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL DEFAULT 'RSS',
    `category` VARCHAR(191) NOT NULL DEFAULT 'INDUSTRY',
    `status` VARCHAR(191) NOT NULL DEFAULT 'IDLE',
    `lastFetchedAt` DATETIME(3) NULL,
    `lastError` TEXT NULL,
    `itemCount` INTEGER NOT NULL DEFAULT 0,
    `autoIdea` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `FeedSource_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FeedItem` (
    `id` VARCHAR(191) NOT NULL,
    `sourceId` VARCHAR(191) NOT NULL,
    `guid` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `link` VARCHAR(191) NOT NULL,
    `summary` LONGTEXT NULL,
    `publishedAt` DATETIME(3) NULL,
    `tags` TEXT NOT NULL,
    `ideaAssetId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `FeedItem_sourceId_guid_key`(`sourceId`, `guid`),
    INDEX `FeedItem_sourceId_idx`(`sourceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CallLog` (
    `id` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NULL,
    `leadId` VARCHAR(191) NULL,
    `direction` VARCHAR(191) NOT NULL DEFAULT 'OUTBOUND',
    `number` VARCHAR(191) NOT NULL,
    `channel` VARCHAR(191) NOT NULL DEFAULT 'CLICK_TO_CALL',
    `provider` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'LOGGED',
    `outcome` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `durationSec` INTEGER NOT NULL DEFAULT 0,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `endedAt` DATETIME(3) NULL,
    `createdBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CallLog_clientId_idx`(`clientId`),
    INDEX `CallLog_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
