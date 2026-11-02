-- A store can be assigned to any number of users. Replaces stores.user_id.
CREATE TABLE `store_users` (
    `store_user_id` INTEGER NOT NULL AUTO_INCREMENT,
    `store_id` INTEGER NOT NULL,
    `user_id` INTEGER NOT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE INDEX `uniq_store_user`(`store_id`, `user_id`),
    INDEX `idx_store_users_user_id`(`user_id`),
    PRIMARY KEY (`store_user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `store_users` ADD CONSTRAINT `store_users_ibfk_1` FOREIGN KEY (`store_id`) REFERENCES `stores`(`store_id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `store_users` ADD CONSTRAINT `store_users_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Every existing assignment moves over before the old column goes away.
INSERT INTO `store_users` (`store_id`, `user_id`)
SELECT `store_id`, `user_id` FROM `stores` WHERE `user_id` IS NOT NULL;

ALTER TABLE `stores` DROP FOREIGN KEY `stores_ibfk_1`;
DROP INDEX `idx_user_category` ON `stores`;
-- MySQL removes the remaining single-column indexes on user_id with the column.
ALTER TABLE `stores` DROP COLUMN `user_id`;
