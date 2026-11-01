-- Phần 8: 20 phiếu cấp hàng cho nhân viên bán hàng, 100 dòng sản phẩm.
-- Chạy toàn bộ file trên đúng database MySQL sau phần 4 và phần 6.
-- Dùng hàng đã nhập: 100 sản phẩm mỗi loại được cấp một lần, tổng 140 đơn vị.
-- Có 2 nhân viên bán hàng thì chia xen kẽ; nếu chỉ có 1 người thì cấp cho người đó.
-- Ghi cùng lúc phiếu, dòng hàng và tồn hàng nhân viên. Chạy lại không cấp trùng.
-- Không phụ thuộc các biên nhận thanh toán của phần 7.

SET NAMES utf8mb4;

DROP TEMPORARY TABLE IF EXISTS tmp_seed_transfer_demand_2026;
DROP TEMPORARY TABLE IF EXISTS tmp_seed_transfer_new_2026;
DROP TEMPORARY TABLE IF EXISTS tmp_seed_transfer_items_2026;
DROP TEMPORARY TABLE IF EXISTS tmp_seed_transfer_products_2026;
DROP TEMPORARY TABLE IF EXISTS tmp_seed_transfer_specs_2026;

CREATE TEMPORARY TABLE tmp_seed_transfer_products_2026 (
  seed_no SMALLINT NOT NULL PRIMARY KEY,
  name VARCHAR(255) NOT NULL
);

INSERT INTO tmp_seed_transfer_products_2026 (seed_no, name) VALUES
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

CREATE TEMPORARY TABLE tmp_seed_transfer_specs_2026 (
  transfer_no SMALLINT NOT NULL PRIMARY KEY
);

INSERT INTO tmp_seed_transfer_specs_2026 (transfer_no) VALUES
  (1),
  (2),
  (3),
  (4),
  (5),
  (6),
  (7),
  (8),
  (9),
  (10),
  (11),
  (12),
  (13),
  (14),
  (15),
  (16),
  (17),
  (18),
  (19),
  (20);

CREATE TEMPORARY TABLE tmp_seed_transfer_items_2026 (
  transfer_no SMALLINT NOT NULL,
  line_no TINYINT NOT NULL,
  product_no SMALLINT NOT NULL,
  quantity INT NOT NULL,
  PRIMARY KEY (transfer_no, line_no)
);

-- Mỗi phiếu 5 mặt hàng; vải 2 mét, phụ kiện 2 đơn vị, các nhóm khác 1 đơn vị.
INSERT INTO tmp_seed_transfer_items_2026 (transfer_no, line_no, product_no, quantity)
SELECT spec.transfer_no, line.line_no,
       (spec.transfer_no - 1) * 5 + line.line_no AS product_no,
       CASE
         WHEN (spec.transfer_no - 1) * 5 + line.line_no <= 20 THEN 2
         WHEN (spec.transfer_no - 1) * 5 + line.line_no BETWEEN 76 AND 95 THEN 2
         ELSE 1
       END AS quantity
FROM tmp_seed_transfer_specs_2026 AS spec
CROSS JOIN (
  SELECT 1 AS line_no UNION ALL SELECT 2 UNION ALL SELECT 3
  UNION ALL SELECT 4 UNION ALL SELECT 5
) AS line;

SET @central_warehouse_count = (SELECT COUNT(*) FROM warehouses WHERE TRIM(name) = 'Kho trung tâm');
SET @warehouse_id = (SELECT MIN(id) FROM warehouses WHERE TRIM(name) = 'Kho trung tâm');
SET @keeper_id = (
  SELECT id FROM employees
  WHERE role = 'THU_KHO' AND is_approved = 1 AND is_locked = 0
    AND (warehouse_id = @warehouse_id OR warehouse_id IS NULL)
  ORDER BY id LIMIT 1
);
SET @recipient_1 = (
  SELECT id FROM employees
  WHERE role = 'NHAN_VIEN_BAN_HANG' AND is_approved = 1 AND is_locked = 0
    AND (warehouse_id = @warehouse_id OR warehouse_id IS NULL)
  ORDER BY id LIMIT 1
);
SET @recipient_2 = (
  SELECT id FROM employees
  WHERE role = 'NHAN_VIEN_BAN_HANG' AND is_approved = 1 AND is_locked = 0
    AND (warehouse_id = @warehouse_id OR warehouse_id IS NULL)
  ORDER BY id LIMIT 1 OFFSET 1
);
SET @recipient_2 = COALESCE(@recipient_2, @recipient_1);

