-- Phần 4: 100 phiếu nhập hàng mẫu, mỗi phiếu 2 mặt hàng, cho 100 sản phẩm của phần 1.
-- Chạy toàn bộ file trên đúng database MySQL sau khi đã chạy phần 1 và phần 3.
-- Dữ liệu sẽ làm tăng tồn kho và công nợ nhà cung cấp trong báo cáo. Đây là dữ liệu mẫu.
-- Chưa ghi thanh toán; phần thanh toán nhà cung cấp sẽ thực hiện sau.
-- Không phụ thuộc ID tự tăng: tra cứu sản phẩm, nhà cung cấp, kho, nhân viên qua dữ liệu gốc.
-- Chạy lại không tạo lại phiếu/dòng hàng có cùng mã DEMO-CURTAIN-IMPORT.

SET NAMES utf8mb4;

-- Xóa bảng tạm còn sót trong phiên Workbench nếu lần chạy trước bị lỗi.
DROP TEMPORARY TABLE IF EXISTS tmp_seed_import_new_2026;
DROP TEMPORARY TABLE IF EXISTS tmp_seed_import_lines_2026;
DROP TEMPORARY TABLE IF EXISTS tmp_seed_import_products_2026;
DROP TEMPORARY TABLE IF EXISTS tmp_seed_import_suppliers_2026;

CREATE TEMPORARY TABLE tmp_seed_import_suppliers_2026 (
  seed_no SMALLINT NOT NULL PRIMARY KEY,
  name VARCHAR(255) NOT NULL
);

