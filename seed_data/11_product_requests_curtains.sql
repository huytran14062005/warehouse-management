-- Phần 11: 100 yêu cầu sản phẩm rèm cửa/phụ kiện.
-- 50 yêu cầu đã hoàn thành, liên kết đúng sản phẩm thật đã có trong catalog;
-- 50 yêu cầu mới đang chờ quản lý xử lý và chưa có sản phẩm trong catalog.
-- Chỉ thêm lịch sử yêu cầu, không tạo mới hoặc sửa sản phẩm hiện có.
-- Chạy toàn bộ file trên database sau các phần trước. Chạy lại không tạo yêu cầu trùng.

SET NAMES utf8mb4;

DROP TEMPORARY TABLE IF EXISTS tmp_seed_request_new_2026;
DROP TEMPORARY TABLE IF EXISTS tmp_seed_request_specs_2026;

CREATE TEMPORARY TABLE tmp_seed_request_specs_2026 (
  request_no SMALLINT NOT NULL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  unit VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL
);

INSERT INTO tmp_seed_request_specs_2026 (request_no, name, unit, status) VALUES
  (1, 'Vải rèm cản sáng polyester màu kem khổ 2,8 m', 'Mét', 'completed'),
  (2, 'Vải rèm cản sáng polyester màu xám nhạt khổ 2,8 m', 'Mét', 'completed'),
  (3, 'Vải rèm cản sáng polyester màu xám đậm khổ 2,8 m', 'Mét', 'completed'),
  (4, 'Vải rèm cản sáng polyester màu xanh navy khổ 2,8 m', 'Mét', 'completed'),
  (5, 'Vải rèm cản sáng polyester màu xanh rêu khổ 2,8 m', 'Mét', 'completed'),
  (6, 'Vải rèm cản sáng polyester màu nâu cà phê khổ 2,8 m', 'Mét', 'completed'),
  (7, 'Vải rèm linen pha màu be khổ 2,8 m', 'Mét', 'completed'),
  (8, 'Vải rèm linen pha màu trắng ngà khổ 2,8 m', 'Mét', 'completed'),
  (9, 'Vải rèm linen pha màu xám khổ 2,8 m', 'Mét', 'completed'),
  (10, 'Vải rèm linen pha màu xanh sage khổ 2,8 m', 'Mét', 'completed'),
  (11, 'Vải rèm nhung màu đỏ đô khổ 2,8 m', 'Mét', 'completed'),
  (12, 'Vải rèm nhung màu xanh cổ vịt khổ 2,8 m', 'Mét', 'completed'),
  (13, 'Vải rèm nhung màu xám bạc khổ 2,8 m', 'Mét', 'completed'),
  (14, 'Vải rèm bố sọc be khổ 2,8 m', 'Mét', 'completed'),
  (15, 'Vải rèm bố sọc xám khổ 2,8 m', 'Mét', 'completed'),
  (16, 'Vải rèm voan trơn màu trắng khổ 2,8 m', 'Mét', 'completed'),
  (17, 'Vải rèm voan trơn màu kem khổ 2,8 m', 'Mét', 'completed'),
  (18, 'Vải rèm voan thêu lá màu trắng khổ 2,8 m', 'Mét', 'completed'),
  (19, 'Vải rèm voan thêu hoa màu kem khổ 2,8 m', 'Mét', 'completed'),
  (20, 'Vải rèm dimout màu ghi khổ 2,8 m', 'Mét', 'completed'),
  (21, 'Rèm may sẵn ore cản sáng màu kem 140 x 260 cm', 'Tấm', 'completed'),
  (22, 'Rèm may sẵn ore cản sáng màu xám 140 x 260 cm', 'Tấm', 'completed'),
  (23, 'Rèm may sẵn ore cản sáng màu xanh navy 140 x 260 cm', 'Tấm', 'completed'),
  (24, 'Rèm may sẵn ore cản sáng màu be linen 140 x 260 cm', 'Tấm', 'completed'),
  (25, 'Rèm may sẵn ore cản sáng màu nâu 140 x 260 cm', 'Tấm', 'completed'),
  (26, 'Rèm may sẵn ore cản sáng màu trắng ngà 140 x 220 cm', 'Tấm', 'completed'),
  (27, 'Rèm may sẵn ore cản sáng màu xám nhạt 140 x 220 cm', 'Tấm', 'completed'),
  (28, 'Rèm may sẵn ore cản sáng màu xanh rêu 140 x 220 cm', 'Tấm', 'completed'),
  (29, 'Rèm may sẵn ore cản sáng màu xanh ngọc 140 x 260 cm', 'Tấm', 'completed'),
  (30, 'Rèm may sẵn ore cản sáng màu xám đậm 180 x 260 cm', 'Tấm', 'completed'),
  (31, 'Rèm may sẵn ore voan trắng trơn 140 x 260 cm', 'Tấm', 'completed'),
  (32, 'Rèm may sẵn ore voan kem trơn 140 x 260 cm', 'Tấm', 'completed'),
  (33, 'Rèm may sẵn ore voan trắng thêu lá 140 x 260 cm', 'Tấm', 'completed'),
  (34, 'Rèm may sẵn ore voan kem thêu hoa 140 x 260 cm', 'Tấm', 'completed'),
  (35, 'Rèm may sẵn ore voan trắng sọc dọc 140 x 260 cm', 'Tấm', 'completed'),
  (36, 'Rèm may sẵn ore voan trắng trơn 140 x 220 cm', 'Tấm', 'completed'),
  (37, 'Rèm may sẵn ore voan kem trơn 140 x 220 cm', 'Tấm', 'completed'),
  (38, 'Rèm may sẵn ore voan trắng thêu lá 140 x 220 cm', 'Tấm', 'completed'),
  (39, 'Rèm may sẵn ore voan trắng trơn 180 x 260 cm', 'Tấm', 'completed'),
  (40, 'Rèm may sẵn ore voan kem trơn 180 x 260 cm', 'Tấm', 'completed'),
  (41, 'Rèm cuốn cản sáng màu trắng 100 x 160 cm', 'Bộ', 'completed'),
  (42, 'Rèm cuốn cản sáng màu xám 100 x 160 cm', 'Bộ', 'completed'),
  (43, 'Rèm cuốn cản sáng màu kem 120 x 180 cm', 'Bộ', 'completed'),
  (44, 'Rèm cuốn cản sáng màu ghi 120 x 180 cm', 'Bộ', 'completed'),
  (45, 'Rèm cuốn lưới xuyên sáng màu xám 100 x 160 cm', 'Bộ', 'completed'),
  (46, 'Rèm cuốn lưới xuyên sáng màu kem 120 x 180 cm', 'Bộ', 'completed'),
  (47, 'Rèm cầu vồng màu kem 100 x 160 cm', 'Bộ', 'completed'),
  (48, 'Rèm cầu vồng màu xám 100 x 160 cm', 'Bộ', 'completed'),
  (49, 'Rèm cầu vồng màu be 120 x 180 cm', 'Bộ', 'completed'),
  (50, 'Rèm cầu vồng màu ghi 120 x 180 cm', 'Bộ', 'completed'),
  (51, 'V?i r?m chenille ch?ng n?ng m?u kem s?a kh? 2,8 m', 'M?t', 'pending'),
  (52, 'V?i r?m chenille ch?ng n?ng m?u x?m kh?i kh? 2,8 m', 'M?t', 'pending'),
  (53, 'V?i r?m chenille ch?ng n?ng m?u xanh ng?c kh? 2,8 m', 'M?t', 'pending'),
  (54, 'V?i r?m chenille ch?ng n?ng m?u xanh than kh? 2,8 m', 'M?t', 'pending'),
  (55, 'V?i r?m chenille ch?ng n?ng m?u h?ng ??t kh? 2,8 m', 'M?t', 'pending'),
  (56, 'V?i r?m chenille ch?ng n?ng m?u n?u h?t d? kh? 2,8 m', 'M?t', 'pending'),
  (57, 'V?i r?m chenille ch?ng n?ng m?u v?ng c?t kh? 2,8 m', 'M?t', 'pending'),
  (58, 'V?i r?m chenille ch?ng n?ng m?u xanh olive kh? 2,8 m', 'M?t', 'pending'),
  (59, 'V?i r?m chenille ch?ng n?ng m?u ghi s?ng kh? 2,8 m', 'M?t', 'pending'),
  (60, 'V?i r?m chenille ch?ng n?ng m?u tr?ng ng? kh? 2,8 m', 'M?t', 'pending'),
  (61, 'R?m may s?n x?p ly v?i b? m?u kem s?a 160 x 240 cm', 'T?m', 'pending'),
  (62, 'R?m may s?n x?p ly v?i b? m?u x?m kh?i 160 x 240 cm', 'T?m', 'pending'),
  (63, 'R?m may s?n x?p ly v?i b? m?u xanh ng?c 160 x 240 cm', 'T?m', 'pending'),
  (64, 'R?m may s?n x?p ly v?i b? m?u xanh than 160 x 240 cm', 'T?m', 'pending'),
  (65, 'R?m may s?n x?p ly v?i b? m?u h?ng ??t 160 x 240 cm', 'T?m', 'pending'),
  (66, 'R?m may s?n x?p ly v?i b? m?u n?u h?t d? 160 x 240 cm', 'T?m', 'pending'),
  (67, 'R?m may s?n x?p ly v?i b? m?u v?ng c?t 160 x 240 cm', 'T?m', 'pending'),
  (68, 'R?m may s?n x?p ly v?i b? m?u xanh olive 160 x 240 cm', 'T?m', 'pending'),
  (69, 'R?m may s?n x?p ly v?i b? m?u ghi s?ng 160 x 240 cm', 'T?m', 'pending'),
  (70, 'R?m may s?n x?p ly v?i b? m?u tr?ng ng? 160 x 240 cm', 'T?m', 'pending'),
  (71, 'R?m c?u v?ng 2 l?p m?u kem s?a 120 x 160 cm', 'B?', 'pending'),
  (72, 'R?m c?u v?ng 2 l?p m?u x?m kh?i 120 x 160 cm', 'B?', 'pending'),
  (73, 'R?m c?u v?ng 2 l?p m?u xanh ng?c 120 x 160 cm', 'B?', 'pending'),
  (74, 'R?m c?u v?ng 2 l?p m?u xanh than 120 x 160 cm', 'B?', 'pending'),
  (75, 'R?m c?u v?ng 2 l?p m?u h?ng ??t 120 x 160 cm', 'B?', 'pending'),
  (76, 'R?m c?u v?ng 2 l?p m?u n?u h?t d? 120 x 160 cm', 'B?', 'pending'),
  (77, 'R?m c?u v?ng 2 l?p m?u v?ng c?t 120 x 160 cm', 'B?', 'pending'),
  (78, 'R?m c?u v?ng 2 l?p m?u xanh olive 120 x 160 cm', 'B?', 'pending'),
  (79, 'R?m c?u v?ng 2 l?p m?u ghi s?ng 120 x 160 cm', 'B?', 'pending'),
  (80, 'R?m c?u v?ng 2 l?p m?u tr?ng ng? 120 x 160 cm', 'B?', 'pending'),
  (81, 'Ray r?m nh?m ?m tr?n m?u tr?ng d?i 2,5 m', 'Thanh', 'pending'),
  (82, 'Ray r?m nh?m ?m tr?n m?u tr?ng d?i 3 m', 'Thanh', 'pending'),
  (83, 'Ray r?m nh?m ?m tr?n m?u ?en d?i 2,5 m', 'Thanh', 'pending'),
  (84, 'Ray r?m nh?m ?m tr?n m?u ?en d?i 3 m', 'Thanh', 'pending'),
  (85, 'Ray r?m nh?m ?m tr?n m?u b?c d?i 2,5 m', 'Thanh', 'pending'),
  (86, 'Ray r?m nh?m ?m tr?n m?u b?c d?i 3 m', 'Thanh', 'pending'),
  (87, 'Ray r?m nh?m ?m tr?n m?u v?ng ??ng d?i 2,5 m', 'Thanh', 'pending'),
  (88, 'Ray r?m nh?m ?m tr?n m?u v?ng ??ng d?i 3 m', 'Thanh', 'pending'),
  (89, 'Ray r?m nh?m ?m tr?n m?u ghi d?i 2,5 m', 'Thanh', 'pending'),
  (90, 'Ray r?m nh?m ?m tr?n m?u ghi d?i 3 m', 'Thanh', 'pending'),
  (91, 'B? ph? ki?n l?p r?m cu?n ?ng phi 38 mm m?u tr?ng', 'B?', 'pending'),
  (92, 'B? ph? ki?n l?p r?m cu?n ?ng phi 38 mm m?u ?en', 'B?', 'pending'),
  (93, 'B? ph? ki?n l?p r?m cu?n ?ng phi 38 mm m?u ghi', 'B?', 'pending'),
  (94, 'B? ph? ki?n l?p r?m cu?n ?ng phi 38 mm m?u kem', 'B?', 'pending'),
  (95, 'B? ph? ki?n l?p r?m cu?n ?ng phi 38 mm m?u b?c', 'B?', 'pending'),
  (96, 'B? ph? ki?n l?p r?m cu?n ?ng phi 45 mm m?u tr?ng', 'B?', 'pending'),
  (97, 'B? ph? ki?n l?p r?m cu?n ?ng phi 45 mm m?u ?en', 'B?', 'pending'),
  (98, 'B? ph? ki?n l?p r?m cu?n ?ng phi 45 mm m?u ghi', 'B?', 'pending'),
  (99, 'B? ph? ki?n l?p r?m cu?n ?ng phi 45 mm m?u kem', 'B?', 'pending'),
  (100, 'B? ph? ki?n l?p r?m cu?n ?ng phi 45 mm m?u b?c', 'B?', 'pending');