-- Danh sách chưa có trước lần chạy này; nếu chạy lại sẽ không cấp thêm hàng.
CREATE TEMPORARY TABLE tmp_seed_transfer_new_2026 (
  transfer_no SMALLINT NOT NULL PRIMARY KEY
);

INSERT INTO tmp_seed_transfer_new_2026 (transfer_no)
SELECT spec.transfer_no FROM tmp_seed_transfer_specs_2026 AS spec
WHERE NOT EXISTS (
  SELECT 1 FROM stock_transfers AS actual
  WHERE actual.note LIKE CONCAT('[DEMO-CURTAIN-TRANSFER-', LPAD(spec.transfer_no, 3, '0'), ']%')
);

CREATE TEMPORARY TABLE tmp_seed_transfer_demand_2026 (
  product_no SMALLINT NOT NULL PRIMARY KEY,
  quantity INT NOT NULL
);

INSERT INTO tmp_seed_transfer_demand_2026 (product_no, quantity)
SELECT item.product_no, SUM(item.quantity)
FROM tmp_seed_transfer_items_2026 AS item
JOIN tmp_seed_transfer_new_2026 AS new_seed ON new_seed.transfer_no = item.transfer_no
GROUP BY item.product_no;

SET @matched_products = (
  SELECT COUNT(*) FROM tmp_seed_transfer_products_2026 AS seed
  JOIN products AS actual ON actual.name = seed.name
);
SET @transfer_count = (SELECT COUNT(*) FROM tmp_seed_transfer_specs_2026);
SET @transfer_line_count = (SELECT COUNT(*) FROM tmp_seed_transfer_items_2026);
SET @new_transfer_count = (SELECT COUNT(*) FROM tmp_seed_transfer_new_2026);
SET @invalid_lines = (
  SELECT COUNT(*) FROM tmp_seed_transfer_items_2026
  WHERE quantity <= 0 OR product_no NOT BETWEEN 1 AND 100
);

-- Chỉ cấp nếu sau đơn bán, hàng hư và phiếu cấp cũ vẫn còn đủ tồn kho.
SET @stock_shortages = (
  SELECT COUNT(*)
  FROM tmp_seed_transfer_demand_2026 AS demand
  JOIN tmp_seed_transfer_products_2026 AS catalog ON catalog.seed_no = demand.product_no
  JOIN products AS product ON product.name = catalog.name
  LEFT JOIN (
    SELECT item.product_id, SUM(item.quantity) AS qty
    FROM import_invoice_items AS item
    JOIN import_invoices AS invoice ON invoice.id = item.import_invoice_id
    WHERE invoice.warehouse_id = @warehouse_id
    GROUP BY item.product_id
  ) AS imported ON imported.product_id = product.id
  LEFT JOIN (
    SELECT item.product_id, SUM(item.quantity) AS qty
    FROM sales_invoice_items AS item
    JOIN sales_invoices AS invoice ON invoice.id = item.sales_invoice_id
    WHERE invoice.warehouse_id = @warehouse_id
      AND invoice.sale_source = 'CENTRAL_WAREHOUSE'
      AND invoice.status IN ('PROCESSING', 'DELIVERING', 'COMPLETED')
    GROUP BY item.product_id
  ) AS sold ON sold.product_id = product.id
  LEFT JOIN (
    SELECT item.product_id, SUM(item.quantity) AS qty
    FROM stock_transfer_items AS item
    JOIN stock_transfers AS transfer ON transfer.id = item.stock_transfer_id
    WHERE transfer.warehouse_id = @warehouse_id
    GROUP BY item.product_id
  ) AS transferred ON transferred.product_id = product.id
  LEFT JOIN (
    SELECT item.product_id, SUM(item.quantity) AS qty
    FROM damage_report_items AS item
    JOIN damage_reports AS report ON report.id = item.damage_report_id
    JOIN employees AS reporter ON reporter.id = report.reported_by_employee_id
    WHERE report.warehouse_id = @warehouse_id
      AND report.status != 'REJECTED'
      AND reporter.role != 'NHAN_VIEN_BAN_HANG'
    GROUP BY item.product_id
  ) AS damaged ON damaged.product_id = product.id
  WHERE demand.quantity > COALESCE(imported.qty, 0) - COALESCE(sold.qty, 0)
    - COALESCE(transferred.qty, 0) - COALESCE(damaged.qty, 0)
);

