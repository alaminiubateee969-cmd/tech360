-- Additive DCC evidence snapshots and bounded child-agent lookup.
-- Existing customer, project, agent, execution, and identity rows are unchanged.

CREATE TABLE `DepartmentCapabilityAssessment` (
    `id` VARCHAR(191) NOT NULL,
    `departmentId` VARCHAR(191) NOT NULL,
    `thresholdVersion` VARCHAR(32) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'UNDER_REVIEW',
    `sopCoverage` DOUBLE NULL,
    `knowledgeCoverage` DOUBLE NULL,
    `skillCoverage` DOUBLE NULL,
    `testPassRate` DOUBLE NULL,
    `kpiAchievement` DOUBLE NULL,
    `securityCompliance` DOUBLE NULL,
    `auditCompliance` DOUBLE NULL,
    `selfRecoveryRate` DOUBLE NULL,
    `humanEscalationRate` DOUBLE NULL,
    `evidence` LONGTEXT NOT NULL,
    `measurementStart` DATETIME(3) NULL,
    `measurementEnd` DATETIME(3) NULL,
    `assessedBy` VARCHAR(191) NOT NULL,
    `assessedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NULL,

    INDEX `DepartmentCapabilityAssessment_departmentId_assessedAt_idx`(`departmentId`, `assessedAt`),
    INDEX `DepartmentCapabilityAssessment_status_expiresAt_idx`(`status`, `expiresAt`),
    PRIMARY KEY (`id`),
    CONSTRAINT `DepartmentCapabilityAssessment_departmentId_fkey`
      FOREIGN KEY (`departmentId`) REFERENCES `Department`(`id`)
      ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `AiAgent_parentCode_idx` ON `AiAgent`(`parentCode`);
