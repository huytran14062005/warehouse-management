-- Phần 10: 100 phiếu báo hư rèm cửa và phụ kiện, mỗi phiếu một sản phẩm.
-- 20 phiếu từ hàng nhân viên, 80 phiếu từ kho; 40 chờ duyệt, 40 đã duyệt, 20 từ chối.
-- Phiếu từ hàng nhân viên chờ/đã duyệt trừ tồn nhân viên; phiếu từ chối được trả hàng.
-- Phiếu kho chờ/đã duyệt trừ tồn qua phép tính tồn kho của project; từ chối không trừ.
-- Chạy toàn bộ file sau phần 9. Chạy lại không tạo phiếu hoặc trừ tồn trùng.

SET NAMES utf8mb4;

DROP TEMPORARY TABLE IF EXISTS tmp_seed_damage_demand_2026;
DROP TEMPORARY TABLE IF EXISTS tmp_seed_damage_resolved_2026;
DROP TEMPORARY TABLE IF EXISTS tmp_seed_damage_new_2026;
DROP TEMPORARY TABLE IF EXISTS tmp_seed_damage_products_2026;

CREATE TEMPORARY TABLE tmp_seed_damage_products_2026 (
  seed_no SMALLINT NOT NULL PRIMARY KEY,
  name VARCHAR(255) NOT NULL
);