SET @can_seed_transfers = (
  @central_warehouse_count = 1
  AND @keeper_id IS NOT NULL
  AND @recipient_1 IS NOT NULL
  AND @recipient_2 IS NOT NULL
  AND @matched_products = 100
  AND @transfer_count = 20
  AND @transfer_line_count = 100
  AND @invalid_lines = 0
  AND @stock_shortages = 0
);

SELECT @recipient_1 AS sales_employee_1,
       @recipient_2 AS sales_employee_2,
       @new_transfer_count AS new_transfers,
       @matched_products AS matched_products,
       @stock_shortages AS stock_shortages,
       @can_seed_transfers AS ready_to_insert;

START TRANSACTION;

INSERT INTO stock_transfers
  (transferred_at, note, warehouse_id, employee_id, created_by_employee_id)
SELECT DATE_ADD(
         DATE_ADD('2026-10-16 08:30:00', INTERVAL FLOOR((spec.transfer_no - 1) / 2) DAY),
         INTERVAL IF(MOD(spec.transfer_no, 2) = 0, 4, 0) HOUR
       ),
       CONCAT('[DEMO-CURTAIN-TRANSFER-', LPAD(spec.transfer_no, 3, '0'), '] Cấp hàng rèm mẫu'),
       @warehouse_id,
       IF(MOD(spec.transfer_no, 2) = 1, @recipient_1, @recipient_2),
       @keeper_id
FROM tmp_seed_transfer_specs_2026 AS spec
JOIN tmp_seed_transfer_new_2026 AS new_seed ON new_seed.transfer_no = spec.transfer_no
WHERE @can_seed_transfers = 1
ORDER BY spec.transfer_no;

SELECT ROW_COUNT() AS transfers_inserted_this_run;

INSERT INTO stock_transfer_items (stock_transfer_id, product_id, quantity)
SELECT transfer.id, product.id, item.quantity
FROM tmp_seed_transfer_items_2026 AS item
JOIN tmp_seed_transfer_new_2026 AS new_seed ON new_seed.transfer_no = item.transfer_no
JOIN stock_transfers AS transfer
  ON transfer.note LIKE CONCAT('[DEMO-CURTAIN-TRANSFER-', LPAD(item.transfer_no, 3, '0'), ']%')
JOIN tmp_seed_transfer_products_2026 AS catalog ON catalog.seed_no = item.product_no
JOIN products AS product ON product.name = catalog.name
WHERE @can_seed_transfers = 1;

SELECT ROW_COUNT() AS transfer_items_inserted_this_run;

-- Cùng lượng đã cấp phải nằm trong employee_stocks của đúng người nhận.
INSERT INTO employee_stocks (employee_id, product_id, quantity, updated_at)
SELECT transfer.employee_id, product.id, item.quantity, NOW()
FROM tmp_seed_transfer_items_2026 AS item
JOIN tmp_seed_transfer_new_2026 AS new_seed ON new_seed.transfer_no = item.transfer_no
JOIN stock_transfers AS transfer
  ON transfer.note LIKE CONCAT('[DEMO-CURTAIN-TRANSFER-', LPAD(item.transfer_no, 3, '0'), ']%')
JOIN tmp_seed_transfer_products_2026 AS catalog ON catalog.seed_no = item.product_no
JOIN products AS product ON product.name = catalog.name
WHERE @can_seed_transfers = 1
ON DUPLICATE KEY UPDATE
  quantity = employee_stocks.quantity + VALUES(quantity),
  updated_at = NOW();

COMMIT;

-- Dự kiến lần đầu: 20 phiếu, 100 dòng và 140 đơn vị cấp cho nhân viên.
SELECT COUNT(DISTINCT transfer.id) AS demo_transfers_present,
       COUNT(item.id) AS demo_transfer_items_present,
       SUM(item.quantity) AS total_units_issued
FROM stock_transfers AS transfer
LEFT JOIN stock_transfer_items AS item ON item.stock_transfer_id = transfer.id
WHERE transfer.note LIKE '[DEMO-CURTAIN-TRANSFER-%]%';

DROP TEMPORARY TABLE tmp_seed_transfer_demand_2026;
DROP TEMPORARY TABLE tmp_seed_transfer_new_2026;
DROP TEMPORARY TABLE tmp_seed_transfer_items_2026;
DROP TEMPORARY TABLE tmp_seed_transfer_products_2026;
DROP TEMPORARY TABLE tmp_seed_transfer_specs_2026;
