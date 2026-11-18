-- TECH360 — WebChat inbox, CRM link, automation engine and n8n control plane.
-- Additive only. Existing rows keep their data: every new NOT NULL column has a
-- default, and every other new column is NULL. No row is rewritten or deleted.
-- Apply to a disposable database first (`npm run migrations:doctor`); never
-- against production without a backup.

-- AlterTable: tenant isolation key for operators
ALTER TABLE `User`
    ADD COLUMN `tenantId` VARCHAR(191) NOT NULL DEFAULT 'tech360';

-- AlterTable: operator inbox workflow, typing/read markers and AI triage
ALTER TABLE `ChatConversation`
    ADD COLUMN `tenantId` VARCHAR(191) NOT NULL DEFAULT 'tech360',
    ADD COLUMN `inboxState` VARCHAR(191) NOT NULL DEFAULT 'OPEN',
    ADD COLUMN `priority` VARCHAR(191) NOT NULL DEFAULT 'NORMAL',
    ADD COLUMN `team` VARCHAR(191) NULL,
    ADD COLUMN `assignedToId` VARCHAR(191) NULL,
    ADD COLUMN `assignedToEmail` VARCHAR(191) NULL,
    ADD COLUMN `assignedAt` DATETIME(3) NULL,
    ADD COLUMN `escalatedAt` DATETIME(3) NULL,
    ADD COLUMN `escalationReason` TEXT NULL,
    ADD COLUMN `humanRequestedAt` DATETIME(3) NULL,
    ADD COLUMN `resolvedAt` DATETIME(3) NULL,
    ADD COLUMN `resolvedBy` VARCHAR(191) NULL,
    ADD COLUMN `closedAt` DATETIME(3) NULL,
    ADD COLUMN `closedBy` VARCHAR(191) NULL,
    ADD COLUMN `firstResponseAt` DATETIME(3) NULL,
    ADD COLUMN `visitorTypingAt` DATETIME(3) NULL,
    ADD COLUMN `agentTypingAt` DATETIME(3) NULL,
    ADD COLUMN `agentTypingName` VARCHAR(191) NULL,
    ADD COLUMN `visitorReadAt` DATETIME(3) NULL,
    ADD COLUMN `aiLanguage` VARCHAR(191) NULL,
    ADD COLUMN `aiIntent` VARCHAR(191) NULL,
    ADD COLUMN `aiBusinessType` VARCHAR(191) NULL,
    ADD COLUMN `aiSummary` TEXT NULL,
    ADD COLUMN `aiTriagedAt` DATETIME(3) NULL;
CREATE INDEX `ChatConversation_tenantId_inboxState_lastMessageAt_idx`
    ON `ChatConversation`(`tenantId`, `inboxState`, `lastMessageAt`);
CREATE INDEX `ChatConversation_assignedToId_idx` ON `ChatConversation`(`assignedToId`);

-- AlterTable: notes, AI labelling, delivery state and attachments
ALTER TABLE `ChatMessage`
    ADD COLUMN `kind` VARCHAR(191) NOT NULL DEFAULT 'MESSAGE',
    ADD COLUMN `internal` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `aiGenerated` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `deliveryStatus` VARCHAR(191) NOT NULL DEFAULT 'SENT',
    ADD COLUMN `deliveredAt` DATETIME(3) NULL,
    ADD COLUMN `readAt` DATETIME(3) NULL,
    ADD COLUMN `attachmentId` VARCHAR(191) NULL,
    ADD COLUMN `attachmentName` VARCHAR(191) NULL,
    ADD COLUMN `attachmentMime` VARCHAR(191) NULL,
    ADD COLUMN `attachmentSize` INTEGER NULL;

-- AlterTable: n8n workflow registry (control plane; disabled by default)
ALTER TABLE `N8nWorkflow`
    ADD COLUMN `tenantId` VARCHAR(191) NOT NULL DEFAULT 'tech360',
    ADD COLUMN `enabled` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `webhookPath` VARCHAR(191) NULL,
    ADD COLUMN `credentialRefs` TEXT NULL,
    ADD COLUMN `timeoutMs` INTEGER NOT NULL DEFAULT 15000;

