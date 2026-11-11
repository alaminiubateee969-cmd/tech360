-- TECH360 — REA Studio (evidence-bound reverse-engineering teardowns) and the
-- Evolution Loop (governed, approval-gated self-modification).
--
-- Additive only: no existing table is altered, so this migration cannot break
-- a deployed pipeline. Four new tables, two foreign keys.
--
-- Design notes that matter to a reviewer:
--   * ReaTarget stores a REFUSED outcome as a real row with its reason. A
--     declined capture is a result, not a gap to be hidden.
--   * No target credential is stored: fetch-target.ts redacts set-cookie and
--     authorization before any value reaches this schema.
--   * ReaReconstruction.appId/appCode are deliberately scalar references, not
--     foreign keys: the derivation lineage must survive deletion of the
--     generated app it produced.
--   * EvolutionGeneration.generation is the primary key because the number is
--     monotonic, unique by definition, and the thing a human quotes.
--   * EvolutionProposal.generation uses ON DELETE RESTRICT: a generation that
--     has proposals is lineage and may not be deleted out from under them.
--   * EvolutionProposal.beforeSnapshot is what makes every applied change
--     reversible forever without re-reading the mutated value.

-- CreateTable
CREATE TABLE `ReaTarget` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `url` TEXT NOT NULL,
    `finalUrl` TEXT NULL,
    `host` VARCHAR(191) NOT NULL,
    `question` TEXT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `httpStatus` INTEGER NOT NULL DEFAULT 0,
    `bytes` INTEGER NOT NULL DEFAULT 0,
    `digest` CHAR(64) NULL,
    `renderModel` VARCHAR(191) NOT NULL DEFAULT 'UNKNOWN',
    `evidenceId` VARCHAR(191) NULL,
    `evidence` LONGTEXT NULL,
    `teardown` LONGTEXT NULL,
    `spoken` LONGTEXT NULL,
    `markdown` LONGTEXT NULL,
    `limitations` LONGTEXT NULL,
    `unknowns` LONGTEXT NULL,
    `observedCount` INTEGER NOT NULL DEFAULT 0,
    `inferredCount` INTEGER NOT NULL DEFAULT 0,
    `routeCandidates` INTEGER NOT NULL DEFAULT 0,
    `endpointCandidates` INTEGER NOT NULL DEFAULT 0,
    `coverageComplete` BOOLEAN NOT NULL DEFAULT false,
    `refusalCode` VARCHAR(191) NULL,
    `refusalReason` TEXT NULL,
    `durationMs` INTEGER NULL,
    `createdBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ReaTarget_status_idx`(`status`),
    INDEX `ReaTarget_host_idx`(`host`),
    INDEX `ReaTarget_createdAt_idx`(`createdAt`),
    INDEX `ReaTarget_kind_idx`(`kind`),
    UNIQUE INDEX `ReaTarget_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReaReconstruction` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `targetId` VARCHAR(191) NOT NULL,
    `appId` VARCHAR(191) NULL,
    `appCode` VARCHAR(191) NULL,
    `brief` LONGTEXT NOT NULL,
    `provenance` LONGTEXT NOT NULL,
    `pages` LONGTEXT NOT NULL,
    `confidence` DOUBLE NOT NULL DEFAULT 0,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PLANNED',
    `statement` TEXT NOT NULL,
    `createdBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ReaReconstruction_targetId_idx`(`targetId`),
    INDEX `ReaReconstruction_status_idx`(`status`),
    INDEX `ReaReconstruction_appId_idx`(`appId`),
    UNIQUE INDEX `ReaReconstruction_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EvolutionGeneration` (
    `generation` INTEGER NOT NULL,
    `parentGeneration` INTEGER NULL,
    `observations` INTEGER NOT NULL DEFAULT 0,
    `proposed` INTEGER NOT NULL DEFAULT 0,
    `applied` INTEGER NOT NULL DEFAULT 0,
    `rejected` INTEGER NOT NULL DEFAULT 0,
    `rolledBack` INTEGER NOT NULL DEFAULT 0,
    `surfaces` TEXT NULL,
    `summary` TEXT NOT NULL,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `closedAt` DATETIME(3) NULL,

    PRIMARY KEY (`generation`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EvolutionProposal` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `generation` INTEGER NOT NULL,
    `surface` VARCHAR(191) NOT NULL,
    `targetKey` TEXT NOT NULL,
    `title` TEXT NOT NULL,
    `rationale` TEXT NOT NULL,
    `effect` TEXT NOT NULL,
    `rollbackNote` TEXT NOT NULL,
    `patch` LONGTEXT NOT NULL,
    `evidence` LONGTEXT NOT NULL,
    `risk` VARCHAR(191) NOT NULL DEFAULT 'LOW',
    `riskScore` INTEGER NOT NULL DEFAULT 0,
    `riskReasons` TEXT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `approvalId` VARCHAR(191) NULL,
    `proposedBy` VARCHAR(191) NULL,
    `decidedBy` VARCHAR(191) NULL,
    `decisionNote` TEXT NULL,
    `beforeSnapshot` LONGTEXT NULL,
    `afterSnapshot` LONGTEXT NULL,
    `appliedAt` DATETIME(3) NULL,
    `rolledBackAt` DATETIME(3) NULL,
    `validationCode` VARCHAR(191) NULL,
    `failureReason` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `EvolutionProposal_status_idx`(`status`),
    INDEX `EvolutionProposal_generation_idx`(`generation`),
    INDEX `EvolutionProposal_surface_idx`(`surface`),
    INDEX `EvolutionProposal_approvalId_idx`(`approvalId`),
    UNIQUE INDEX `EvolutionProposal_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ReaReconstruction` ADD CONSTRAINT `ReaReconstruction_targetId_fkey` FOREIGN KEY (`targetId`) REFERENCES `ReaTarget`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EvolutionProposal` ADD CONSTRAINT `EvolutionProposal_generation_fkey` FOREIGN KEY (`generation`) REFERENCES `EvolutionGeneration`(`generation`) ON DELETE RESTRICT ON UPDATE CASCADE;