INSERT INTO tmp_seed_damage_products_2026 (seed_no, name) VALUES
  (1, 'Vải rèm cản sáng polyester màu kem khổ 2,8 m'),
  (2, 'Vải rèm cản sáng polyester màu xám nhạt khổ 2,8 m'),
  (3, 'Vải rèm cản sáng polyester màu xám đậm khổ 2,8 m'),
  (4, 'Vải rèm cản sáng polyester màu xanh navy khổ 2,8 m'),
  (5, 'Vải rèm cản sáng polyester màu xanh rêu khổ 2,8 m'),
  (6, 'Vải rèm cản sáng polyester màu nâu cà phê khổ 2,8 m'),
  (7, 'Vải rèm linen pha màu be khổ 2,8 m'),
  (8, 'Vải rèm linen pha màu trắng ngà khổ 2,8 m'),
  (9, 'Vải rèm linen pha màu xám khổ 2,8 m'),
  (10, 'Vải rèm linen pha màu xanh sage khổ 2,8 m'),
  (11, 'Vải rèm nhung màu đỏ đô khổ 2,8 m'),
  (12, 'Vải rèm nhung màu xanh cổ vịt khổ 2,8 m'),
  (13, 'Vải rèm nhung màu xám bạc khổ 2,8 m'),
  (14, 'Vải rèm bố sọc be khổ 2,8 m'),
  (15, 'Vải rèm bố sọc xám khổ 2,8 m'),
  (16, 'Vải rèm voan trơn màu trắng khổ 2,8 m'),
  (17, 'Vải rèm voan trơn màu kem khổ 2,8 m'),
  (18, 'Vải rèm voan thêu lá màu trắng khổ 2,8 m'),
  (19, 'Vải rèm voan thêu hoa màu kem khổ 2,8 m'),
  (20, 'Vải rèm dimout màu ghi khổ 2,8 m'),
  (21, 'Rèm may sẵn ore cản sáng màu kem 140 x 260 cm'),
  (22, 'Rèm may sẵn ore cản sáng màu xám 140 x 260 cm'),
  (23, 'Rèm may sẵn ore cản sáng màu xanh navy 140 x 260 cm'),
  (24, 'Rèm may sẵn ore cản sáng màu be linen 140 x 260 cm'),
  (25, 'Rèm may sẵn ore cản sáng màu nâu 140 x 260 cm'),
  (26, 'Rèm may sẵn ore cản sáng màu trắng ngà 140 x 220 cm'),
  (27, 'Rèm may sẵn ore cản sáng màu xám nhạt 140 x 220 cm'),
  (28, 'Rèm may sẵn ore cản sáng màu xanh rêu 140 x 220 cm'),
  (29, 'Rèm may sẵn ore cản sáng màu xanh ngọc 140 x 260 cm'),
  (30, 'Rèm may sẵn ore cản sáng màu xám đậm 180 x 260 cm'),
  (31, 'Rèm may sẵn ore voan trắng trơn 140 x 260 cm'),
  (32, 'Rèm may sẵn ore voan kem trơn 140 x 260 cm'),
  (33, 'Rèm may sẵn ore voan trắng thêu lá 140 x 260 cm'),
  (34, 'Rèm may sẵn ore voan kem thêu hoa 140 x 260 cm'),
  (35, 'Rèm may sẵn ore voan trắng sọc dọc 140 x 260 cm'),
  (36, 'Rèm may sẵn ore voan trắng trơn 140 x 220 cm'),
  (37, 'Rèm may sẵn ore voan kem trơn 140 x 220 cm'),
  (38, 'Rèm may sẵn ore voan trắng thêu lá 140 x 220 cm'),
  (39, 'Rèm may sẵn ore voan trắng trơn 180 x 260 cm'),
  (40, 'Rèm may sẵn ore voan kem trơn 180 x 260 cm'),
  (41, 'Rèm cuốn cản sáng màu trắng 100 x 160 cm'),
  (42, 'Rèm cuốn cản sáng màu xám 100 x 160 cm'),
  (43, 'Rèm cuốn cản sáng màu kem 120 x 180 cm'),
  (44, 'Rèm cuốn cản sáng màu ghi 120 x 180 cm'),
  (45, 'Rèm cuốn lưới xuyên sáng màu xám 100 x 160 cm'),
  (46, 'Rèm cuốn lưới xuyên sáng màu kem 120 x 180 cm'),
  (47, 'Rèm cầu vồng màu kem 100 x 160 cm'),
  (48, 'Rèm cầu vồng màu xám 100 x 160 cm'),
  (49, 'Rèm cầu vồng màu be 120 x 180 cm'),
  (50, 'Rèm cầu vồng màu ghi 120 x 180 cm'),
  (51, 'Rèm roman vải linen màu trắng 100 x 160 cm'),
  (52, 'Rèm roman vải linen màu xám 100 x 160 cm'),
  (53, 'Rèm roman vải cản sáng màu be 120 x 180 cm'),
  (54, 'Rèm sáo nhôm lá 25 mm màu trắng 100 x 160 cm'),
  (55, 'Rèm sáo nhôm lá 25 mm màu xám 100 x 160 cm'),
  (56, 'Rèm sáo nhôm lá 25 mm màu đen 120 x 180 cm'),
  (57, 'Rèm lá dọc màu trắng 100 x 180 cm'),
  (58, 'Rèm lá dọc màu xám 120 x 180 cm'),
  (59, 'Rèm tổ ong màu trắng 100 x 160 cm'),
  (60, 'Rèm tổ ong màu xám 120 x 180 cm'),
  (61, 'Ray rèm nhôm đơn màu trắng dài 1,5 m'),
  (62, 'Ray rèm nhôm đơn màu trắng dài 2 m'),
  (63, 'Ray rèm nhôm đơn màu trắng dài 2,5 m'),
  (64, 'Ray rèm nhôm đơn màu đen dài 1,5 m'),
  (65, 'Ray rèm nhôm đơn màu đen dài 2 m'),
  (66, 'Ray rèm nhôm đơn màu đen dài 2,5 m'),
  (67, 'Ray rèm nhôm đôi màu trắng dài 2 m'),
  (68, 'Ray rèm nhôm đôi màu trắng dài 2,5 m'),
  (69, 'Thanh treo rèm nhôm phi 28 mm màu bạc dài 1,5 m'),
  (70, 'Thanh treo rèm nhôm phi 28 mm màu bạc dài 2 m'),
  (71, 'Thanh treo rèm nhôm phi 28 mm màu bạc dài 2,5 m'),
  (72, 'Thanh treo rèm nhôm phi 28 mm màu đen dài 2 m'),
  (73, 'Thanh treo rèm nhôm phi 28 mm màu vàng đồng dài 2 m'),
  (74, 'Ray rèm roman màu trắng dài 1,2 m'),
  (75, 'Ống nhôm rèm cuốn phi 38 mm dài 2 m'),
  (76, 'Trụ đỡ tường thanh rèm phi 28 mm màu bạc'),
  (77, 'Trụ đỡ tường thanh rèm phi 28 mm màu đen'),
  (78, 'Trụ đỡ trần ray rèm nhôm đơn màu trắng'),
  (79, 'Trụ đỡ trần ray rèm nhôm đôi màu trắng'),
  (80, 'Đầu chụp thanh rèm phi 28 mm màu bạc'),
  (81, 'Đầu chụp thanh rèm phi 28 mm màu đen'),
  (82, 'Vòng treo rèm nhựa phi 28 mm màu trắng gói 10 cái'),
  (83, 'Vòng treo rèm nhựa phi 28 mm màu nâu gói 10 cái'),
  (84, 'Khoen ore kim loại đường kính 40 mm gói 10 cái'),
  (85, 'Móc treo rèm chữ S gói 20 cái'),
  (86, 'Bi trượt ray rèm nhôm gói 20 cái'),
  (87, 'Dây vén rèm bện màu be'),
  (88, 'Dây vén rèm bện màu xám'),
  (89, 'Móc vén rèm gắn tường màu vàng đồng'),
  (90, 'Móc vén rèm gắn tường màu bạc'),
  (91, 'Dây bi kéo rèm cuốn màu trắng dài 2 m'),
  (92, 'Dây bi kéo rèm cuốn màu xám dài 2 m'),
  (93, 'Bộ đầu kéo rèm cuốn dùng cho ống phi 38 mm'),
  (94, 'Bát treo rèm cuốn dùng cho ống phi 38 mm'),
  (95, 'Bộ dây kéo rèm roman tiêu chuẩn'),
  (96, 'Động cơ rèm vải điện điều khiển Wi-Fi'),
  (97, 'Điều khiển từ xa rèm điện 1 kênh'),
  (98, 'Điều khiển từ xa rèm điện 5 kênh'),
  (99, 'Ray rèm điện màu trắng dài 2 m'),
  (100, 'Ray rèm điện màu trắng dài 3 m');

