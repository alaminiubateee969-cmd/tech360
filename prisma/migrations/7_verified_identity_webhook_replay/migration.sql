-- PII-safe verified identity index and idempotent inbound webhook receipts.
-- All changes are additive; no existing client identities are auto-linked and
-- no existing customer or communication data is deleted or modified.
CREATE TABLE `client_identities` (
    `id` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `identityType` VARCHAR(16) NOT NULL,
    `normalizedHash` CHAR(64) NOT NULL,
    `verificationSource` VARCHAR(40) NOT NULL,
    `verifiedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ClientIdentity_identityType_normalizedHash_key`(`identityType`, `normalizedHash`),
    INDEX `ClientIdentity_clientId_idx`(`clientId`),
    PRIMARY KEY (`id`),
    CONSTRAINT `client_identities_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `inbound_webhook_receipts` (
    `id` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(16) NOT NULL,
    `eventIdHash` CHAR(64) NOT NULL,
    `eventType` VARCHAR(32) NOT NULL DEFAULT 'MESSAGE',
    `status` VARCHAR(16) NOT NULL DEFAULT 'PROCESSING',
    `clientId` VARCHAR(191) NULL,
    `attempts` INTEGER NOT NULL DEFAULT 1,
    `claimToken` VARCHAR(36) NULL,
    `leaseExpiresAt` DATETIME(3) NULL,
    `lastError` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `processedAt` DATETIME(3) NULL,

    UNIQUE INDEX `InboundWebhookReceipt_provider_eventIdHash_key`(`provider`, `eventIdHash`),
    INDEX `InboundWebhookReceipt_status_leaseExpiresAt_idx`(`status`, `leaseExpiresAt`),
    INDEX `InboundWebhookReceipt_clientId_createdAt_idx`(`clientId`, `createdAt`),
    PRIMARY KEY (`id`),
    CONSTRAINT `inbound_webhook_receipts_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