INSERT INTO tmp_seed_import_suppliers_2026 (seed_no, name) VALUES
  (1, 'Xưởng dệt vải rèm An Bình'),
  (2, 'Công ty vải rèm Ánh Ngọc'),
  (3, 'Xưởng dệt polyester Bảo Minh'),
  (4, 'Công ty vải nội thất Bình An'),
  (5, 'Xưởng dệt linen Cát Tường'),
  (6, 'Công ty vải rèm Đại Phúc'),
  (7, 'Xưởng dệt nhung Đông Hòa'),
  (8, 'Công ty vải chống nắng Gia Hòa'),
  (9, 'Xưởng dệt voan Hồng Phúc'),
  (10, 'Công ty vải rèm Hưng Lộc'),
  (11, 'Xưởng dệt gấm Kim Anh'),
  (12, 'Công ty vải rèm Lam Giang'),
  (13, 'Xưởng dệt vải Mộc Lan'),
  (14, 'Công ty vải nội thất Nam Khang'),
  (15, 'Xưởng dệt rèm Phúc Thịnh'),
  (16, 'Xưởng may rèm An Gia'),
  (17, 'Xưởng may rèm Bách Hợp'),
  (18, 'Công ty rèm may sẵn Bảo Châu'),
  (19, 'Xưởng may rèm Cẩm Tú'),
  (20, 'Công ty rèm thành phẩm Đại An'),
  (21, 'Xưởng may rèm Gia Phúc'),
  (22, 'Xưởng may rèm Hòa Thịnh'),
  (23, 'Công ty rèm may sẵn Khánh Minh'),
  (24, 'Xưởng may rèm Lộc Phát'),
  (25, 'Công ty rèm thành phẩm Minh Tâm'),
  (26, 'Xưởng may rèm Ngọc Hà'),
  (27, 'Xưởng may rèm Phương Nam'),
  (28, 'Công ty rèm may sẵn Quang Minh'),
  (29, 'Xưởng may rèm Tâm Phúc'),
  (30, 'Xưởng may rèm Thiên Ân'),
  (31, 'Xưởng rèm cuốn An Hòa'),
  (32, 'Công ty rèm cầu vồng Bắc Nam'),
  (33, 'Xưởng rèm sáo nhôm Bình Minh'),
  (34, 'Xưởng rèm roman Cát An'),
  (35, 'Công ty rèm cuốn Duy Phát'),
  (36, 'Xưởng rèm sáo gỗ Gia Hân'),
  (37, 'Công ty rèm cầu vồng Hòa Gia'),
  (38, 'Xưởng rèm cuốn Hồng An'),
  (39, 'Xưởng rèm sáo nhôm Khải Minh'),
  (40, 'Công ty rèm roman Lam Phương'),
  (41, 'Xưởng rèm cuốn Minh Châu'),
  (42, 'Công ty rèm cầu vồng Nam Việt'),
  (43, 'Xưởng rèm sáo gỗ Ngọc Sơn'),
  (44, 'Công ty rèm cuốn Phúc Lâm'),
  (45, 'Xưởng rèm roman Phương Anh'),
  (46, 'Xưởng rèm sáo nhôm Quang Huy'),
  (47, 'Công ty rèm cầu vồng Sơn Hà'),
  (48, 'Xưởng rèm cuốn Tân Phú'),
  (49, 'Xưởng rèm sáo gỗ Thiên Hà'),
  (50, 'Công ty rèm roman Vạn Lộc'),
  (51, 'Xưởng thanh treo rèm An Khang'),
  (52, 'Công ty ray rèm Bảo Long'),
  (53, 'Xưởng thanh treo rèm Cường Phát'),
  (54, 'Công ty ray nhôm Đại Việt'),
  (55, 'Xưởng thanh treo rèm Đông Phú'),
  (56, 'Công ty ray rèm Gia Thành'),
  (57, 'Xưởng thanh treo rèm Hoàng Gia'),
  (58, 'Công ty ray trượt Hưng Thịnh'),
  (59, 'Xưởng thanh treo rèm Kim Long'),
  (60, 'Công ty ray rèm Minh An'),
  (61, 'Xưởng giá đỡ rèm Nam Phát'),
  (62, 'Công ty ray nhôm Ngọc Phát'),
  (63, 'Xưởng thanh treo rèm Phú Khang'),
  (64, 'Công ty ray trượt Quang Lộc'),
  (65, 'Xưởng giá đỡ rèm Tân An'),
  (66, 'Công ty ray rèm Thanh Bình'),
  (67, 'Xưởng thanh treo rèm Thiên Phúc'),
  (68, 'Công ty ray nhôm Trường Giang'),
  (69, 'Xưởng giá đỡ rèm Vĩnh Hòa'),
  (70, 'Công ty ray trượt Xuân Phát'),
  (71, 'Xưởng phụ kiện rèm An Lộc'),
  (72, 'Công ty khoen rèm Bảo Phúc'),
  (73, 'Xưởng móc rèm Cát Lợi'),
  (74, 'Công ty dây buộc rèm Đông Nam'),
  (75, 'Xưởng phụ kiện rèm Gia Bảo'),
  (76, 'Công ty khoen rèm Hòa Phát Mẫu'),
  (77, 'Xưởng móc rèm Hồng Sơn'),
  (78, 'Công ty dây buộc rèm Khánh An'),
  (79, 'Xưởng phụ kiện rèm Lam Hải'),
  (80, 'Công ty khoen rèm Minh Gia'),
  (81, 'Xưởng móc rèm Nam Hòa'),
  (82, 'Công ty dây buộc rèm Ngọc Bảo'),
  (83, 'Xưởng phụ kiện rèm Phúc Hải'),
  (84, 'Công ty khoen rèm Quang Thịnh'),
  (85, 'Xưởng móc rèm Sơn Phúc'),
  (86, 'Công ty dây buộc rèm Tân Hưng'),
  (87, 'Xưởng phụ kiện rèm Thanh An'),
  (88, 'Công ty khoen rèm Thiên Lộc'),
  (89, 'Xưởng móc rèm Trường Phúc'),
  (90, 'Công ty dây buộc rèm Vạn Gia'),
  (91, 'Công ty động cơ rèm An Tín'),
  (92, 'Nhà phân phối rèm điện Bảo Khang'),
  (93, 'Công ty điều khiển rèm Gia Minh'),
  (94, 'Nhà phân phối ray điện Hưng Phát'),
  (95, 'Công ty động cơ rèm Khánh Thành'),
  (96, 'Nhà phân phối rèm điện Minh Quân'),
  (97, 'Công ty điều khiển rèm Phú An'),
  (98, 'Nhà phân phối ray điện Tâm Việt'),
  (99, 'Công ty động cơ rèm Thiên Minh'),
  (100, 'Nhà phân phối rèm điện Vĩnh Phúc');