SET @sales_employee_id = (
  SELECT id FROM employees
  WHERE role = 'NHAN_VIEN_BAN_HANG'
    AND is_approved = 1 AND is_locked = 0
  ORDER BY id LIMIT 1
);
SET @keeper_id = (
  SELECT id FROM employees
  WHERE role = 'THU_KHO'
    AND is_approved = 1 AND is_locked = 0
  ORDER BY id LIMIT 1
);
SET @spec_count = (SELECT COUNT(*) FROM tmp_seed_request_specs_2026);
SET @completed_count = (
  SELECT COUNT(*) FROM tmp_seed_request_specs_2026 WHERE status = 'completed'
);
SET @pending_count = (
  SELECT COUNT(*) FROM tmp_seed_request_specs_2026 WHERE status = 'pending'
);
SET @matched_completed_products = (
  SELECT COUNT(*)
  FROM tmp_seed_request_specs_2026 AS spec
  JOIN products AS product ON product.name = spec.name AND product.unit = spec.unit
  WHERE spec.status = 'completed'
);
SET @pending_in_catalog = (
  SELECT COUNT(*)
  FROM tmp_seed_request_specs_2026 AS spec
  JOIN products AS product ON LOWER(product.name) = LOWER(spec.name)
  WHERE spec.status = 'pending'
);
SET @existing_pending_conflicts = (
  SELECT COUNT(*)
  FROM tmp_seed_request_specs_2026 AS spec
  JOIN product_requests AS existing
    ON LOWER(existing.name) = LOWER(spec.name)
   AND existing.status = 'pending'
   AND (existing.note IS NULL
        OR existing.note NOT LIKE '[DEMO-CURTAIN-REQUEST-%]%')
  WHERE spec.status = 'pending'
);

