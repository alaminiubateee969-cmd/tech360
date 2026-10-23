-- Additive commerce, invoice lifecycle, verified payment receipts, refund/dispute
-- cases, CRM duplicate-merge pointer, live-chat client link, and monotonic
-- per-year sequence counters.
--
-- Compatibility & Rollback:
--   - Every DDL statement is strictly additive (new tables and new nullable or
--     defaulted columns only).
--   - Existing customer, communication, project, invoice, and payment rows are
--     preserved with safe defaults and nullable columns; no data is dropped or
--     rewritten.
--   - Backup requirement: run mysqldump --single-transaction and npm run db:verify
--     before applying in production.

CREATE TABLE `SequenceCounter` (
    `id` VARCHAR(191) NOT NULL,
    `prefix` VARCHAR(191) NOT NULL,
    `year` INTEGER NOT NULL,
    `lastValue` INTEGER NOT NULL DEFAULT 0,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SequenceCounter_prefix_year_key`(`prefix`, `year`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Client`
    ADD COLUMN `mergedIntoId` VARCHAR(191) NULL;
CREATE INDEX `Client_mergedIntoId_idx` ON `Client`(`mergedIntoId`);

ALTER TABLE `ChatConversation`
    ADD COLUMN `clientId` VARCHAR(191) NULL;
CREATE INDEX `ChatConversation_clientId_idx` ON `ChatConversation`(`clientId`);

ALTER TABLE `Invoice`
    ADD COLUMN `scopeVersion` INTEGER NULL,
    ADD COLUMN `subtotalMinor` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `discountMinor` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `discountReason` TEXT NULL,
    ADD COLUMN `taxRateBps` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `taxLabel` VARCHAR(191) NULL,
    ADD COLUMN `taxMinor` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `totalMinor` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `description` TEXT NULL,
    ADD COLUMN `lineItems` LONGTEXT NULL,
    ADD COLUMN `billingName` VARCHAR(191) NULL,
    ADD COLUMN `billingBusiness` VARCHAR(191) NULL,
    ADD COLUMN `billingEmail` VARCHAR(191) NULL,
    ADD COLUMN `billingAddress` TEXT NULL,
    ADD COLUMN `billingCountry` VARCHAR(191) NULL,
    ADD COLUMN `paymentTerms` TEXT NULL,
    ADD COLUMN `paymentMethodsSnapshot` TEXT NULL,
    ADD COLUMN `internalNotes` TEXT NULL,
    ADD COLUMN `customerNotes` TEXT NULL,
    ADD COLUMN `termsVersion` VARCHAR(191) NULL,
    ADD COLUMN `revision` INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN `supersedesInvoiceNumber` VARCHAR(191) NULL,
    ADD COLUMN `approvedBy` VARCHAR(191) NULL,
    ADD COLUMN `approvedAt` DATETIME(3) NULL,
    ADD COLUMN `sentAt` DATETIME(3) NULL,
    ADD COLUMN `viewedAt` DATETIME(3) NULL,
    ADD COLUMN `paidAt` DATETIME(3) NULL,
    ADD COLUMN `voidedAt` DATETIME(3) NULL,
    ADD COLUMN `voidReason` TEXT NULL,
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

CREATE INDEX `Invoice_supersedesInvoiceNumber_idx` ON `Invoice`(`supersedesInvoiceNumber`);

CREATE TABLE `PaymentReceipt` (
    `id` VARCHAR(191) NOT NULL,
    `receiptNumber` VARCHAR(191) NOT NULL,
    `paymentId` VARCHAR(191) NOT NULL,
    `invoiceId` VARCHAR(191) NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NULL,
    `amountMinor` INTEGER NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'USD',
    `method` VARCHAR(191) NULL,
    `transactionId` VARCHAR(191) NULL,
    `verifiedBy` VARCHAR(191) NOT NULL,
    `verifiedAt` DATETIME(3) NOT NULL,
    `issuedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `snapshot` LONGTEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PaymentReceipt_receiptNumber_key`(`receiptNumber`),
    UNIQUE INDEX `PaymentReceipt_paymentId_key`(`paymentId`),
    INDEX `PaymentReceipt_clientId_issuedAt_idx`(`clientId`, `issuedAt`),
    INDEX `PaymentReceipt_invoiceId_idx`(`invoiceId`),
    INDEX `PaymentReceipt_projectId_idx`(`projectId`),
    PRIMARY KEY (`id`),
    CONSTRAINT `PaymentReceipt_paymentId_fkey` FOREIGN KEY (`paymentId`) REFERENCES `Payment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `PaymentReceipt_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `Invoice`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `PaymentReceipt_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `PaymentReceipt_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `RefundCase` (
    `id` VARCHAR(191) NOT NULL,
    `caseNumber` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NULL,
    `invoiceId` VARCHAR(191) NULL,
    `paymentId` VARCHAR(191) NULL,
    `kind` VARCHAR(191) NOT NULL DEFAULT 'REFUND',
    `status` VARCHAR(191) NOT NULL DEFAULT 'REQUESTED',
    `requestedAmountMinor` INTEGER NOT NULL DEFAULT 0,
    `approvedAmountMinor` INTEGER NOT NULL DEFAULT 0,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'USD',
    `reason` TEXT NOT NULL,
    `policyBasis` TEXT NULL,
    `evidenceNotes` LONGTEXT NULL,
    `resolutionNotes` TEXT NULL,
    `providerRefundRef` VARCHAR(191) NULL,
    `requestedBy` VARCHAR(191) NOT NULL,
    `reviewedBy` VARCHAR(191) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `settledAt` DATETIME(3) NULL,
    `revokeHandover` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `RefundCase_caseNumber_key`(`caseNumber`),
    INDEX `RefundCase_clientId_createdAt_idx`(`clientId`, `createdAt`),
    INDEX `RefundCase_projectId_idx`(`projectId`),
    INDEX `RefundCase_invoiceId_idx`(`invoiceId`),
    INDEX `RefundCase_paymentId_idx`(`paymentId`),
    INDEX `RefundCase_status_kind_idx`(`status`, `kind`),
    PRIMARY KEY (`id`),
    CONSTRAINT `RefundCase_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `RefundCase_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `RefundCase_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `Invoice`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `RefundCase_paymentId_fkey` FOREIGN KEY (`paymentId`) REFERENCES `Payment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