SET @central_warehouse_count = (
  SELECT COUNT(*) FROM warehouses WHERE TRIM(name) = 'Kho trung tâm'
);
SET @warehouse_id = (
  SELECT MIN(id) FROM warehouses WHERE TRIM(name) = 'Kho trung tâm'
);
SET @keeper_id = (
  SELECT id FROM employees
  WHERE role = 'THU_KHO' AND is_approved = 1 AND is_locked = 0
    AND (warehouse_id = @warehouse_id OR warehouse_id IS NULL)
  ORDER BY id LIMIT 1
);
SET @manager_id = (
  SELECT id FROM employees
  WHERE role = 'QUAN_LY' AND is_approved = 1 AND is_locked = 0
  ORDER BY id LIMIT 1
);
SET @catalog_count = (SELECT COUNT(*) FROM tmp_seed_damage_products_2026);
SET @matched_products = (
  SELECT COUNT(*) FROM tmp_seed_damage_products_2026 AS seed
  JOIN products AS product ON product.name = seed.name
);
SET @field_sales_count = (
  SELECT COUNT(*) FROM sales_invoices
  WHERE note LIKE '[DEMO-CURTAIN-FIELD-SALE-%]%'
    AND sale_source = 'EMPLOYEE_STOCK' AND status = 'COMPLETED'
);

CREATE TEMPORARY TABLE tmp_seed_damage_new_2026 (
  report_no SMALLINT NOT NULL PRIMARY KEY
);

