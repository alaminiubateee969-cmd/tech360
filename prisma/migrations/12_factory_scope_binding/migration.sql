-- Bind client-facing factory delivery to an exact, client-approved SOW version.
-- Additive only: existing generated apps remain available for internal review,
-- but cannot be marked delivered or handed over without a verified scope link.
ALTER TABLE `GeneratedApp`
    ADD COLUMN `scopeId` VARCHAR(191) NULL,
    ADD COLUMN `scopeVersion` INTEGER NULL,
    ADD COLUMN `scopeHash` VARCHAR(191) NULL,
    ADD INDEX `GeneratedApp_projectId_idx`(`projectId`),
    ADD INDEX `GeneratedApp_scopeId_idx`(`scopeId`);