CREATE TEMPORARY TABLE tmp_seed_import_products_2026 (
  seed_no SMALLINT NOT NULL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  sample_sale_price DECIMAL(14,2) NOT NULL
);

INSERT INTO tmp_seed_import_products_2026 (seed_no, name, sample_sale_price) VALUES
  (1, 'Vải rèm cản sáng polyester màu kem khổ 2,8 m', 280000),
  (2, 'Vải rèm cản sáng polyester màu xám nhạt khổ 2,8 m', 280000),
  (3, 'Vải rèm cản sáng polyester màu xám đậm khổ 2,8 m', 280000),
  (4, 'Vải rèm cản sáng polyester màu xanh navy khổ 2,8 m', 295000),
  (5, 'Vải rèm cản sáng polyester màu xanh rêu khổ 2,8 m', 295000),
  (6, 'Vải rèm cản sáng polyester màu nâu cà phê khổ 2,8 m', 285000),
  (7, 'Vải rèm linen pha màu be khổ 2,8 m', 340000),
  (8, 'Vải rèm linen pha màu trắng ngà khổ 2,8 m', 340000),
  (9, 'Vải rèm linen pha màu xám khổ 2,8 m', 340000),
  (10, 'Vải rèm linen pha màu xanh sage khổ 2,8 m', 360000),
  (11, 'Vải rèm nhung màu đỏ đô khổ 2,8 m', 420000),
  (12, 'Vải rèm nhung màu xanh cổ vịt khổ 2,8 m', 420000),
  (13, 'Vải rèm nhung màu xám bạc khổ 2,8 m', 420000),
  (14, 'Vải rèm bố sọc be khổ 2,8 m', 275000),
  (15, 'Vải rèm bố sọc xám khổ 2,8 m', 275000),
  (16, 'Vải rèm voan trơn màu trắng khổ 2,8 m', 125000),
  (17, 'Vải rèm voan trơn màu kem khổ 2,8 m', 125000),
  (18, 'Vải rèm voan thêu lá màu trắng khổ 2,8 m', 190000),
  (19, 'Vải rèm voan thêu hoa màu kem khổ 2,8 m', 190000),
  (20, 'Vải rèm dimout màu ghi khổ 2,8 m', 250000),
  (21, 'Rèm may sẵn ore cản sáng màu kem 140 x 260 cm', 620000),
  (22, 'Rèm may sẵn ore cản sáng màu xám 140 x 260 cm', 620000),
  (23, 'Rèm may sẵn ore cản sáng màu xanh navy 140 x 260 cm', 650000),
  (24, 'Rèm may sẵn ore cản sáng màu be linen 140 x 260 cm', 690000),
  (25, 'Rèm may sẵn ore cản sáng màu nâu 140 x 260 cm', 640000),
  (26, 'Rèm may sẵn ore cản sáng màu trắng ngà 140 x 220 cm', 560000),
  (27, 'Rèm may sẵn ore cản sáng màu xám nhạt 140 x 220 cm', 560000),
  (28, 'Rèm may sẵn ore cản sáng màu xanh rêu 140 x 220 cm', 580000),
  (29, 'Rèm may sẵn ore cản sáng màu xanh ngọc 140 x 260 cm', 650000),
  (30, 'Rèm may sẵn ore cản sáng màu xám đậm 180 x 260 cm', 780000),
  (31, 'Rèm may sẵn ore voan trắng trơn 140 x 260 cm', 320000),
  (32, 'Rèm may sẵn ore voan kem trơn 140 x 260 cm', 320000),
  (33, 'Rèm may sẵn ore voan trắng thêu lá 140 x 260 cm', 390000),
  (34, 'Rèm may sẵn ore voan kem thêu hoa 140 x 260 cm', 390000),
  (35, 'Rèm may sẵn ore voan trắng sọc dọc 140 x 260 cm', 340000),
  (36, 'Rèm may sẵn ore voan trắng trơn 140 x 220 cm', 290000),
  (37, 'Rèm may sẵn ore voan kem trơn 140 x 220 cm', 290000),
  (38, 'Rèm may sẵn ore voan trắng thêu lá 140 x 220 cm', 350000),
  (39, 'Rèm may sẵn ore voan trắng trơn 180 x 260 cm', 400000),
  (40, 'Rèm may sẵn ore voan kem trơn 180 x 260 cm', 400000),
  (41, 'Rèm cuốn cản sáng màu trắng 100 x 160 cm', 450000),
  (42, 'Rèm cuốn cản sáng màu xám 100 x 160 cm', 450000),
  (43, 'Rèm cuốn cản sáng màu kem 120 x 180 cm', 620000),
  (44, 'Rèm cuốn cản sáng màu ghi 120 x 180 cm', 620000),
  (45, 'Rèm cuốn lưới xuyên sáng màu xám 100 x 160 cm', 480000),
  (46, 'Rèm cuốn lưới xuyên sáng màu kem 120 x 180 cm', 660000),
  (47, 'Rèm cầu vồng màu kem 100 x 160 cm', 780000),
  (48, 'Rèm cầu vồng màu xám 100 x 160 cm', 780000),
  (49, 'Rèm cầu vồng màu be 120 x 180 cm', 990000),
  (50, 'Rèm cầu vồng màu ghi 120 x 180 cm', 990000),
  (51, 'Rèm roman vải linen màu trắng 100 x 160 cm', 890000),
  (52, 'Rèm roman vải linen màu xám 100 x 160 cm', 890000),
  (53, 'Rèm roman vải cản sáng màu be 120 x 180 cm', 1100000),
  (54, 'Rèm sáo nhôm lá 25 mm màu trắng 100 x 160 cm', 520000),
  (55, 'Rèm sáo nhôm lá 25 mm màu xám 100 x 160 cm', 520000),
  (56, 'Rèm sáo nhôm lá 25 mm màu đen 120 x 180 cm', 680000),
  (57, 'Rèm lá dọc màu trắng 100 x 180 cm', 490000),
  (58, 'Rèm lá dọc màu xám 120 x 180 cm', 580000),
  (59, 'Rèm tổ ong màu trắng 100 x 160 cm', 1200000),
  (60, 'Rèm tổ ong màu xám 120 x 180 cm', 1500000),
  (61, 'Ray rèm nhôm đơn màu trắng dài 1,5 m', 130000),
  (62, 'Ray rèm nhôm đơn màu trắng dài 2 m', 180000),
  (63, 'Ray rèm nhôm đơn màu trắng dài 2,5 m', 225000),
  (64, 'Ray rèm nhôm đơn màu đen dài 1,5 m', 150000),
  (65, 'Ray rèm nhôm đơn màu đen dài 2 m', 210000),
  (66, 'Ray rèm nhôm đơn màu đen dài 2,5 m', 260000),
  (67, 'Ray rèm nhôm đôi màu trắng dài 2 m', 330000),
  (68, 'Ray rèm nhôm đôi màu trắng dài 2,5 m', 400000),
  (69, 'Thanh treo rèm nhôm phi 28 mm màu bạc dài 1,5 m', 250000),
  (70, 'Thanh treo rèm nhôm phi 28 mm màu bạc dài 2 m', 290000),
  (71, 'Thanh treo rèm nhôm phi 28 mm màu bạc dài 2,5 m', 340000),
  (72, 'Thanh treo rèm nhôm phi 28 mm màu đen dài 2 m', 310000),
  (73, 'Thanh treo rèm nhôm phi 28 mm màu vàng đồng dài 2 m', 350000),
  (74, 'Ray rèm roman màu trắng dài 1,2 m', 195000),
  (75, 'Ống nhôm rèm cuốn phi 38 mm dài 2 m', 160000),
  (76, 'Trụ đỡ tường thanh rèm phi 28 mm màu bạc', 40000),
  (77, 'Trụ đỡ tường thanh rèm phi 28 mm màu đen', 40000),
  (78, 'Trụ đỡ trần ray rèm nhôm đơn màu trắng', 25000),
  (79, 'Trụ đỡ trần ray rèm nhôm đôi màu trắng', 55000),
  (80, 'Đầu chụp thanh rèm phi 28 mm màu bạc', 65000),
  (81, 'Đầu chụp thanh rèm phi 28 mm màu đen', 65000),
  (82, 'Vòng treo rèm nhựa phi 28 mm màu trắng gói 10 cái', 40000),
  (83, 'Vòng treo rèm nhựa phi 28 mm màu nâu gói 10 cái', 40000),
  (84, 'Khoen ore kim loại đường kính 40 mm gói 10 cái', 75000),
  (85, 'Móc treo rèm chữ S gói 20 cái', 35000),
  (86, 'Bi trượt ray rèm nhôm gói 20 cái', 45000),
  (87, 'Dây vén rèm bện màu be', 110000),
  (88, 'Dây vén rèm bện màu xám', 110000),
  (89, 'Móc vén rèm gắn tường màu vàng đồng', 85000),
  (90, 'Móc vén rèm gắn tường màu bạc', 85000),
  (91, 'Dây bi kéo rèm cuốn màu trắng dài 2 m', 45000),
  (92, 'Dây bi kéo rèm cuốn màu xám dài 2 m', 45000),
  (93, 'Bộ đầu kéo rèm cuốn dùng cho ống phi 38 mm', 140000),
  (94, 'Bát treo rèm cuốn dùng cho ống phi 38 mm', 55000),
  (95, 'Bộ dây kéo rèm roman tiêu chuẩn', 95000),
  (96, 'Động cơ rèm vải điện điều khiển Wi-Fi', 3200000),
  (97, 'Điều khiển từ xa rèm điện 1 kênh', 420000),
  (98, 'Điều khiển từ xa rèm điện 5 kênh', 650000),
  (99, 'Ray rèm điện màu trắng dài 2 m', 1500000),
  (100, 'Ray rèm điện màu trắng dài 3 m', 1900000);