CREATE TEMPORARY TABLE tmp_seed_request_new_2026 (
  request_no SMALLINT NOT NULL PRIMARY KEY
);

INSERT INTO tmp_seed_request_new_2026 (request_no)
SELECT spec.request_no FROM tmp_seed_request_specs_2026 AS spec
WHERE NOT EXISTS (
  SELECT 1 FROM product_requests AS existing
  WHERE existing.note LIKE CONCAT('[DEMO-CURTAIN-REQUEST-',
                                  LPAD(spec.request_no, 3, '0'), ']%')
);

SET @new_request_count = (SELECT COUNT(*) FROM tmp_seed_request_new_2026);
SET @can_seed_requests = (
  @sales_employee_id IS NOT NULL AND @keeper_id IS NOT NULL
  AND @spec_count = 100
  AND @completed_count = 50 AND @pending_count = 50
  AND @matched_completed_products = 50
  AND @pending_in_catalog = 0
  AND @existing_pending_conflicts = 0
);

SELECT @new_request_count AS new_requests,
       @matched_completed_products AS matched_completed_products,
       @pending_in_catalog AS pending_names_already_products,
       @existing_pending_conflicts AS pending_name_conflicts,
       @can_seed_requests AS ready_to_insert;

START TRANSACTION;

INSERT INTO product_requests
  (name, unit, note, status, created_at, resolved_at,
   requested_by_employee_id, resolved_product_id)