INSERT INTO tmp_seed_damage_new_2026 (report_no)
SELECT seed.seed_no FROM tmp_seed_damage_products_2026 AS seed
WHERE NOT EXISTS (
  SELECT 1 FROM damage_reports AS report
  WHERE report.note LIKE CONCAT('[DEMO-CURTAIN-DAMAGE-',
                                LPAD(seed.seed_no, 3, '0'), ']%')
);

SET @new_report_count = (SELECT COUNT(*) FROM tmp_seed_damage_new_2026);

-- Sản phẩm 1–20 là vải đã cấp 2 m, đã bán 1 m, còn 1 m ở nhân viên.
-- Các sản phẩm 21–100 báo hư từ lượng hàng còn ở kho trung tâm.
CREATE TEMPORARY TABLE tmp_seed_damage_resolved_2026 (
  report_no SMALLINT NOT NULL PRIMARY KEY,
  product_id INT NOT NULL,
  reporter_id INT NOT NULL,
  warehouse_id INT NOT NULL,
  stock_source VARCHAR(20) NOT NULL,
  stock_before INT NULL,
  status VARCHAR(20) NOT NULL,
  reported_at DATETIME NOT NULL,
  reviewed_at DATETIME NULL,
  note VARCHAR(255) NOT NULL,
  review_note VARCHAR(255) NULL
);

INSERT INTO tmp_seed_damage_resolved_2026
  (report_no, product_id, reporter_id, warehouse_id, stock_source,
   stock_before, status, reported_at, reviewed_at, note, review_note)
SELECT seed.seed_no, product.id,
       IF(seed.seed_no <= 20, assigned.employee_id, @keeper_id),
       @warehouse_id,
       IF(seed.seed_no <= 20, 'employee', 'warehouse'),
       IF(seed.seed_no <= 20, stock.quantity, NULL),
       CASE MOD(seed.seed_no, 5)
         WHEN 0 THEN 'REJECTED' WHEN 1 THEN 'PENDING'
         WHEN 2 THEN 'PENDING' ELSE 'APPROVED' END,
       DATE_ADD('2026-10-29 08:00:00',
         INTERVAL (FLOOR((seed.seed_no - 1) / 50) * 24
                   + MOD(seed.seed_no - 1, 10)) HOUR),
       CASE WHEN MOD(seed.seed_no, 5) IN (1, 2) THEN NULL
            ELSE DATE_ADD('2026-10-29 08:00:00',
              INTERVAL (FLOOR((seed.seed_no - 1) / 50) * 24
                        + MOD(seed.seed_no - 1, 10) + 3) HOUR) END,
       CONCAT('[DEMO-CURTAIN-DAMAGE-', LPAD(seed.seed_no, 3, '0'), '] ',
         CASE
           WHEN seed.seed_no <= 20 THEN 'Vải có vết bẩn cần kiểm tra'
           WHEN seed.seed_no <= 40 THEN 'Đường may rèm bị sổ chỉ'
           WHEN seed.seed_no <= 60 THEN 'Bộ rèm bị lệch lá hoặc kẹt cơ cấu kéo'
           WHEN seed.seed_no <= 75 THEN 'Ray hoặc thanh treo bị cong'
           WHEN seed.seed_no <= 95 THEN 'Phụ kiện bị trầy xước hoặc móp'
           ELSE 'Thiết bị rèm điện cần kiểm tra hoạt động' END),
       CASE MOD(seed.seed_no, 5)
         WHEN 0 THEN 'Từ chối: kiểm tra lại thấy sản phẩm vẫn dùng được'
         WHEN 3 THEN 'Đã xác nhận hư hỏng và ghi nhận hao hụt'
         WHEN 4 THEN 'Đã xác nhận hư hỏng và ghi nhận hao hụt'
         ELSE NULL END
FROM tmp_seed_damage_new_2026 AS pending
JOIN tmp_seed_damage_products_2026 AS seed ON seed.seed_no = pending.report_no
JOIN products AS product ON product.name = seed.name
LEFT JOIN (
  SELECT item.product_id, transfer.employee_id
  FROM stock_transfer_items AS item
  JOIN stock_transfers AS transfer ON transfer.id = item.stock_transfer_id
  WHERE transfer.note LIKE '[DEMO-CURTAIN-TRANSFER-%]%'
) AS assigned ON assigned.product_id = product.id
LEFT JOIN employee_stocks AS stock ON stock.employee_id = assigned.employee_id
  AND stock.product_id = product.id