-- Mỗi nhà cung cấp nhận đúng hai mã hàng thuộc nhóm chuyên môn tương ứng.
CREATE TEMPORARY TABLE tmp_seed_import_lines_2026 (
  invoice_no SMALLINT NOT NULL,
  line_no TINYINT NOT NULL,
  product_no SMALLINT NOT NULL,
  quantity INT NOT NULL,
  PRIMARY KEY (invoice_no, line_no)
);

INSERT INTO tmp_seed_import_lines_2026 (invoice_no, line_no, product_no, quantity)
SELECT supplier.seed_no AS invoice_no,
       line.line_no,
       CASE
         WHEN supplier.seed_no <= 15 THEN 1 + MOD((supplier.seed_no - 1) * 2 + line.line_no - 1, 20)
         WHEN supplier.seed_no <= 30 THEN 21 + MOD((supplier.seed_no - 16) * 2 + line.line_no - 1, 20)
         WHEN supplier.seed_no <= 50 THEN 41 + MOD((supplier.seed_no - 31) * 2 + line.line_no - 1, 20)
         WHEN supplier.seed_no <= 70 THEN 61 + MOD((supplier.seed_no - 51) * 2 + line.line_no - 1, 15)
         WHEN supplier.seed_no <= 90 THEN 76 + MOD((supplier.seed_no - 71) * 2 + line.line_no - 1, 20)
         ELSE 96 + MOD((supplier.seed_no - 91) * 2 + line.line_no - 1, 5)
       END AS product_no,
       CASE
         WHEN supplier.seed_no <= 15 THEN 20 + MOD(supplier.seed_no * 3 + line.line_no, 31)
         WHEN supplier.seed_no <= 30 THEN 4 + MOD(supplier.seed_no + line.line_no, 13)
         WHEN supplier.seed_no <= 50 THEN 3 + MOD(supplier.seed_no + line.line_no, 11)
         WHEN supplier.seed_no <= 70 THEN 8 + MOD(supplier.seed_no * 2 + line.line_no, 23)
         WHEN supplier.seed_no <= 90 THEN 12 + MOD(supplier.seed_no * 3 + line.line_no, 36)
         ELSE 1 + MOD(supplier.seed_no + line.line_no, 4)
       END AS quantity