SELECT spec.name, spec.unit,
       CONCAT('[DEMO-CURTAIN-REQUEST-', LPAD(spec.request_no, 3, '0'), '] ',
              IF(spec.status = 'completed',
                 'Đã bổ sung mẫu theo yêu cầu khách hàng',
                 'Khách hỏi mẫu mới; chờ quản lý xem xét')),
       spec.status,
       CASE WHEN spec.status = 'completed'
            THEN DATE_ADD('2025-12-20 09:00:00',
                          INTERVAL MOD(spec.request_no - 1, 10) DAY)
            ELSE DATE_ADD('2026-10-18 09:00:00',
                          INTERVAL FLOOR((spec.request_no - 51) / 4) DAY) END,
       CASE WHEN spec.status = 'completed'
            THEN DATE_ADD('2025-12-22 15:00:00',
                          INTERVAL MOD(spec.request_no - 1, 10) DAY)
            ELSE NULL END,
       IF(MOD(spec.request_no, 2) = 0, @keeper_id, @sales_employee_id),
       IF(spec.status = 'completed', product.id, NULL)
FROM tmp_seed_request_new_2026 AS pending
JOIN tmp_seed_request_specs_2026 AS spec ON spec.request_no = pending.request_no
LEFT JOIN products AS product
  ON product.name = spec.name AND product.unit = spec.unit
WHERE @can_seed_requests = 1
ORDER BY spec.request_no;

SELECT ROW_COUNT() AS product_requests_inserted_this_run;

COMMIT;

-- Lần đầu kỳ vọng: completed 50 có resolved_product_id; pending 50 chưa có.
SELECT request.status, COUNT(*) AS demo_requests,
       SUM(request.resolved_product_id IS NOT NULL) AS linked_products
FROM product_requests AS request
WHERE request.note LIKE '[DEMO-CURTAIN-REQUEST-%]%'
GROUP BY request.status
ORDER BY request.status;

DROP TEMPORARY TABLE tmp_seed_request_new_2026;
DROP TEMPORARY TABLE tmp_seed_request_specs_2026;
