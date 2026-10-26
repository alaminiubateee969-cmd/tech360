-- Add explicit consent evidence and request idempotency for public intake.
-- Additive only: existing records are retained and new consent/idempotency
-- columns remain NULL for historical rows. No customer data is rewritten.

ALTER TABLE `FormSubmission`
    ADD COLUMN `clientRequestId` VARCHAR(64) NULL,
    ADD COLUMN `requestHash` CHAR(64) NULL,
    ADD COLUMN `contactConsentAt` DATETIME(3) NULL,
    ADD COLUMN `marketingConsentAt` DATETIME(3) NULL,
    ADD COLUMN `phone` VARCHAR(191) NULL,
    ADD COLUMN `consentVersion` VARCHAR(64) NULL;
CREATE UNIQUE INDEX `FormSubmission_clientRequestId_key`
    ON `FormSubmission`(`clientRequestId`);

ALTER TABLE `ChatConversation`
    ADD COLUMN `clientRequestId` VARCHAR(64) NULL,
    ADD COLUMN `contactConsentAt` DATETIME(3) NULL,
    ADD COLUMN `consentVersion` VARCHAR(64) NULL;
CREATE UNIQUE INDEX `ChatConversation_clientRequestId_key`
    ON `ChatConversation`(`clientRequestId`);

ALTER TABLE `ChatMessage`
    ADD COLUMN `clientRequestId` VARCHAR(64) NULL;
CREATE UNIQUE INDEX `ChatMessage_clientRequestId_key`
    ON `ChatMessage`(`clientRequestId`);

ALTER TABLE `NewsletterSubscriber`
    ADD COLUMN `consentAt` DATETIME(3) NULL,
    ADD COLUMN `consentVersion` VARCHAR(64) NULL;
