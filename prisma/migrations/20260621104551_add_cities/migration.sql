-- AlterTable
ALTER TABLE `competitor_brands` MODIFY `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE `competitor_facings` MODIFY `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE `competitor_products` MODIFY `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE `podravka_facings` MODIFY `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE `podravka_products` MODIFY `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE `product_rankings` MODIFY `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE `report_photos` MODIFY `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE `stores` MODIFY `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE `users` MODIFY `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE `work_log_day_cities` (
    `work_log_day_city_id` INTEGER NOT NULL AUTO_INCREMENT,
    `work_log_day_id` INTEGER NOT NULL,
    `city_name` VARCHAR(100) NOT NULL,
    `visit_order` INTEGER NULL,
    `note` VARCHAR(255) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_work_log_day_cities_day_id`(`work_log_day_id`),
    INDEX `idx_work_log_day_cities_city_name`(`city_name`),
    PRIMARY KEY (`work_log_day_city_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `work_log_day_cities` ADD CONSTRAINT `work_log_day_cities_ibfk_1` FOREIGN KEY (`work_log_day_id`) REFERENCES `work_log_days`(`work_log_day_id`) ON DELETE CASCADE ON UPDATE CASCADE;
