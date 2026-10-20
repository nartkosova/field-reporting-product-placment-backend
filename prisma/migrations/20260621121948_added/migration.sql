-- DropForeignKey
ALTER TABLE `competitor_brand_categories` DROP FOREIGN KEY `competitor_brand_categories_ibfk_1`;

-- DropForeignKey
ALTER TABLE `competitor_facings` DROP FOREIGN KEY `competitor_facings_ibfk_1`;

-- DropForeignKey
ALTER TABLE `competitor_facings` DROP FOREIGN KEY `competitor_facings_ibfk_2`;

-- DropForeignKey
ALTER TABLE `competitor_facings` DROP FOREIGN KEY `competitor_facings_ibfk_3`;

-- DropForeignKey
ALTER TABLE `competitor_products` DROP FOREIGN KEY `competitor_products_ibfk_1`;

-- DropForeignKey
ALTER TABLE `competitor_products` DROP FOREIGN KEY `competitor_products_ibfk_2`;

-- DropForeignKey
ALTER TABLE `podravka_facings` DROP FOREIGN KEY `podravka_facings_ibfk_1`;

-- DropForeignKey
ALTER TABLE `podravka_facings` DROP FOREIGN KEY `podravka_facings_ibfk_2`;

-- DropForeignKey
ALTER TABLE `podravka_facings` DROP FOREIGN KEY `podravka_facings_ibfk_3`;

-- DropForeignKey
ALTER TABLE `product_rankings` DROP FOREIGN KEY `product_rankings_ibfk_1`;

-- DropForeignKey
ALTER TABLE `report_photos` DROP FOREIGN KEY `report_photos_ibfk_1`;

-- DropForeignKey
ALTER TABLE `report_photos` DROP FOREIGN KEY `report_photos_ibfk_2`;

-- DropForeignKey
ALTER TABLE `stores` DROP FOREIGN KEY `stores_ibfk_1`;

-- DropIndex
DROP INDEX `competitor_id_UNIQUE` ON `competitor_brands`;

-- DropIndex
DROP INDEX `id_UNIQUE` ON `competitor_facings`;

-- DropIndex
DROP INDEX `id_UNIQUE` ON `podravka_facings`;

-- DropIndex
DROP INDEX `product_id_UNIQUE` ON `podravka_products`;

-- DropIndex
DROP INDEX `idx_store_id` ON `stores`;

-- DropIndex
DROP INDEX `store_id_UNIQUE` ON `stores`;

-- DropIndex
DROP INDEX `user_id_UNIQUE` ON `users`;

