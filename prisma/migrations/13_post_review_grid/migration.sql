-- TECH360 — Marketing review grid: team ratings for drafted social posts.
-- Additive only. `PostReview` records a real 1..5 rating left by a signed-in
-- operator; the grid averages these rows and shows "Not rated yet" when there
-- are none. No score, reviewer or comment is ever seeded or fabricated.
-- Deleting a post removes its reviews (ON DELETE CASCADE); deleting a review
-- never touches the post.

-- CreateTable
CREATE TABLE `PostReview` (
    `id` VARCHAR(191) NOT NULL,
    `postId` VARCHAR(191) NOT NULL,
    `rating` INTEGER NOT NULL,
    `comment` TEXT NULL,
    `reviewer` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PostReview_postId_idx`(`postId`),
    INDEX `PostReview_rating_idx`(`rating`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PostReview` ADD CONSTRAINT `PostReview_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `SocialPost`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