FROM tmp_seed_import_suppliers_2026 AS supplier
CROSS JOIN (SELECT 1 AS line_no UNION ALL SELECT 2 AS line_no) AS line;

-- Chỉ tạo phiếu nếu có đúng 1 kho trung tâm, 1 nhân viên phù hợp,
-- 100 nhà cung cấp và 100 sản phẩm đã nhập trước đó.
SET @central_warehouse_count = (
  SELECT COUNT(*) FROM warehouses WHERE TRIM(name) = 'Kho trung tâm'
);
SET @warehouse_id = (
  SELECT MIN(id) FROM warehouses WHERE TRIM(name) = 'Kho trung tâm'
);
SET @employee_id = (
  SELECT id FROM employees
  WHERE role IN ('THU_KHO', 'QUAN_LY')
    AND is_approved = 1 AND is_locked = 0
    AND (warehouse_id = @warehouse_id OR warehouse_id IS NULL)
  ORDER BY (role = 'THU_KHO') DESC, id ASC
  LIMIT 1
);
SET @supplier_unique_count = (
  SELECT COUNT(*) FROM tmp_seed_import_suppliers_2026 AS seed
  WHERE (
    SELECT COUNT(*) FROM suppliers AS actual
    WHERE actual.name = seed.name
      AND actual.address LIKE CONCAT('Số ', 200 + seed.seed_no, ' đường Mẫu, %')
  ) = 1
);
SET @product_count = (
  SELECT COUNT(*)
  FROM tmp_seed_import_products_2026 AS seed
  JOIN products AS actual ON actual.name = seed.name
);
SET @can_seed_imports = (
  @central_warehouse_count = 1
  AND @employee_id IS NOT NULL
  AND @supplier_unique_count = 100
  AND @product_count = 100
  AND (SELECT COUNT(*) FROM tmp_seed_import_lines_2026) = 200
);

