-- Start and end of the working day, always server time.
ALTER TABLE `work_log_days`
    ADD COLUMN `check_in_at` TIMESTAMP(0) NULL,
    ADD COLUMN `check_out_at` TIMESTAMP(0) NULL;

-- One row per store visit, with server-time check-in and check-out.
CREATE TABLE `store_visits` (
    `store_visit_id` INTEGER NOT NULL AUTO_INCREMENT,
    `work_log_day_id` INTEGER NOT NULL,
    `user_id` INTEGER NOT NULL,
    `store_id` INTEGER NOT NULL,
    `check_in_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `check_out_at` TIMESTAMP(0) NULL,
    `note` VARCHAR(255) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    INDEX `idx_store_visits_day_id`(`work_log_day_id`),
    INDEX `idx_store_visits_user_id`(`user_id`),
    INDEX `idx_store_visits_store_id`(`store_id`),
    PRIMARY KEY (`store_visit_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Proof-of-presence photos taken during a store visit.
CREATE TABLE `store_visit_photos` (
    `store_visit_photo_id` INTEGER NOT NULL AUTO_INCREMENT,
    `store_visit_id` INTEGER NOT NULL,
    `user_id` INTEGER NOT NULL,
    `photo_url` VARCHAR(255) NOT NULL,
    `public_id` VARCHAR(255) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    INDEX `idx_store_visit_photos_visit_id`(`store_visit_id`),
    PRIMARY KEY (`store_visit_photo_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `store_visits` ADD CONSTRAINT `store_visits_ibfk_1` FOREIGN KEY (`work_log_day_id`) REFERENCES `work_log_days`(`work_log_day_id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `store_visits` ADD CONSTRAINT `store_visits_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `store_visits` ADD CONSTRAINT `store_visits_ibfk_3` FOREIGN KEY (`store_id`) REFERENCES `stores`(`store_id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `store_visit_photos` ADD CONSTRAINT `store_visit_photos_ibfk_1` FOREIGN KEY (`store_visit_id`) REFERENCES `store_visits`(`store_visit_id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `store_visit_photos` ADD CONSTRAINT `store_visit_photos_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;
