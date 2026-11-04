-- 5 tai khoan nhan vien giao hang mau cho MySQL.
-- Dam bao schema da co cac cot va gia tri enum phuc vu luong giao hang truoc khi import file nay.
-- Database local hien duoc cau hinh la managewarehouse (DB_NAME trong .env).
-- Neu ban import vao database khac, sua lenh USE ben duoi truoc khi chay.
-- File co the chay lai: khong ghi de nhan vien da co, khong tu dat id.
-- Mat khau dang bcrypt 12 rounds, tuong thich web/utils/password_hasher.py.

SET NAMES utf8mb4;
USE managewarehouse;

DROP TEMPORARY TABLE IF EXISTS tmp_seed_delivery_employees_2026;
CREATE TEMPORARY TABLE tmp_seed_delivery_employees_2026 (
    seed_no TINYINT NOT NULL PRIMARY KEY,
    full_name VARCHAR(150) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    username VARCHAR(50) NOT NULL,
    email VARCHAR(120) NOT NULL,
    password_hash VARCHAR(200) NOT NULL
);

INSERT INTO tmp_seed_delivery_employees_2026
    (seed_no, full_name, phone, username, email, password_hash)
VALUES
    (1, 'Nguyễn Văn An',   '0990000101', 'giaohang_mau_01', 'giaohang01@example.invalid', '$2b$12$czDDvygFciFvlqHHbo94YeDNoAEXHu9S3fHbhZQ0zDycED9vf/cb2'),
    (2, 'Trần Minh Khôi', '0990000102', 'giaohang_mau_02', 'giaohang02@example.invalid', '$2b$12$iQFmAL0yBO0PAGcoAZwiHudlYTq/uo.bPx5SAEWbhOgJ74I4Y9rMu'),
    (3, 'Lê Quốc Bảo',    '0990000103', 'giaohang_mau_03', 'giaohang03@example.invalid', '$2b$12$DoJN2/Tedxw.17RwlTwM9OmKHybV/MLvu.ZIY5N3ts6YDusMbJv8K'),
    (4, 'Phạm Thị Hương', '0990000104', 'giaohang_mau_04', 'giaohang04@example.invalid', '$2b$12$Psu72bX/IrRo9YoaxAasVO0BbmxyfSwp4FWbKOsEU85dZJ9mJGvwm'),
    (5, 'Võ Hoàng Nam',   '0990000105', 'giaohang_mau_05', 'giaohang05@example.invalid', '$2b$12$0KtyjELixPo/paVyg1uCVOf6e4KXCzHijUGSihbBeff2LEpUpOllG');

-- employees.warehouse_id la FK nullable toi warehouses.id. Su dung kho trung tam
-- neu da co; neu chua co kho thi NULL hop le. Khong can tao sales_invoices:
-- sales_invoices.delivery_employee_id se tham chieu employees.id khi gan don.
SET @seed_delivery_warehouse_id = (
    SELECT id
    FROM warehouses
    WHERE LOWER(TRIM(name)) = LOWER('Kho trung tâm')
    ORDER BY id
    LIMIT 1
);

START TRANSACTION;

INSERT INTO employees
    (full_name, phone, username, email, password_hash, role,
     is_locked, is_approved, approved_at, created_at, warehouse_id)
SELECT
    t.full_name, t.phone, t.username, t.email, t.password_hash,
    'NHAN_VIEN_GIAO_HANG', 0, 1, NOW(), NOW(), @seed_delivery_warehouse_id
FROM tmp_seed_delivery_employees_2026 AS t
WHERE NOT EXISTS (
    SELECT 1
    FROM employees AS e
    WHERE e.username = t.username OR e.phone = t.phone OR e.email = t.email
);

COMMIT;

-- Ket qua mong doi: 5 dong, role NHAN_VIEN_GIAO_HANG, is_approved=1,
-- is_locked=0. Neu thieu dong, kiem tra trung username/phone/email.
SELECT
    t.seed_no, t.full_name, t.username, t.phone, t.email,
    e.id, e.role, e.is_approved, e.is_locked, e.warehouse_id
FROM tmp_seed_delivery_employees_2026 AS t
LEFT JOIN employees AS e ON e.username = t.username
ORDER BY t.seed_no;

DROP TEMPORARY TABLE tmp_seed_delivery_employees_2026;