-- AlterTable
ALTER TABLE `competitor_brands` MODIFY `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE `competitor_facings` ADD COLUMN `work_log_day_id` INTEGER NULL,
    MODIFY `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE `competitor_products` MODIFY `weight` DOUBLE NULL,
    MODIFY `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE `podravka_facings` ADD COLUMN `work_log_day_id` INTEGER NULL,
    MODIFY `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE `podravka_products` MODIFY `weight` DOUBLE NULL,
    MODIFY `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE `product_rankings` MODIFY `sales_last_year` DOUBLE NULL,
    MODIFY `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE `report_photos` ADD COLUMN `work_log_day_id` INTEGER NULL,
    MODIFY `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE `stores` MODIFY `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE `users` MODIFY `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE `work_log_days` (
    `work_log_day_id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `work_date` DATE NOT NULL,
    `status` ENUM('planned_work', 'vacation', 'sick_day', 'other') NOT NULL DEFAULT 'planned_work',
    `plan` TEXT NULL,
    `summary` TEXT NULL,
    `absence_reason` VARCHAR(255) NULL,
    `start_kilometers` DECIMAL(10, 2) NULL,
    `end_kilometers` DECIMAL(10, 2) NULL,
    `kilometers_driven` DECIMAL(10, 2) NULL,
    `fuel_cost` DECIMAL(10, 2) NULL,
    `fuel_liters` DECIMAL(10, 2) NULL,
    `other_travel_cost` DECIMAL(10, 2) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL,

    INDEX `idx_work_log_days_user_id`(`user_id`),
    INDEX `idx_work_log_days_work_date`(`work_date`),
    UNIQUE INDEX `uniq_user_work_date`(`user_id`, `work_date`),
    PRIMARY KEY (`work_log_day_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `work_log_activities` (
    `work_log_activity_id` INTEGER NOT NULL AUTO_INCREMENT,
    `work_log_day_id` INTEGER NOT NULL,
    `activity_type` ENUM('ppl', 'photo_report', 'presence_report', 'podravka_facings', 'competitor_facings', 'store_visit', 'other') NOT NULL,
    `planned` BOOLEAN NOT NULL DEFAULT true,
    `completed` BOOLEAN NOT NULL DEFAULT false,
    `quantity` INTEGER NULL,
    `note` TEXT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL,

    INDEX `idx_work_log_activities_day_id`(`work_log_day_id`),
    INDEX `idx_work_log_activities_type`(`activity_type`),
    PRIMARY KEY (`work_log_activity_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `idx_competitor_facings_work_log_day_id` ON `competitor_facings`(`work_log_day_id`);

-- CreateIndex
CREATE INDEX `idx_podravka_facings_work_log_day_id` ON `podravka_facings`(`work_log_day_id`);

-- CreateIndex
CREATE INDEX `idx_report_photos_work_log_day_id` ON `report_photos`(`work_log_day_id`);

-- AddForeignKey
ALTER TABLE `work_log_days` ADD CONSTRAINT `work_log_days_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `work_log_activities` ADD CONSTRAINT `work_log_activities_ibfk_1` FOREIGN KEY (`work_log_day_id`) REFERENCES `work_log_days`(`work_log_day_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stores` ADD CONSTRAINT `stores_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `report_photos` ADD CONSTRAINT `report_photos_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `report_photos` ADD CONSTRAINT `report_photos_ibfk_2` FOREIGN KEY (`store_id`) REFERENCES `stores`(`store_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `report_photos` ADD CONSTRAINT `report_photos_ibfk_3` FOREIGN KEY (`work_log_day_id`) REFERENCES `work_log_days`(`work_log_day_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_rankings` ADD CONSTRAINT `product_rankings_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `podravka_products`(`product_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `podravka_facings` ADD CONSTRAINT `podravka_facings_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `podravka_facings` ADD CONSTRAINT `podravka_facings_ibfk_2` FOREIGN KEY (`store_id`) REFERENCES `stores`(`store_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `podravka_facings` ADD CONSTRAINT `podravka_facings_ibfk_3` FOREIGN KEY (`product_id`) REFERENCES `podravka_products`(`product_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `podravka_facings` ADD CONSTRAINT `podravka_facings_ibfk_4` FOREIGN KEY (`work_log_day_id`) REFERENCES `work_log_days`(`work_log_day_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `competitor_products` ADD CONSTRAINT `competitor_products_ibfk_1` FOREIGN KEY (`competitor_id`) REFERENCES `competitor_brands`(`competitor_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `competitor_products` ADD CONSTRAINT `competitor_products_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `competitor_facings` ADD CONSTRAINT `competitor_facings_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `competitor_facings` ADD CONSTRAINT `competitor_facings_ibfk_2` FOREIGN KEY (`store_id`) REFERENCES `stores`(`store_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `competitor_facings` ADD CONSTRAINT `competitor_facings_ibfk_3` FOREIGN KEY (`competitor_id`) REFERENCES `competitor_brands`(`competitor_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `competitor_facings` ADD CONSTRAINT `competitor_facings_ibfk_4` FOREIGN KEY (`work_log_day_id`) REFERENCES `work_log_days`(`work_log_day_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `competitor_brand_categories` ADD CONSTRAINT `competitor_brand_categories_ibfk_1` FOREIGN KEY (`competitor_id`) REFERENCES `competitor_brands`(`competitor_id`) ON DELETE CASCADE ON UPDATE CASCADE;
