-- A daily entry is a market visit, other work or private work. Existing rows
-- are all market visits, which is what the column default gives them.
ALTER TABLE `store_visits` DROP FOREIGN KEY `store_visits_ibfk_3`;

ALTER TABLE `store_visits`
    ADD COLUMN `entry_type` ENUM('market', 'other_work', 'private_work') NOT NULL DEFAULT 'market' AFTER `user_id`,
    ADD COLUMN `reason` VARCHAR(500) NULL AFTER `store_id`,
    MODIFY `store_id` INTEGER NULL;

ALTER TABLE `store_visits` ADD CONSTRAINT `store_visits_ibfk_3` FOREIGN KEY (`store_id`) REFERENCES `stores`(`store_id`) ON DELETE RESTRICT ON UPDATE CASCADE;