SELECT @central_warehouse_count AS central_warehouses,
       @warehouse_id AS warehouse_id,
       @employee_id AS employee_id,
       @supplier_unique_count AS matched_suppliers,
       @product_count AS matched_products,
       @can_seed_imports AS ready_to_insert;

-- Ghi nhớ phiếu chưa có trước lần chạy này; không đụng lại phiếu đã tồn tại.
CREATE TEMPORARY TABLE tmp_seed_import_new_2026 (
  seed_no SMALLINT NOT NULL PRIMARY KEY
);

INSERT INTO tmp_seed_import_new_2026 (seed_no)
SELECT seed.seed_no
FROM tmp_seed_import_suppliers_2026 AS seed
WHERE @can_seed_imports = 1
  AND NOT EXISTS (
    SELECT 1 FROM import_invoices AS previous
    WHERE previous.note = CONCAT('[DEMO-CURTAIN-IMPORT-', LPAD(seed.seed_no, 3, '0'), '] Nhập hàng mẫu')
  );

START TRANSACTION;

INSERT INTO import_invoices (imported_at, note, warehouse_id, supplier_id, employee_id)
SELECT DATE_ADD('2026-01-05 09:00:00', INTERVAL ((seed.seed_no - 1) * 3) DAY),
       CONCAT('[DEMO-CURTAIN-IMPORT-', LPAD(seed.seed_no, 3, '0'), '] Nhập hàng mẫu'),
       @warehouse_id, actual.id, @employee_id