-- CreateTable
CREATE TABLE `Tenant` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `settings` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Tenant_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- The default tenant every existing row already belongs to (real company record, not demo data).
INSERT IGNORE INTO `Tenant` (`id`, `slug`, `name`, `status`, `createdAt`, `updatedAt`)
VALUES ('tech360', 'tech360', 'TECH360 LLC', 'ACTIVE', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3));

-- CreateTable
CREATE TABLE `AutomationEvent` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL DEFAULT 'tech360',
    `type` VARCHAR(191) NOT NULL,
    `source` VARCHAR(191) NOT NULL,
    `subjectType` VARCHAR(191) NULL,
    `subjectId` VARCHAR(191) NULL,
    `payload` LONGTEXT NOT NULL,
    `dedupeKey` VARCHAR(191) NOT NULL,
    `correlationId` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `availableAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `processedAt` DATETIME(3) NULL,
    `error` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `AutomationEvent_dedupeKey_key`(`dedupeKey`),
    INDEX `AutomationEvent_tenantId_type_createdAt_idx`(`tenantId`, `type`, `createdAt`),
    INDEX `AutomationEvent_status_availableAt_idx`(`status`, `availableAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AutomationRule` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL DEFAULT 'tech360',
    `key` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `triggerType` VARCHAR(191) NOT NULL,
    `conditions` TEXT NOT NULL,
    `actions` LONGTEXT NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
    `version` INTEGER NOT NULL DEFAULT 1,
    `requiresApproval` BOOLEAN NOT NULL DEFAULT false,
    `maxAttempts` INTEGER NOT NULL DEFAULT 3,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AutomationRule_tenantId_key_key`(`tenantId`, `key`),
    INDEX `AutomationRule_tenantId_triggerType_status_idx`(`tenantId`, `triggerType`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AutomationRuleVersion` (
    `id` VARCHAR(191) NOT NULL,
    `ruleId` VARCHAR(191) NOT NULL,
    `version` INTEGER NOT NULL,
    `snapshot` LONGTEXT NOT NULL,
    `createdBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `AutomationRuleVersion_ruleId_version_key`(`ruleId`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AutomationRun` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL DEFAULT 'tech360',
    `ruleId` VARCHAR(191) NOT NULL,
    `ruleVersion` INTEGER NOT NULL,
    `eventId` VARCHAR(191) NOT NULL,
    `triggerType` VARCHAR(191) NOT NULL,
    `idempotencyKey` VARCHAR(191) NOT NULL,
    `correlationId` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `maxAttempts` INTEGER NOT NULL DEFAULT 3,
    `nextAttemptAt` DATETIME(3) NULL,
    `steps` LONGTEXT NOT NULL,
    `output` TEXT NULL,
    `error` TEXT NULL,
    `approvalId` VARCHAR(191) NULL,
    `approvalHash` VARCHAR(191) NULL,
    `replayOfId` VARCHAR(191) NULL,
    `triggeredBy` VARCHAR(191) NULL,
    `startedAt` DATETIME(3) NULL,
    `finishedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AutomationRun_idempotencyKey_key`(`idempotencyKey`),
    INDEX `AutomationRun_tenantId_status_createdAt_idx`(`tenantId`, `status`, `createdAt`),
    INDEX `AutomationRun_ruleId_idx`(`ruleId`),
    INDEX `AutomationRun_status_nextAttemptAt_idx`(`status`, `nextAttemptAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `N8nExecution` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL DEFAULT 'tech360',
    `workflowCode` VARCHAR(191) NOT NULL,
    `correlationId` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'REQUESTED',
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `requestPayload` LONGTEXT NOT NULL,
    `responseBody` TEXT NULL,
    `httpStatus` INTEGER NULL,
    `error` TEXT NULL,
    `automationRunId` VARCHAR(191) NULL,
    `requestedBy` VARCHAR(191) NULL,
    `callbackReceivedAt` DATETIME(3) NULL,
    `finishedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `N8nExecution_correlationId_key`(`correlationId`),
    INDEX `N8nExecution_tenantId_workflowCode_createdAt_idx`(`tenantId`, `workflowCode`, `createdAt`),
    INDEX `N8nExecution_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `AutomationRuleVersion` ADD CONSTRAINT `AutomationRuleVersion_ruleId_fkey` FOREIGN KEY (`ruleId`) REFERENCES `AutomationRule`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