WHERE seed.seed_no > 20 OR assigned.employee_id IS NOT NULL;

SET @resolved_count = (SELECT COUNT(*) FROM tmp_seed_damage_resolved_2026);
SET @field_shortages = (
  SELECT COUNT(*) FROM tmp_seed_damage_resolved_2026 AS row_data
  WHERE row_data.stock_source = 'employee'
    AND COALESCE(row_data.stock_before, 0) < 1
);
SET @invalid_reporters = (
  SELECT COUNT(*) FROM tmp_seed_damage_resolved_2026 AS row_data
  JOIN employees AS employee ON employee.id = row_data.reporter_id
  WHERE employee.is_approved != 1 OR employee.is_locked != 0
     OR (row_data.stock_source = 'employee'
         AND (employee.role != 'NHAN_VIEN_BAN_HANG'
              OR row_data.stock_before IS NULL))
     OR (row_data.stock_source = 'warehouse'
         AND employee.role != 'THU_KHO')
);

-- Chỉ kiểm tra tồn kho cho phiếu mới chờ duyệt hoặc đã duyệt.
CREATE TEMPORARY TABLE tmp_seed_damage_demand_2026 (
  product_id INT NOT NULL PRIMARY KEY,
  quantity INT NOT NULL
);

INSERT INTO tmp_seed_damage_demand_2026 (product_id, quantity)
SELECT row_data.product_id, COUNT(*)
FROM tmp_seed_damage_resolved_2026 AS row_data
WHERE row_data.stock_source = 'warehouse' AND row_data.status != 'REJECTED'
GROUP BY row_data.product_id;

SET @warehouse_shortages = (
  SELECT COUNT(*)
  FROM tmp_seed_damage_demand_2026 AS demand
  LEFT JOIN (
    SELECT item.product_id, SUM(item.quantity) AS qty
    FROM import_invoice_items AS item
    JOIN import_invoices AS invoice ON invoice.id = item.import_invoice_id
    WHERE invoice.warehouse_id = @warehouse_id
    GROUP BY item.product_id
  ) AS imported ON imported.product_id = demand.product_id
  LEFT JOIN (
    SELECT item.product_id, SUM(item.quantity) AS qty
    FROM sales_invoice_items AS item
    JOIN sales_invoices AS invoice ON invoice.id = item.sales_invoice_id
    WHERE invoice.warehouse_id = @warehouse_id
      AND invoice.sale_source = 'CENTRAL_WAREHOUSE'
      AND invoice.status IN ('PROCESSING', 'DELIVERING', 'COMPLETED')
    GROUP BY item.product_id
  ) AS sold ON sold.product_id = demand.product_id
  LEFT JOIN (
    SELECT item.product_id, SUM(item.quantity) AS qty
    FROM stock_transfer_items AS item
    JOIN stock_transfers AS transfer ON transfer.id = item.stock_transfer_id
    WHERE transfer.warehouse_id = @warehouse_id
    GROUP BY item.product_id
  ) AS transferred ON transferred.product_id = demand.product_id
  LEFT JOIN (
    SELECT item.product_id, SUM(item.quantity) AS qty
    FROM damage_report_items AS item
    JOIN damage_reports AS report ON report.id = item.damage_report_id
    JOIN employees AS reporter ON reporter.id = report.reported_by_employee_id
    WHERE report.warehouse_id = @warehouse_id
      AND report.status != 'REJECTED'
      AND reporter.role != 'NHAN_VIEN_BAN_HANG'
    GROUP BY item.product_id
  ) AS damaged ON damaged.product_id = demand.product_id
  WHERE demand.quantity > COALESCE(imported.qty, 0) - COALESCE(sold.qty, 0)
    - COALESCE(transferred.qty, 0) - COALESCE(damaged.qty, 0)
);

