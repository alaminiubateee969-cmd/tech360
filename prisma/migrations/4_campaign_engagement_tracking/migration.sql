-- Campaign engagement tracking (email-marketing parity).
--
-- Reference batch (owner, October 9): mohamed11sk/Email-markting ships
-- open-rate tracking via a 1x1 pixel on every sent email; knsoftic/
-- Email_Markting adds open AND click tracking with per-campaign
-- analytics. The TECH360 newsletter had campaigns, subscribers and an
-- honest SMTP-gated send path, but no engagement evidence at all — a
-- sent campaign showed only a recipient count.
--
-- This migration adds the `CampaignEvent` table: one row per REAL
-- recipient interaction, written only by the public tracking endpoints
-- (`/api/newsletter/track/open` pixel, `/api/newsletter/track/click`
-- redirect). No rows are ever fabricated, so a campaign that has not
-- been sent (or whose SMTP channel is not configured) honestly shows
-- zero opens and zero clicks.
CREATE TABLE `CampaignEvent` (
    `id`         VARCHAR(191) NOT NULL,
    `campaignId` VARCHAR(191) NOT NULL,
    `kind`       VARCHAR(191) NOT NULL,
    `email`      VARCHAR(191) NULL,
    `targetUrl`  TEXT NULL,
    `userAgent`  TEXT NULL,
    `ip`         VARCHAR(191) NULL,
    `createdAt`  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CampaignEvent_campaignId_kind_idx`(`campaignId`, `kind`),
    INDEX `CampaignEvent_campaignId_kind_email_idx`(`campaignId`, `kind`, `email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `CampaignEvent`
    ADD CONSTRAINT `CampaignEvent_campaignId_fkey`
    FOREIGN KEY (`campaignId`) REFERENCES `EmailCampaign`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;
