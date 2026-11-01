-- Run on the same MySQL database used by the deployed backend.
-- Existing suppliers keep NULL until a manager adds their phone number.
SET @supplier_phone_exists = (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'suppliers'
      AND column_name = 'phone'
);
SET @supplier_phone_ddl = IF(
    @supplier_phone_exists = 0,
    'ALTER TABLE suppliers ADD COLUMN phone VARCHAR(20) NULL AFTER name',
    'SELECT 1'
);
PREPARE supplier_phone_stmt FROM @supplier_phone_ddl;
EXECUTE supplier_phone_stmt;
DEALLOCATE PREPARE supplier_phone_stmt;
