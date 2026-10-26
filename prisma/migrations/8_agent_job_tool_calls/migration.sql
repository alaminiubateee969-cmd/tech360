-- Add a narrow, persisted tool-call envelope to AgentJob and an idempotency
-- link for the one currently executable tool (task.create). Existing jobs and
-- project tasks remain unchanged; no customer data is deleted or rewritten.
ALTER TABLE `AgentJob`
    ADD COLUMN `toolName` VARCHAR(80) NULL,
    ADD COLUMN `toolArgs` LONGTEXT NULL;

ALTER TABLE `ProjectTask`
    ADD COLUMN `agentJobId` VARCHAR(191) NULL,
    ADD UNIQUE INDEX `ProjectTask_agentJobId_key`(`agentJobId`),
    ADD CONSTRAINT `ProjectTask_agentJobId_fkey`
        FOREIGN KEY (`agentJobId`) REFERENCES `AgentJob`(`id`)
        ON DELETE SET NULL ON UPDATE CASCADE;
