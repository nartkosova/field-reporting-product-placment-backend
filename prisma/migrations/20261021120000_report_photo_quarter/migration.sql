-- Quarterly photos keep their reporting quarter separately, so they can also
-- carry a real product category. Existing photos are left as they are: older
-- quarterly photos keep the quarter in the category column, and the reports
-- match both forms.
ALTER TABLE `report_photos`
    ADD COLUMN `quarter` VARCHAR(10) NULL,
    ADD INDEX `idx_report_photos_quarter` (`quarter`);
