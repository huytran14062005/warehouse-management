-- Phần 9: 100 đơn bán trực tiếp từ hàng đã cấp cho nhân viên tại phần 8.
-- Mỗi đơn bán một mặt hàng, một đơn vị; 100 sản phẩm thật và 100 khách hàng mẫu.
-- Luồng hàng nhân viên trong project hoàn thành đơn ngay lúc tạo, trừ tồn nhân viên,
-- ghi công nợ nếu chưa thu. Phần này không cần chạy thành công file thu tiền phần 7.
-- Chạy toàn bộ file trên database đã chạy xong phần 8. Chạy lại không tạo đơn trùng.

SET NAMES utf8mb4;

DROP TEMPORARY TABLE IF EXISTS tmp_seed_field_new_2026;
DROP TEMPORARY TABLE IF EXISTS tmp_seed_field_resolved_2026;
DROP TEMPORARY TABLE IF EXISTS tmp_seed_field_products_2026;

CREATE TEMPORARY TABLE tmp_seed_field_products_2026 (
  seed_no SMALLINT NOT NULL PRIMARY KEY,
  name VARCHAR(255) NOT NULL
);

INSERT INTO tmp_seed_field_products_2026 (seed_no, name) VALUES
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

CREATE TEMPORARY TABLE tmp_seed_field_new_2026 (
  sale_no SMALLINT NOT NULL PRIMARY KEY
);

INSERT INTO tmp_seed_field_new_2026 (sale_no)
SELECT seed.seed_no FROM tmp_seed_field_products_2026 AS seed
WHERE NOT EXISTS (
  SELECT 1 FROM sales_invoices AS invoice
  WHERE invoice.note LIKE CONCAT('[DEMO-CURTAIN-FIELD-SALE-', LPAD(seed.seed_no, 3, '0'), ']%')
);

SET @central_warehouse_count = (
  SELECT COUNT(*) FROM warehouses WHERE TRIM(name) = 'Kho trung tâm'
);
SET @warehouse_id = (
  SELECT MIN(id) FROM warehouses WHERE TRIM(name) = 'Kho trung tâm'
);
SET @catalog_count = (SELECT COUNT(*) FROM tmp_seed_field_products_2026);
SET @matched_products = (
  SELECT COUNT(*)
  FROM tmp_seed_field_products_2026 AS seed
  JOIN products AS product ON product.name = seed.name
);
SET @demo_transfer_count = (
  SELECT COUNT(*) FROM stock_transfers
  WHERE note LIKE '[DEMO-CURTAIN-TRANSFER-%]%'
);
SET @demo_transfer_lines = (
  SELECT COUNT(*) FROM stock_transfer_items AS item
  JOIN stock_transfers AS transfer ON transfer.id = item.stock_transfer_id
  WHERE transfer.note LIKE '[DEMO-CURTAIN-TRANSFER-%]%'
);
SET @new_sale_count = (SELECT COUNT(*) FROM tmp_seed_field_new_2026);

-- Gắn từng sản phẩm với đúng nhân viên đã nhận hàng ở phần 8.
-- Ngày bán 26–30/10/2026 luôn sau ngày cấp hàng 16–25/10/2026.
CREATE TEMPORARY TABLE tmp_seed_field_resolved_2026 (
  sale_no SMALLINT NOT NULL PRIMARY KEY,
  product_id INT NOT NULL,
  customer_id INT NOT NULL,
  sales_area_id INT NOT NULL,
  employee_id INT NOT NULL,
  warehouse_id INT NOT NULL,
  stock_before INT NOT NULL,
  transferred_at DATETIME NOT NULL,
  sold_at DATETIME NOT NULL,
  due_at DATE NOT NULL,
  unit_price DECIMAL(14,2) NOT NULL
);

INSERT INTO tmp_seed_field_resolved_2026
  (sale_no, product_id, customer_id, sales_area_id, employee_id,
   warehouse_id, stock_before, transferred_at, sold_at, due_at, unit_price)
SELECT seed.seed_no, product.id, customer.id, customer.sales_area_id,
       transfer.employee_id, transfer.warehouse_id, stock.quantity,
       transfer.transferred_at,
       DATE_ADD('2026-10-26 09:00:00',
         INTERVAL (FLOOR((seed.seed_no - 1) / 20) * 24 + MOD(seed.seed_no - 1, 20) DIV 4) HOUR),
       DATE_ADD('2026-10-26',
         INTERVAL (FLOOR((seed.seed_no - 1) / 20) +
           CASE MOD(seed.seed_no, 3) WHEN 0 THEN 7 WHEN 1 THEN 14 ELSE 30 END) DAY),
       ROUND(product.default_sale_price *
         CASE MOD(seed.seed_no, 5)
           WHEN 0 THEN 0.95 WHEN 1 THEN 1.00 WHEN 2 THEN 1.05
           WHEN 3 THEN 0.98 ELSE 1.02 END, -3)
FROM tmp_seed_field_new_2026 AS pending
JOIN tmp_seed_field_products_2026 AS seed ON seed.seed_no = pending.sale_no
JOIN products AS product ON product.name = seed.name
JOIN customers AS customer
  ON customer.phone = CONCAT('090000', LPAD(1000 + seed.seed_no, 4, '0'))
