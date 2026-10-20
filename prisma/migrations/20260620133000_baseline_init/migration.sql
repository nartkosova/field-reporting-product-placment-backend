CREATE TABLE `users` (
  `user_id` int NOT NULL AUTO_INCREMENT,
  `user` varchar(100) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role` enum('admin','employee','viewer') DEFAULT 'employee',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `user_id_UNIQUE` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `competitor_brands` (
  `competitor_id` int NOT NULL AUTO_INCREMENT,
  `brand_name` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`competitor_id`),
  UNIQUE KEY `competitor_id_UNIQUE` (`competitor_id`),
  UNIQUE KEY `brand_name_UNIQUE` (`brand_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `podravka_products` (
  `product_id` int NOT NULL AUTO_INCREMENT,
  `business_unit` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `podravka_code` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `elkos_code` int DEFAULT NULL,
  `product_category` enum('A','B','C','D','E','F','G') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `weight` float DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`product_id`),
  UNIQUE KEY `podravka_code` (`podravka_code`),
  UNIQUE KEY `product_id_UNIQUE` (`product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `stores` (
  `store_id` int NOT NULL AUTO_INCREMENT,
  `store_name` varchar(255) NOT NULL,
  `store_code` varchar(50) NOT NULL,
  `store_channel` enum('TT','MT') NOT NULL,
  `store_category` enum('A','B','C','D','E','F','G','W','WHC') NOT NULL,
  `user_id` int DEFAULT NULL,
  `sales_rep` varchar(100) NOT NULL,
  `location` varchar(100) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`store_id`),
  UNIQUE KEY `store_code` (`store_code`),
  UNIQUE KEY `store_id_UNIQUE` (`store_id`),
  UNIQUE KEY `idx_store_id` (`store_id`),
  KEY `user_id` (`user_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_user_category` (`user_id`,`store_category`),
  CONSTRAINT `stores_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `report_photos` (
  `photo_id` int NOT NULL AUTO_INCREMENT,
  `photo_url` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `photo_type` enum('regular_shelf','secondary_position','new_product','sale','fletushka','korporative','staleness','reward_game','dimensioning_report','secondary_position_quarter','other1','other2') COLLATE utf8mb4_unicode_ci NOT NULL,
  `company` enum('podravka','competitor') COLLATE utf8mb4_unicode_ci NOT NULL,
  `photo_description` varchar(250) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_id` int NOT NULL,
  `store_id` int NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`photo_id`),
  KEY `user_id` (`user_id`),
  KEY `store_id` (`store_id`),
  CONSTRAINT `report_photos_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `report_photos_ibfk_2` FOREIGN KEY (`store_id`) REFERENCES `stores` (`store_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `podravka_facings` (
  `podravka_facings_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `store_id` int NOT NULL,
  `product_id` int NOT NULL,
  `category` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `facings_count` int NOT NULL,
  `batch_id` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_listed` tinyint(1) DEFAULT '1',
  `record_type` enum('FACINGS','PRESENCE') COLLATE utf8mb4_unicode_ci DEFAULT 'FACINGS',
  PRIMARY KEY (`podravka_facings_id`),
  UNIQUE KEY `id_UNIQUE` (`podravka_facings_id`),
  KEY `user_id` (`user_id`),
  KEY `store_id` (`store_id`),
  KEY `product_id` (`product_id`),
  CONSTRAINT `podravka_facings_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `podravka_facings_ibfk_2` FOREIGN KEY (`store_id`) REFERENCES `stores` (`store_id`),
  CONSTRAINT `podravka_facings_ibfk_3` FOREIGN KEY (`product_id`) REFERENCES `podravka_products` (`product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `product_rankings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `product_id` int NOT NULL,
  `year` int NOT NULL,
  `total_rank` int DEFAULT NULL,
  `category_rank` int DEFAULT NULL,
  `sales_last_year` float DEFAULT NULL,
  `category_sales_share` decimal(6,4) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `product_id` (`product_id`),
  CONSTRAINT `product_rankings_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `podravka_products` (`product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `competitor_products` (
  `competitor_product_id` int NOT NULL AUTO_INCREMENT,
  `competitor_id` int NOT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `weight` float DEFAULT NULL,
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`competitor_product_id`),
  KEY `competitor_id` (`competitor_id`),
  KEY `created_by` (`created_by`),
  CONSTRAINT `competitor_products_ibfk_1` FOREIGN KEY (`competitor_id`) REFERENCES `competitor_brands` (`competitor_id`),
  CONSTRAINT `competitor_products_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `competitor_facings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `store_id` int NOT NULL,
  `competitor_id` int NOT NULL,
  `category` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `facings_count` int NOT NULL,
  `batch_id` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `id_UNIQUE` (`id`),
  KEY `user_id` (`user_id`),
  KEY `store_id` (`store_id`),
  KEY `competitor_id` (`competitor_id`),
  CONSTRAINT `competitor_facings_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `competitor_facings_ibfk_2` FOREIGN KEY (`store_id`) REFERENCES `stores` (`store_id`),
  CONSTRAINT `competitor_facings_ibfk_3` FOREIGN KEY (`competitor_id`) REFERENCES `competitor_brands` (`competitor_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `competitor_brand_categories` (
  `id` int NOT NULL AUTO_INCREMENT,
  `competitor_id` int NOT NULL,
  `category` varchar(100) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `competitor_id` (`competitor_id`),
  CONSTRAINT `competitor_brand_categories_ibfk_1` FOREIGN KEY (`competitor_id`) REFERENCES `competitor_brands` (`competitor_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
