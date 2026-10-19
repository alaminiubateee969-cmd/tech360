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
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

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
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

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
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

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
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `WorkflowDefinition_key_key`(`key`),
    INDEX `WorkflowDefinition_status_updatedAt_idx`(`status`, `updatedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================
-- AI-EOS unified workforce substrate
-- ============================================================
-- Every statement is additive. The PromptTemplate change only ADDS
-- columns with defaults, so no existing prompt row is rewritten.

ALTER TABLE `PromptTemplate` ADD COLUMN `stage` VARCHAR(191) NOT NULL DEFAULT 'TASK_EXECUTION',
  ADD COLUMN `priority` INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN `quality` DOUBLE NOT NULL DEFAULT 0.5,
  ADD COLUMN `language` VARCHAR(191) NOT NULL DEFAULT 'en',
  ADD COLUMN `version` VARCHAR(191) NOT NULL DEFAULT '1.0.0',
  ADD COLUMN `role` VARCHAR(191) NULL,
  ADD COLUMN `departmentCode` VARCHAR(191) NULL,
  ADD COLUMN `skillCode` VARCHAR(191) NULL,
  ADD COLUMN `sopKey` VARCHAR(191) NULL,
  ADD COLUMN `tags` TEXT NULL,
  ADD COLUMN `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN `usageCount` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `successCount` INTEGER NOT NULL DEFAULT 0;

-- The single-column index on `category` is replaced by this composite
-- index, whose leading column is still `category`, so no query loses
-- its index. The old index is dropped so the applied schema matches
-- prisma/schema.prisma exactly and `prisma migrate diff` reports
-- zero drift.
DROP INDEX `PromptTemplate_category_idx` ON `PromptTemplate`;
CREATE INDEX `PromptTemplate_category_status_idx` ON `PromptTemplate`(`category`, `status`);
CREATE INDEX `PromptTemplate_agentCode_stage_idx` ON `PromptTemplate`(`agentCode`, `stage`);
CREATE INDEX `PromptTemplate_departmentCode_stage_idx` ON `PromptTemplate`(`departmentCode`, `stage`);
CREATE INDEX `PromptTemplate_skillCode_idx` ON `PromptTemplate`(`skillCode`);
CREATE INDEX `PromptTemplate_sopKey_idx` ON `PromptTemplate`(`sopKey`);

CREATE TABLE `Sop` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL DEFAULT 'OPERATIONS',
    `departmentCode` VARCHAR(191) NULL,
    `version` VARCHAR(191) NOT NULL DEFAULT '1.0.0',
    `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `owner` VARCHAR(191) NOT NULL DEFAULT 'tech360',
    `level` INTEGER NOT NULL DEFAULT 3,
    `description` TEXT NOT NULL,
    `trigger` TEXT NOT NULL,
    `inputs` LONGTEXT NOT NULL,
    `preconditions` LONGTEXT NOT NULL,
    `steps` LONGTEXT NOT NULL,
    `decisionPoints` LONGTEXT NOT NULL,
    `tools` LONGTEXT NOT NULL,
    `validation` LONGTEXT NOT NULL,
    `output` TEXT NOT NULL,
    `failurePath` TEXT NOT NULL,
    `escalation` TEXT NOT NULL,
    `requiresApproval` BOOLEAN NOT NULL DEFAULT false,
    `auditRequired` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Sop_key_key`(`key`),
    INDEX `Sop_category_status_idx`(`category`, `status`),
    INDEX `Sop_departmentCode_idx`(`departmentCode`),
    INDEX `Sop_level_idx`(`level`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `SopRun` (
    `id` VARCHAR(191) NOT NULL,
    `sopKey` VARCHAR(191) NOT NULL,
    `correlationId` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'RUNNING',
    `stepIndex` INTEGER NOT NULL DEFAULT 0,
    `totalSteps` INTEGER NOT NULL DEFAULT 0,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completedAt` DATETIME(3) NULL,
    `input` LONGTEXT NULL,
    `output` LONGTEXT NULL,
    `error` TEXT NULL,
    `steps` LONGTEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SopRun_sopKey_createdAt_idx`(`sopKey`, `createdAt`),
    INDEX `SopRun_status_idx`(`status`),
    PRIMARY KEY (`id`),
    CONSTRAINT `SopRun_sopKey_fkey` FOREIGN KEY (`sopKey`) REFERENCES `Sop`(`key`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `AgentDelegation` (
    `id` VARCHAR(191) NOT NULL,
    `requestingAgent` VARCHAR(191) NOT NULL,
    `targetAgent` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL DEFAULT 'DELEGATE',
    `task` TEXT NOT NULL,
    `objective` TEXT NOT NULL,
    `context` LONGTEXT NULL,
    `priority` VARCHAR(191) NOT NULL DEFAULT 'NORMAL',
    `deadline` DATETIME(3) NULL,
    `permissions` LONGTEXT NOT NULL,
    `expectedOutput` TEXT NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `result` LONGTEXT NULL,
    `correlationId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completedAt` DATETIME(3) NULL,

    INDEX `AgentDelegation_requestingAgent_status_idx`(`requestingAgent`, `status`),
    INDEX `AgentDelegation_targetAgent_status_idx`(`targetAgent`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `AgentEvent` (
    `id` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `source` VARCHAR(191) NOT NULL,
    `payload` LONGTEXT NOT NULL,
    `correlationId` VARCHAR(191) NULL,
    `severity` VARCHAR(191) NOT NULL DEFAULT 'INFO',
    `subscribers` LONGTEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AgentEvent_type_createdAt_idx`(`type`, `createdAt`),
    INDEX `AgentEvent_source_createdAt_idx`(`source`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `KnowledgeEntity` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL DEFAULT 'CONCEPT',
    `description` TEXT NULL,
    `accessLevel` VARCHAR(191) NOT NULL DEFAULT 'INTERNAL',
    `confidence` DOUBLE NOT NULL DEFAULT 0.5,
    `properties` LONGTEXT NULL,
    `source` VARCHAR(191) NOT NULL DEFAULT 'PLATFORM',
    `version` INTEGER NOT NULL DEFAULT 1,
    `verified` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `KnowledgeEntity_key_key`(`key`),
    INDEX `KnowledgeEntity_type_accessLevel_idx`(`type`, `accessLevel`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `KnowledgeRelation` (
    `id` VARCHAR(191) NOT NULL,
    `fromKey` VARCHAR(191) NOT NULL,
    `toKey` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL DEFAULT 'RELATED_TO',
    `weight` DOUBLE NOT NULL DEFAULT 0.5,
    `confidence` DOUBLE NOT NULL DEFAULT 0.5,
    `provenance` TEXT NULL,
    `accessLevel` VARCHAR(191) NOT NULL DEFAULT 'INTERNAL',
    `version` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `KnowledgeRelation_fromKey_toKey_type_key`(`fromKey`, `toKey`, `type`),
    INDEX `KnowledgeRelation_toKey_type_idx`(`toKey`, `type`),
    PRIMARY KEY (`id`),
    CONSTRAINT `KnowledgeRelation_fromKey_fkey` FOREIGN KEY (`fromKey`) REFERENCES `KnowledgeEntity`(`key`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `KnowledgeRelation_toKey_fkey` FOREIGN KEY (`toKey`) REFERENCES `KnowledgeEntity`(`key`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- AiMemory: the unified memory system.
--
-- The memory system needs to distinguish the memory TYPE (working,
-- episodic, semantic, procedural), the ACCESS LEVEL that governs who may
-- read it, the enterprise scope that owns it, the revision number, the
-- validation flag, the source, an expiry and the run that produced it.
-- Without these, memory cannot be permission-aware, versioned or
-- auditable.
-- ---------------------------------------------------------------------------
ALTER TABLE `AiMemory`
    ADD COLUMN `memoryType` VARCHAR(191) NOT NULL DEFAULT 'SEMANTIC',
    ADD COLUMN `accessLevel` VARCHAR(191) NOT NULL DEFAULT 'INTERNAL',
    ADD COLUMN `departmentCode` VARCHAR(191) NULL,
    ADD COLUMN `version` INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN `validated` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `source` VARCHAR(191) NOT NULL DEFAULT 'PLATFORM',
    ADD COLUMN `expiresAt` DATETIME(3) NULL,
    ADD COLUMN `correlationId` VARCHAR(191) NULL,
    ADD COLUMN `tags` LONGTEXT NULL;

CREATE INDEX `AiMemory_scope_memoryType_idx` ON `AiMemory`(`scope`, `memoryType`);
CREATE INDEX `AiMemory_accessLevel_idx` ON `AiMemory`(`accessLevel`);
CREATE INDEX `AiMemory_departmentCode_idx` ON `AiMemory`(`departmentCode`);