SET @can_seed_damage = (
  @central_warehouse_count = 1
  AND @keeper_id IS NOT NULL AND @manager_id IS NOT NULL
  AND @catalog_count = 100 AND @matched_products = 100
  AND @field_sales_count = 100
  AND @resolved_count = @new_report_count
  AND @field_shortages = 0 AND @warehouse_shortages = 0
  AND @invalid_reporters = 0
);

SELECT @new_report_count AS new_reports,
       @resolved_count AS resolved_reports,
       @field_shortages AS field_shortages,
       @warehouse_shortages AS warehouse_shortages,
       @can_seed_damage AS ready_to_insert;

START TRANSACTION;

INSERT INTO damage_reports
  (reported_at, reviewed_at, status, note, review_note,
   warehouse_id, reported_by_employee_id, reviewed_by_employee_id)
SELECT row_data.reported_at, row_data.reviewed_at,
       row_data.status, row_data.note, row_data.review_note,
       row_data.warehouse_id, row_data.reporter_id,
       IF(row_data.status = 'PENDING', NULL, @manager_id)
FROM tmp_seed_damage_resolved_2026 AS row_data
WHERE @can_seed_damage = 1
ORDER BY row_data.report_no;

SELECT ROW_COUNT() AS damage_reports_inserted_this_run;

INSERT INTO damage_report_items (damage_report_id, product_id, quantity)
SELECT report.id, row_data.product_id, 1
FROM tmp_seed_damage_resolved_2026 AS row_data
JOIN damage_reports AS report
  ON report.note LIKE CONCAT('[DEMO-CURTAIN-DAMAGE-',
                             LPAD(row_data.report_no, 3, '0'), ']%')
WHERE @can_seed_damage = 1;

SELECT ROW_COUNT() AS damage_items_inserted_this_run;

-- Khi tạo phiếu hàng nhân viên, tồn được trừ ngay. Phiếu từ chối được hoàn lại,
-- nên kết quả sau khi xét duyệt chỉ trừ phiếu chờ và đã duyệt.
UPDATE employee_stocks AS stock
JOIN tmp_seed_damage_resolved_2026 AS row_data
  ON row_data.reporter_id = stock.employee_id
  AND row_data.product_id = stock.product_id
SET stock.quantity = stock.quantity - 1,
    stock.updated_at = NOW()
WHERE @can_seed_damage = 1
  AND row_data.stock_source = 'employee'
  AND row_data.status != 'REJECTED'
  AND stock.id > 0;

SELECT ROW_COUNT() AS employee_stock_rows_decremented;

COMMIT;

-- Lần đầu kỳ vọng: 100 phiếu, 100 dòng; PENDING 40, APPROVED 40, REJECTED 20.
SELECT report.status, COUNT(*) AS reports,
       SUM(IF(reporter.role = 'NHAN_VIEN_BAN_HANG', 1, 0)) AS employee_reports,
       SUM(IF(reporter.role = 'THU_KHO', 1, 0)) AS warehouse_reports
FROM damage_reports AS report
JOIN employees AS reporter ON reporter.id = report.reported_by_employee_id
WHERE report.note LIKE '[DEMO-CURTAIN-DAMAGE-%]%'
GROUP BY report.status
ORDER BY report.status;

SELECT COUNT(DISTINCT report.id) AS demo_damage_reports_present,
       COUNT(item.id) AS demo_damage_items_present
FROM damage_reports AS report
LEFT JOIN damage_report_items AS item ON item.damage_report_id = report.id
WHERE report.note LIKE '[DEMO-CURTAIN-DAMAGE-%]%';

DROP TEMPORARY TABLE tmp_seed_damage_demand_2026;
DROP TEMPORARY TABLE tmp_seed_damage_resolved_2026;
DROP TEMPORARY TABLE tmp_seed_damage_new_2026;
DROP TEMPORARY TABLE tmp_seed_damage_products_2026;
