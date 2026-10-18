-- Private AI platform: skills registry, vector knowledge index, and
-- local model deployment records.
--
-- Every statement is additive. No existing customer, execution, agent or
-- communication data is modified or deleted by this migration.
-- All tables use utf8mb4 so Bangla and mixed-script content survives.

-- The durable task queue now also carries skill and workflow tasks that
-- are not owned by an LLM agent, so `agentCode` becomes NULLABLE. The
-- foreign key is preserved: a NULL reference satisfies it, and existing
-- INFERENCE jobs keep their agent. No row is changed.
ALTER TABLE `AgentJob` MODIFY COLUMN `agentCode` VARCHAR(191) NULL;
CREATE TABLE `Skill` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL DEFAULT 'tech360',
    `departmentCode` VARCHAR(191) NULL,
    `description` TEXT NOT NULL,
    `version` VARCHAR(191) NOT NULL DEFAULT '1.0.0',
    `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `owner` VARCHAR(191) NOT NULL,
    `handler` VARCHAR(191) NOT NULL,
    `configuration` TEXT NULL,
    `inputSchema` TEXT NOT NULL,
    `outputSchema` TEXT NOT NULL,
    `permissions` TEXT NOT NULL,
    `requiresApproval` BOOLEAN NOT NULL DEFAULT false,
    `riskLevel` VARCHAR(191) NOT NULL DEFAULT 'LOW',
    `testRefs` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Skill_slug_key`(`slug`),
    INDEX `Skill_status_category_idx`(`status`, `category`),
    INDEX `Skill_departmentCode_idx`(`departmentCode`),
    INDEX `Skill_handler_idx`(`handler`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `SkillVersion` (
    `id` VARCHAR(191) NOT NULL,
    `skillId` VARCHAR(191) NOT NULL,
    `version` VARCHAR(191) NOT NULL,
    `changelog` TEXT NOT NULL,
    `schemaHash` CHAR(64) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `SkillVersion_skillId_version_key`(`skillId`, `version`),
    INDEX `SkillVersion_skillId_status_idx`(`skillId`, `status`),
    PRIMARY KEY (`id`),
    CONSTRAINT `SkillVersion_skillId_fkey` FOREIGN KEY (`skillId`) REFERENCES `Skill`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `SkillRun` (
    `id` VARCHAR(191) NOT NULL,
    `skillId` VARCHAR(191) NOT NULL,
    `skillSlug` VARCHAR(191) NOT NULL,
    `version` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'RUNNING',
    `input` LONGTEXT NOT NULL,
    `output` LONGTEXT NULL,
    `error` TEXT NULL,
    `correlationId` VARCHAR(191) NOT NULL,
    `durationMs` INTEGER NULL,
    `requestedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completedAt` DATETIME(3) NULL,

    INDEX `SkillRun_skillSlug_createdAt_idx`(`skillSlug`, `createdAt`),
    INDEX `SkillRun_status_createdAt_idx`(`status`, `createdAt`),
    INDEX `SkillRun_correlationId_idx`(`correlationId`),
    PRIMARY KEY (`id`),
    CONSTRAINT `SkillRun_skillId_fkey` FOREIGN KEY (`skillId`) REFERENCES `Skill`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `KnowledgeChunk` (
    `id` VARCHAR(191) NOT NULL,
    `documentId` VARCHAR(191) NOT NULL,
    `chunkIndex` INTEGER NOT NULL,
    `content` LONGTEXT NOT NULL,
    `embedding` LONGTEXT NULL,
    `dimensions` INTEGER NOT NULL DEFAULT 0,
    `model` VARCHAR(191) NULL,
    `accessLevel` VARCHAR(191) NOT NULL DEFAULT 'INTERNAL',
    `checksum` CHAR(64) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `KnowledgeChunk_documentId_chunkIndex_key`(`documentId`, `chunkIndex`),
    INDEX `KnowledgeChunk_accessLevel_idx`(`accessLevel`),
    INDEX `KnowledgeChunk_documentId_idx`(`documentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `KnowledgeIngestRecord` (
    `id` VARCHAR(191) NOT NULL,
    `documentId` VARCHAR(191) NOT NULL,
    `source` VARCHAR(191) NOT NULL,
    `owner` VARCHAR(191) NOT NULL,
    `collectedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastVerifiedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `accessLevel` VARCHAR(191) NOT NULL DEFAULT 'INTERNAL',
    `version` VARCHAR(191) NOT NULL DEFAULT '1.0.0',
    `retentionPolicy` VARCHAR(191) NOT NULL DEFAULT 'REVIEW_ANNUALLY',
    `permissionScope` VARCHAR(191) NOT NULL DEFAULT 'TECH360_STAFF',
    `contentHash` CHAR(64) NOT NULL,
    `chunkCount` INTEGER NOT NULL DEFAULT 0,
    `embeddingModel` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'INDEXED',
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `KnowledgeIngestRecord_documentId_key`(`documentId`),
    INDEX `KnowledgeIngestRecord_accessLevel_status_idx`(`accessLevel`, `status`),
    INDEX `KnowledgeIngestRecord_owner_idx`(`owner`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ModelDeployment` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `upstreamModel` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL,
    `revision` VARCHAR(191) NOT NULL,
    `weightChecksum` CHAR(64) NOT NULL,
    `quantization` VARCHAR(191) NULL,
    `ramFootprintMb` INTEGER NOT NULL,
    `license` VARCHAR(191) NOT NULL,
    `verifiedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `verifiedBy` VARCHAR(191) NOT NULL DEFAULT 'verify-local-models.mjs',
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ModelDeployment_slug_key`(`slug`),
    INDEX `ModelDeployment_provider_idx`(`provider`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `WorkflowDefinition` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `status` VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
    `nodes` LONGTEXT NOT NULL,
    `edges` LONGTEXT NOT NULL,
    `createdBy` VARCHAR(191) NULL,
    `publishedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `WorkflowDefinition_key_key`(`key`),
    INDEX `WorkflowDefinition_status_updatedAt_idx`(`status`, `updatedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
