-- 5 nhan vien giao hang mau cho database MySQL cua ban deploy.
-- Giong cac file seed_data khac: ket noi dung MySQL va chon schema deploy
-- lam default schema trong Workbench (double-click ten schema) truoc khi chay.
-- KHONG dung USE managewarehouse: ten do chi thuoc database local.
-- Dam bao schema deploy da co NHAN_VIEN_GIAO_HANG trong employees.role
-- va cac cot phuc vu luong giao hang truoc khi import file nay.
-- Chay lai khong tao trung hoac sua tai khoan da ton tai.
-- Password hash duoc tao bang bcrypt 12 rounds cua project; mat khau goc
-- duoc cung cap rieng cho nguoi import, khong luu trong file SQL.

SET NAMES utf8mb4;

-- Ket qua phai la ten schema cua ban deploy, khong duoc la NULL/local.
SELECT DATABASE() AS target_database;

DROP TEMPORARY TABLE IF EXISTS tmp_seed_delivery_employees_deploy_2026;
CREATE TEMPORARY TABLE tmp_seed_delivery_employees_deploy_2026 (
    seed_no TINYINT NOT NULL PRIMARY KEY,
    full_name VARCHAR(150) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    username VARCHAR(50) NOT NULL,
    email VARCHAR(120) NOT NULL,
    password_hash VARCHAR(200) NOT NULL
);

INSERT INTO tmp_seed_delivery_employees_deploy_2026
    (seed_no, full_name, phone, username, email, password_hash)
VALUES
    (1, 'Nguyễn Văn An',   '0990000201', 'giaohang_deploy_01', 'giaohang.deploy01@example.invalid', '$2b$12$e7yQC5ZMCH8248nJJZuZLuYmMwPlqjWpFihxTgiE8vjgiyZTkH1dO'),
    (2, 'Trần Minh Khôi', '0990000202', 'giaohang_deploy_02', 'giaohang.deploy02@example.invalid', '$2b$12$dvkU2lLQMxUYdFapzCKsaenOSDSaIuo8o71rGXePT920AqePJvyse'),
    (3, 'Lê Quốc Bảo',    '0990000203', 'giaohang_deploy_03', 'giaohang.deploy03@example.invalid', '$2b$12$Az9FlQhsnZ0HAtW3kzYpMutO3D.3qcJb68lfuhpie/yXQT1yiPpm.'),
    (4, 'Phạm Thị Hương', '0990000204', 'giaohang_deploy_04', 'giaohang.deploy04@example.invalid', '$2b$12$keU3jdRaCDPm6xKGjGIeAu3R9omuHdEKwhuXVgAT54Caghmx/6/qS'),
    (5, 'Võ Hoàng Nam',   '0990000205', 'giaohang_deploy_05', 'giaohang.deploy05@example.invalid', '$2b$12$4XemEFBlfrpWmZwriJywfO859TCHyX7S2lB07EiIya8K2wAVxbVie');

-- employees.warehouse_id la FK nullable. Neu co Kho trung tam, dung id
-- cua kho do; neu khong co, NULL van hop le.
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
FROM tmp_seed_delivery_employees_deploy_2026 AS t
WHERE NOT EXISTS (
    SELECT 1
    FROM employees AS e
    WHERE e.username = t.username OR e.phone = t.phone OR e.email = t.email
);

COMMIT;

-- Phai thay 5 dong co id, role NHAN_VIEN_GIAO_HANG,
-- is_approved=1 va is_locked=0. id NULL la do trung phone/email.
SELECT
    t.seed_no, t.full_name, t.username, t.phone, t.email,
    e.id, e.role, e.is_approved, e.is_locked, e.warehouse_id
FROM tmp_seed_delivery_employees_deploy_2026 AS t
LEFT JOIN employees AS e ON e.username = t.username
ORDER BY t.seed_no;

DROP TEMPORARY TABLE tmp_seed_delivery_employees_deploy_2026;