FROM tmp_seed_import_suppliers_2026 AS seed
JOIN tmp_seed_import_new_2026 AS new_seed ON new_seed.seed_no = seed.seed_no
JOIN suppliers AS actual
  ON actual.name = seed.name
 AND actual.address LIKE CONCAT('Số ', 200 + seed.seed_no, ' đường Mẫu, %')
WHERE @can_seed_imports = 1;

SELECT ROW_COUNT() AS import_invoices_inserted_this_run;

INSERT INTO import_invoice_items (import_invoice_id, product_id, quantity, unit_price)
SELECT invoice.id, product.id, line.quantity,
       ROUND(catalog.sample_sale_price *
         CASE
           WHEN line.product_no <= 20 THEN 0.63
           WHEN line.product_no <= 40 THEN 0.67
           WHEN line.product_no <= 60 THEN 0.68
           WHEN line.product_no <= 75 THEN 0.60
           WHEN line.product_no <= 95 THEN 0.58
           ELSE 0.70
         END, -3)
FROM tmp_seed_import_lines_2026 AS line
JOIN tmp_seed_import_new_2026 AS new_seed ON new_seed.seed_no = line.invoice_no
JOIN tmp_seed_import_suppliers_2026 AS supplier_seed ON supplier_seed.seed_no = line.invoice_no
JOIN suppliers AS supplier
  ON supplier.name = supplier_seed.name
 AND supplier.address LIKE CONCAT('Số ', 200 + supplier_seed.seed_no, ' đường Mẫu, %')
JOIN import_invoices AS invoice
  ON invoice.note = CONCAT('[DEMO-CURTAIN-IMPORT-', LPAD(line.invoice_no, 3, '0'), '] Nhập hàng mẫu')
 AND invoice.supplier_id = supplier.id
 AND invoice.warehouse_id = @warehouse_id
 AND invoice.employee_id = @employee_id
JOIN tmp_seed_import_products_2026 AS catalog ON catalog.seed_no = line.product_no
JOIN products AS product ON product.name = catalog.name
WHERE @can_seed_imports = 1
  AND NOT EXISTS (
    SELECT 1 FROM import_invoice_items AS previous
    WHERE previous.import_invoice_id = invoice.id AND previous.product_id = product.id
  );

SELECT ROW_COUNT() AS import_invoice_items_inserted_this_run;
COMMIT;

-- Lần chạy đầu dự kiến: 100 phiếu, 200 dòng, 100 sản phẩm khác nhau có tồn kho.
SELECT COUNT(DISTINCT invoice.id) AS demo_import_invoices_present,
       COUNT(item.id) AS demo_import_items_present,
       COUNT(DISTINCT item.product_id) AS distinct_products_imported,
       SUM(item.quantity * item.unit_price) AS total_purchase_value_vnd
FROM import_invoices AS invoice
LEFT JOIN import_invoice_items AS item ON item.import_invoice_id = invoice.id
WHERE invoice.note LIKE '[DEMO-CURTAIN-IMPORT-%] Nhập hàng mẫu';

DROP TEMPORARY TABLE tmp_seed_import_lines_2026;
DROP TEMPORARY TABLE tmp_seed_import_new_2026;
DROP TEMPORARY TABLE tmp_seed_import_products_2026;
DROP TEMPORARY TABLE tmp_seed_import_suppliers_2026;
