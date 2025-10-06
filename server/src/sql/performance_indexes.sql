-- Performance optimization indexes for listings
-- Compatible with MySQL versions that do not support "CREATE INDEX IF NOT EXISTS"
-- and do not support index ordering like "created_at DESC" in the definition.

-- Helper pattern (repeat per index):
--   Checks information_schema for the index and only creates it if missing.

-- produce_listings(status, quantity)
SET @exists := (
  SELECT COUNT(1) FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'produce_listings'
    AND index_name = 'idx_listings_status_quantity'
);
SET @sql := IF(@exists = 0,
  'CREATE INDEX idx_listings_status_quantity ON produce_listings (status, quantity)',
  'DO 0'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- produce_listings(farmer_user_id, status)
SET @exists := (
  SELECT COUNT(1) FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'produce_listings'
    AND index_name = 'idx_listings_farmer_status'
);
SET @sql := IF(@exists = 0,
  'CREATE INDEX idx_listings_farmer_status ON produce_listings (farmer_user_id, status)',
  'DO 0'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- produce_listings(created_at)
SET @exists := (
  SELECT COUNT(1) FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'produce_listings'
    AND index_name = 'idx_listings_created_at'
);
SET @sql := IF(@exists = 0,
  'CREATE INDEX idx_listings_created_at ON produce_listings (created_at)',
  'DO 0'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- produce_listings(region)
SET @exists := (
  SELECT COUNT(1) FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'produce_listings'
    AND index_name = 'idx_listings_region'
);
SET @sql := IF(@exists = 0,
  'CREATE INDEX idx_listings_region ON produce_listings (region)',
  'DO 0'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- produce_listings(crop)
SET @exists := (
  SELECT COUNT(1) FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'produce_listings'
    AND index_name = 'idx_listings_crop'
);
SET @sql := IF(@exists = 0,
  'CREATE INDEX idx_listings_crop ON produce_listings (crop)',
  'DO 0'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- produce_listings(price_per_unit)
SET @exists := (
  SELECT COUNT(1) FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'produce_listings'
    AND index_name = 'idx_listings_price'
);
SET @sql := IF(@exists = 0,
  'CREATE INDEX idx_listings_price ON produce_listings (price_per_unit)',
  'DO 0'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- produce_listings(status, quantity, created_at)
SET @exists := (
  SELECT COUNT(1) FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'produce_listings'
    AND index_name = 'idx_listings_active_quantity_created'
);
SET @sql := IF(@exists = 0,
  'CREATE INDEX idx_listings_active_quantity_created ON produce_listings (status, quantity, created_at)',
  'DO 0'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- users(id)
SET @exists := (
  SELECT COUNT(1) FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'users'
    AND index_name = 'idx_users_id'
);
SET @sql := IF(@exists = 0,
  'CREATE INDEX idx_users_id ON users (id)',
  'DO 0'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- users(region)
SET @exists := (
  SELECT COUNT(1) FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'users'
    AND index_name = 'idx_users_region'
);
SET @sql := IF(@exists = 0,
  'CREATE INDEX idx_users_region ON users (region)',
  'DO 0'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- listing_images(listing_id, sort_order)
SET @exists := (
  SELECT COUNT(1) FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'listing_images'
    AND index_name = 'idx_listing_images_listing_sort'
);
SET @sql := IF(@exists = 0,
  'CREATE INDEX idx_listing_images_listing_sort ON listing_images (listing_id, sort_order)',
  'DO 0'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- user_avatars(user_id)
SET @exists := (
  SELECT COUNT(1) FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'user_avatars'
    AND index_name = 'idx_user_avatars_user'
);
SET @sql := IF(@exists = 0,
  'CREATE INDEX idx_user_avatars_user ON user_avatars (user_id)',
  'DO 0'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Analyze tables to update statistics
ANALYZE TABLE produce_listings;
ANALYZE TABLE users;
ANALYZE TABLE listing_images;
ANALYZE TABLE user_avatars;
