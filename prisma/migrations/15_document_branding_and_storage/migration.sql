-- TECH360 — Document Branding & Secure Storage (additive, non-destructive)
-- Adds GeneratedDocument table for audit-compliant document storage (spec §9)
-- and supports reusable branding configuration via Setting key document_branding.
-- No existing tables are altered; approval records are preserved.

-- CreateTable
CREATE TABLE `GeneratedDocument` (
    `id` VARCHAR(191) NOT NULL,
    `documentId` VARCHAR(191) NOT NULL,
    `documentType` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NULL,
    `projectId` VARCHAR(191) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `createdBy` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `approvalStatus` VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
    `finalizationStatus` VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
    `fileLocation` TEXT NULL,
    `fileContent` LONGBLOB NULL,
    `brandingVersion` INTEGER NOT NULL DEFAULT 1,
    `accessPermissions` TEXT NOT NULL,
    `auditHistory` LONGTEXT NOT NULL,
    `relatedId` VARCHAR(191) NULL,
    `sha256` VARCHAR(191) NULL,
    `title` VARCHAR(191) NULL,
    `isPublicTemplate` BOOLEAN NOT NULL DEFAULT false,
    UNIQUE INDEX `GeneratedDocument_documentId_key`(`documentId`),
    INDEX `GeneratedDocument_documentType_idx`(`documentType`),
    INDEX `GeneratedDocument_clientId_idx`(`clientId`),
    INDEX `GeneratedDocument_projectId_idx`(`projectId`),
    INDEX `GeneratedDocument_approvalStatus_idx`(`approvalStatus`),
    INDEX `GeneratedDocument_finalizationStatus_idx`(`finalizationStatus`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `GeneratedDocument` ADD CONSTRAINT `GeneratedDocument_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GeneratedDocument` ADD CONSTRAINT `GeneratedDocument_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