JOIN stock_transfer_items AS transfer_item ON transfer_item.product_id = product.id
JOIN stock_transfers AS transfer ON transfer.id = transfer_item.stock_transfer_id
  AND transfer.note LIKE '[DEMO-CURTAIN-TRANSFER-%]%'
  AND transfer.warehouse_id = @warehouse_id
JOIN employee_stocks AS stock
  ON stock.employee_id = transfer.employee_id AND stock.product_id = product.id;

SET @resolved_count = (SELECT COUNT(*) FROM tmp_seed_field_resolved_2026);
SET @invalid_rows = (
  SELECT COUNT(*) FROM tmp_seed_field_resolved_2026 AS row_data
  JOIN employees AS employee ON employee.id = row_data.employee_id
  WHERE row_data.stock_before < 1
     OR row_data.sales_area_id IS NULL
     OR row_data.transferred_at >= row_data.sold_at
     OR row_data.unit_price < 500
     OR employee.role != 'NHAN_VIEN_BAN_HANG'
     OR employee.is_approved != 1 OR employee.is_locked != 0
);
SET @can_seed_field_sales = (
  @central_warehouse_count = 1
  AND @catalog_count = 100
  AND @matched_products = 100
  AND @demo_transfer_count = 20
  AND @demo_transfer_lines = 100
  AND @resolved_count = @new_sale_count
  AND @invalid_rows = 0
);

SELECT @new_sale_count AS new_sales,
       @resolved_count AS resolved_sales,
       @invalid_rows AS invalid_rows,
       @can_seed_field_sales AS ready_to_insert;

START TRANSACTION;

INSERT INTO sales_invoices (
  sold_at, note, status, cancel_requested, discount_amount, discount_status,
  sale_source, payment_status, paid_amount, payment_due_date,
  warehouse_id, customer_id, employee_id, sales_area_id
)
SELECT row_data.sold_at,
       CONCAT('[DEMO-CURTAIN-FIELD-SALE-', LPAD(row_data.sale_no, 3, '0'),
              '] Bán trực tiếp từ hàng nhân viên'),
       'COMPLETED', 0, 0, 'NO_DISCOUNT',
       'EMPLOYEE_STOCK', 'UNPAID', 0, row_data.due_at,
       row_data.warehouse_id, row_data.customer_id,
       row_data.employee_id, row_data.sales_area_id
FROM tmp_seed_field_resolved_2026 AS row_data
WHERE @can_seed_field_sales = 1
ORDER BY row_data.sale_no;

SELECT ROW_COUNT() AS field_sales_inserted_this_run;

INSERT INTO sales_invoice_items
  (sales_invoice_id, product_id, quantity, unit_price)
SELECT invoice.id, row_data.product_id, 1, row_data.unit_price
FROM tmp_seed_field_resolved_2026 AS row_data
JOIN sales_invoices AS invoice
  ON invoice.note LIKE CONCAT('[DEMO-CURTAIN-FIELD-SALE-',
                              LPAD(row_data.sale_no, 3, '0'), ']%')
WHERE @can_seed_field_sales = 1;

SELECT ROW_COUNT() AS field_sale_items_inserted_this_run;

-- Ghi nợ đúng giá trị các đơn mới; đơn đã có trước lần chạy này không được cộng lại.
UPDATE customers AS customer
JOIN (
  SELECT row_data.customer_id, SUM(row_data.unit_price) AS amount_due
  FROM tmp_seed_field_resolved_2026 AS row_data
  WHERE @can_seed_field_sales = 1
  GROUP BY row_data.customer_id
) AS debt ON debt.customer_id = customer.id
SET customer.debt_amount = customer.debt_amount + debt.amount_due
WHERE customer.id > 0;

SELECT ROW_COUNT() AS customers_with_new_debt;

-- Mỗi đơn bán một đơn vị từ tồn của đúng nhân viên đã nhận hàng.
UPDATE employee_stocks AS stock
JOIN tmp_seed_field_resolved_2026 AS row_data
  ON row_data.employee_id = stock.employee_id
  AND row_data.product_id = stock.product_id
SET stock.quantity = stock.quantity - 1,
    stock.updated_at = NOW()
WHERE @can_seed_field_sales = 1 AND stock.id > 0;

SELECT ROW_COUNT() AS employee_stock_rows_decremented;

COMMIT;

-- Lần đầu kỳ vọng: 100 đơn bán, 100 dòng hàng, 100 đơn vị từ hàng nhân viên.
SELECT COUNT(DISTINCT invoice.id) AS demo_field_sales_present,
       COUNT(item.id) AS demo_field_sale_items_present,
       COALESCE(SUM(item.quantity), 0) AS total_units_sold,
       COALESCE(SUM(item.quantity * item.unit_price), 0) AS total_revenue
FROM sales_invoices AS invoice
LEFT JOIN sales_invoice_items AS item ON item.sales_invoice_id = invoice.id
WHERE invoice.note LIKE '[DEMO-CURTAIN-FIELD-SALE-%]%';

DROP TEMPORARY TABLE tmp_seed_field_resolved_2026;
DROP TEMPORARY TABLE tmp_seed_field_new_2026;
DROP TEMPORARY TABLE tmp_seed_field_products_2026;
