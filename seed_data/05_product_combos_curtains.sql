-- Phần 5: 25 combo rèm cửa mẫu, tổng 100 dòng sản phẩm đi kèm.
-- Chạy toàn bộ file trên đúng database MySQL sau phần 1 và phần 4.
-- Combo chỉ là gợi ý khi lập đơn; không tự tạo đơn, không trừ kho, không đổi giá bán.
-- Tên combo có tiền tố DEMO để nhận diện dữ liệu mẫu.
-- Chạy lại không sửa combo đã có; không tạo dòng mới cho combo đã tồn tại.

SET NAMES utf8mb4;

-- Tương đương hai bảng mà ProductComboService tự khởi tạo khi mở tính năng.
CREATE TABLE IF NOT EXISTS product_combos (
  id INT NOT NULL AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_product_combos_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS product_combo_items (
  id INT NOT NULL AUTO_INCREMENT,
  combo_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity INT NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_product_combo_item (combo_id, product_id),
  KEY ix_product_combo_items_combo_id (combo_id),
  KEY ix_product_combo_items_product_id (product_id),
  CONSTRAINT fk_product_combo_items_combo FOREIGN KEY (combo_id)
    REFERENCES product_combos (id) ON DELETE CASCADE,
  CONSTRAINT fk_product_combo_items_product FOREIGN KEY (product_id)
    REFERENCES products (id) ON DELETE RESTRICT,
  CONSTRAINT ck_product_combo_item_quantity CHECK (quantity > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TEMPORARY TABLE IF EXISTS tmp_seed_combo_new_2026;
DROP TEMPORARY TABLE IF EXISTS tmp_seed_combo_items_2026;
DROP TEMPORARY TABLE IF EXISTS tmp_seed_combo_products_2026;
DROP TEMPORARY TABLE IF EXISTS tmp_seed_combo_specs_2026;

CREATE TEMPORARY TABLE tmp_seed_combo_products_2026 (
  seed_no SMALLINT NOT NULL PRIMARY KEY,
  name VARCHAR(255) NOT NULL
);

INSERT INTO tmp_seed_combo_products_2026 (seed_no, name) VALUES
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

CREATE TEMPORARY TABLE tmp_seed_combo_specs_2026 (
  combo_no SMALLINT NOT NULL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  p1 SMALLINT NOT NULL, q1 INT NOT NULL,
  p2 SMALLINT NOT NULL, q2 INT NOT NULL,
  p3 SMALLINT NOT NULL, q3 INT NOT NULL,
  p4 SMALLINT NOT NULL, q4 INT NOT NULL
);

INSERT INTO tmp_seed_combo_specs_2026
  (combo_no, name, p1, q1, p2, q2, p3, q3, p4, q4) VALUES
  -- Vải rèm + voan/ray hoặc thanh treo + phụ kiện (8)
  (1, '[DEMO] Rèm vải kem hai lớp 2 m', 1, 6, 16, 5, 67, 1, 86, 2),
  (2, '[DEMO] Rèm vải xám hai lớp 2 m', 2, 6, 17, 5, 67, 1, 86, 2),
  (3, '[DEMO] Rèm vải xanh navy hai lớp 2,5 m', 4, 7, 16, 6, 68, 1, 86, 2),
  (4, '[DEMO] Rèm linen be hai lớp 2 m', 7, 6, 17, 5, 67, 1, 86, 2),
  (5, '[DEMO] Rèm linen trắng ngà hai lớp 2,5 m', 8, 7, 18, 6, 68, 1, 86, 2),
  (6, '[DEMO] Rèm nhung đỏ đô 2 m', 11, 6, 70, 1, 76, 2, 87, 1),
  (7, '[DEMO] Rèm nhung xanh cổ vịt 2 m', 12, 6, 72, 1, 77, 2, 88, 1),
  (8, '[DEMO] Rèm dimout ghi ray đơn 2 m', 20, 6, 62, 1, 78, 2, 86, 2),

  -- Rèm may sẵn ore + thanh treo + trụ + đầu chụp (8)
  (9, '[DEMO] Rèm may sẵn cản sáng kem 2 tấm', 21, 2, 70, 1, 76, 2, 80, 1),
  (10, '[DEMO] Rèm may sẵn cản sáng xám 2 tấm', 22, 2, 72, 1, 77, 2, 81, 1),
  (11, '[DEMO] Rèm may sẵn cản sáng navy 2 tấm', 23, 2, 70, 1, 76, 2, 80, 1),
  (12, '[DEMO] Rèm may sẵn linen be 2 tấm', 24, 2, 73, 1, 76, 2, 80, 1),
  (13, '[DEMO] Rèm may sẵn cản sáng nâu 2 tấm', 25, 2, 72, 1, 77, 2, 81, 1),
  (14, '[DEMO] Rèm may sẵn trắng ngà cao 220 cm', 26, 2, 70, 1, 76, 2, 80, 1),
  (15, '[DEMO] Rèm voan trắng may sẵn 2 tấm', 31, 2, 70, 1, 76, 2, 80, 1),
  (16, '[DEMO] Rèm voan kem may sẵn 2 tấm', 32, 2, 73, 1, 76, 2, 80, 1),

  -- Bộ rèm cuốn/roman kèm linh kiện lắp và linh kiện dự phòng (5)
  (17, '[DEMO] Rèm cuốn trắng kèm phụ kiện dự phòng', 41, 1, 94, 1, 91, 1, 93, 1),
  (18, '[DEMO] Rèm cuốn xám kèm phụ kiện dự phòng', 42, 1, 94, 1, 92, 1, 93, 1),
  (19, '[DEMO] Rèm cuốn kem 120 cm kèm phụ kiện', 43, 1, 94, 1, 91, 1, 93, 1),
  (20, '[DEMO] Rèm roman linen trắng kèm ray', 51, 1, 74, 1, 95, 1, 78, 2),
  (21, '[DEMO] Rèm roman linen xám kèm ray', 52, 1, 74, 1, 95, 1, 78, 2),

  -- Rèm điện: động cơ + ray điện + điều khiển + vải rèm (4)
  (22, '[DEMO] Rèm điện kem ray 2 m', 96, 1, 99, 1, 97, 1, 1, 6),
  (23, '[DEMO] Rèm điện xám ray 2 m', 96, 1, 99, 1, 98, 1, 2, 6),
  (24, '[DEMO] Rèm điện navy ray 3 m', 96, 1, 100, 1, 97, 1, 4, 8),
  (25, '[DEMO] Rèm điện linen be ray 3 m', 96, 1, 100, 1, 98, 1, 7, 8);

CREATE TEMPORARY TABLE tmp_seed_combo_items_2026 (
  combo_no SMALLINT NOT NULL,
  line_no TINYINT NOT NULL,
  product_no SMALLINT NOT NULL,
  quantity INT NOT NULL,
  PRIMARY KEY (combo_no, line_no)
);

INSERT INTO tmp_seed_combo_items_2026 (combo_no, line_no, product_no, quantity)
SELECT spec.combo_no, line.line_no,
       CASE line.line_no WHEN 1 THEN spec.p1 WHEN 2 THEN spec.p2 WHEN 3 THEN spec.p3 ELSE spec.p4 END,
       CASE line.line_no WHEN 1 THEN spec.q1 WHEN 2 THEN spec.q2 WHEN 3 THEN spec.q3 ELSE spec.q4 END
FROM tmp_seed_combo_specs_2026 AS spec
CROSS JOIN (
  SELECT 1 AS line_no UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
) AS line;

SET @combo_products_found = (
  SELECT COUNT(*) FROM tmp_seed_combo_products_2026 AS seed
  JOIN products AS actual ON actual.name = seed.name
);
SET @combo_duplicate_lines = (
  SELECT COUNT(*) FROM (
    SELECT combo_no, product_no
    FROM tmp_seed_combo_items_2026
    GROUP BY combo_no, product_no HAVING COUNT(*) > 1
  ) AS duplicate_rows
);
-- MySQL không cho đọc cùng một bảng tạm hai lần trong một câu lệnh SET.
SET @combo_specs_count = (SELECT COUNT(*) FROM tmp_seed_combo_specs_2026);
SET @combo_lines_count = (SELECT COUNT(*) FROM tmp_seed_combo_items_2026);
SET @combo_invalid_qty_count = (
  SELECT COUNT(*) FROM tmp_seed_combo_items_2026 WHERE quantity <= 0
);
SET @can_seed_combos = (
  @combo_specs_count = 25
  AND @combo_lines_count = 100
  AND @combo_products_found = 100
  AND @combo_duplicate_lines = 0
  AND @combo_invalid_qty_count = 0
);

SELECT @combo_products_found AS matched_products,
       @combo_duplicate_lines AS duplicate_products_within_combo,
       @can_seed_combos AS ready_to_insert;

CREATE TEMPORARY TABLE tmp_seed_combo_new_2026 (
  combo_no SMALLINT NOT NULL PRIMARY KEY
);

INSERT INTO tmp_seed_combo_new_2026 (combo_no)
SELECT seed.combo_no FROM tmp_seed_combo_specs_2026 AS seed
WHERE @can_seed_combos = 1
  AND NOT EXISTS (SELECT 1 FROM product_combos AS actual WHERE actual.name = seed.name);

START TRANSACTION;

INSERT INTO product_combos (name)
SELECT seed.name FROM tmp_seed_combo_specs_2026 AS seed
JOIN tmp_seed_combo_new_2026 AS new_seed ON new_seed.combo_no = seed.combo_no
ORDER BY seed.combo_no;

SELECT ROW_COUNT() AS combos_inserted_this_run;

INSERT INTO product_combo_items (combo_id, product_id, quantity)
SELECT combo.id, product.id, line.quantity
FROM tmp_seed_combo_items_2026 AS line
JOIN tmp_seed_combo_new_2026 AS new_seed ON new_seed.combo_no = line.combo_no
JOIN tmp_seed_combo_specs_2026 AS spec ON spec.combo_no = line.combo_no
JOIN product_combos AS combo ON combo.name = spec.name
JOIN tmp_seed_combo_products_2026 AS catalog ON catalog.seed_no = line.product_no
JOIN products AS product ON product.name = catalog.name;

SELECT ROW_COUNT() AS combo_items_inserted_this_run;
COMMIT;

-- Lần chạy đầu dự kiến: 25 combo, 100 dòng hàng.
SELECT COUNT(DISTINCT combo.id) AS demo_combos_present,
       COUNT(item.id) AS demo_combo_items_present
FROM product_combos AS combo
LEFT JOIN product_combo_items AS item ON item.combo_id = combo.id
WHERE combo.name LIKE '[DEMO] %';

DROP TEMPORARY TABLE tmp_seed_combo_new_2026;
DROP TEMPORARY TABLE tmp_seed_combo_items_2026;
DROP TEMPORARY TABLE tmp_seed_combo_products_2026;
DROP TEMPORARY TABLE tmp_seed_combo_specs_2026;
