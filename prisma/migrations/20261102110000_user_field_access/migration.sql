-- Marks an admin who also works in the field. Replaces the username checks
-- that used to live in the API and the frontend.
ALTER TABLE `users` ADD COLUMN `field_access` BOOLEAN NOT NULL DEFAULT false;

-- Carries over the one account those checks matched, so it keeps its access.
UPDATE `users` SET `field_access` = true
WHERE `role` = 'admin' AND LOWER(TRIM(`user`)) = 'florina';
