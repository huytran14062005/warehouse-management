-- Phần 6: 100 đơn bán hàng mẫu gắn với khách hàng, sản phẩm và combo đã nhập.
-- Chạy toàn bộ file trên đúng database MySQL sau phần 1, 2, 4 và 5.
-- Đơn rời nháp trừ tồn kho; chỉ đơn hoàn thành chưa thu tiền làm tăng công nợ khách hàng.
-- Phần này chưa ghi thanh toán; phần sau mới tạo biên nhận và bút toán quỹ.
-- Có đơn nháp, đang xử lý, đang giao, hoàn thành, đã hủy và yêu cầu hủy chờ duyệt.
-- Chạy lại không tạo trùng hoặc sửa đơn đã tồn tại cùng mã DEMO-CURTAIN-SALE.

SET NAMES utf8mb4;

DROP TEMPORARY TABLE IF EXISTS tmp_seed_sale_new_2026;
DROP TEMPORARY TABLE IF EXISTS tmp_seed_sale_events_2026;
DROP TEMPORARY TABLE IF EXISTS tmp_seed_sale_demand_2026;
DROP TEMPORARY TABLE IF EXISTS tmp_seed_sale_items_2026;
DROP TEMPORARY TABLE IF EXISTS tmp_seed_sale_products_2026;
DROP TEMPORARY TABLE IF EXISTS tmp_seed_sale_specs_2026;

CREATE TEMPORARY TABLE tmp_seed_sale_products_2026 (
  seed_no SMALLINT NOT NULL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  sample_sale_price DECIMAL(14,2) NOT NULL
);

INSERT INTO tmp_seed_sale_products_2026 (seed_no, name, sample_sale_price) VALUES
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

CREATE TEMPORARY TABLE tmp_seed_sale_specs_2026 (
  invoice_no SMALLINT NOT NULL PRIMARY KEY,
  sold_at DATETIME NOT NULL,
  status VARCHAR(12) NOT NULL
);

INSERT INTO tmp_seed_sale_specs_2026 (invoice_no, sold_at, status) VALUES
  (1, '2026-08-25 11:00:00', 'DRAFT'),
  (2, '2026-08-25 12:00:00', 'PROCESSING'),
  (3, '2026-08-25 13:00:00', 'PROCESSING'),
  (4, '2026-08-25 14:00:00', 'DELIVERING'),
  (5, '2026-08-25 15:00:00', 'DELIVERING'),
  (6, '2026-08-25 16:00:00', 'COMPLETED'),
  (7, '2026-08-28 10:00:00', 'COMPLETED'),
  (8, '2026-08-25 11:00:00', 'COMPLETED'),
  (9, '2026-08-16 12:00:00', 'COMPLETED'),
  (10, '2026-08-16 13:00:00', 'CANCELLED'),
  (11, '2026-08-16 14:00:00', 'DRAFT'),
  (12, '2026-08-16 15:00:00', 'PROCESSING'),
  (13, '2026-08-16 16:00:00', 'PROCESSING'),
  (14, '2026-08-16 10:00:00', 'DELIVERING'),
  (15, '2026-08-16 11:00:00', 'DELIVERING'),
  (16, '2026-08-16 12:00:00', 'COMPLETED'),
  (17, '2026-09-06 13:00:00', 'COMPLETED'),
  (18, '2026-09-06 14:00:00', 'COMPLETED'),
  (19, '2026-09-06 15:00:00', 'COMPLETED'),
  (20, '2026-09-06 16:00:00', 'CANCELLED'),
  (21, '2026-09-06 10:00:00', 'DRAFT'),
  (22, '2026-10-12 11:00:00', 'PROCESSING'),
  (23, '2026-10-12 12:00:00', 'PROCESSING'),
  (24, '2026-10-15 13:00:00', 'DELIVERING'),
  (25, '2026-10-15 14:00:00', 'DELIVERING'),
  (26, '2026-03-25 15:00:00', 'COMPLETED'),
  (27, '2026-03-27 16:00:00', 'COMPLETED'),
  (28, '2026-03-29 10:00:00', 'COMPLETED'),
  (29, '2026-03-31 11:00:00', 'COMPLETED'),
  (30, '2026-04-02 12:00:00', 'CANCELLED'),
  (31, '2026-04-04 13:00:00', 'DRAFT'),
  (32, '2026-04-06 14:00:00', 'PROCESSING'),
  (33, '2026-04-08 15:00:00', 'PROCESSING'),
  (34, '2026-04-10 16:00:00', 'DELIVERING'),
  (35, '2026-04-12 10:00:00', 'DELIVERING'),
  (36, '2026-04-14 11:00:00', 'COMPLETED'),
  (37, '2026-04-16 12:00:00', 'COMPLETED'),
  (38, '2026-04-18 13:00:00', 'COMPLETED'),
  (39, '2026-04-20 14:00:00', 'COMPLETED'),
  (40, '2026-04-22 15:00:00', 'CANCELLED'),
  (41, '2026-04-24 16:00:00', 'DRAFT'),
  (42, '2026-04-26 10:00:00', 'PROCESSING'),
  (43, '2026-04-28 11:00:00', 'PROCESSING'),
  (44, '2026-04-30 12:00:00', 'DELIVERING'),
  (45, '2026-05-02 13:00:00', 'DELIVERING'),
  (46, '2026-05-04 14:00:00', 'COMPLETED'),
  (47, '2026-05-06 15:00:00', 'COMPLETED'),
  (48, '2026-05-08 16:00:00', 'COMPLETED'),
  (49, '2026-05-10 10:00:00', 'COMPLETED'),
  (50, '2026-05-12 11:00:00', 'CANCELLED'),
  (51, '2026-05-14 12:00:00', 'DRAFT'),
  (52, '2026-05-16 13:00:00', 'PROCESSING'),
  (53, '2026-05-18 14:00:00', 'PROCESSING'),
  (54, '2026-05-20 15:00:00', 'DELIVERING'),
  (55, '2026-05-22 16:00:00', 'DELIVERING'),
  (56, '2026-05-24 10:00:00', 'COMPLETED'),
  (57, '2026-05-26 11:00:00', 'COMPLETED'),
  (58, '2026-05-28 12:00:00', 'COMPLETED'),
  (59, '2026-05-30 13:00:00', 'COMPLETED'),
  (60, '2026-06-01 14:00:00', 'CANCELLED'),
  (61, '2026-06-11 15:00:00', 'DRAFT'),
  (62, '2026-06-11 16:00:00', 'PROCESSING'),
  (63, '2026-06-14 10:00:00', 'PROCESSING'),
  (64, '2026-06-14 11:00:00', 'DELIVERING'),
  (65, '2026-06-17 12:00:00', 'DELIVERING'),
  (66, '2026-06-17 13:00:00', 'COMPLETED'),
  (67, '2026-06-20 14:00:00', 'COMPLETED'),
  (68, '2026-06-20 15:00:00', 'COMPLETED'),
  (69, '2026-06-23 16:00:00', 'COMPLETED'),
  (70, '2026-06-23 10:00:00', 'CANCELLED'),
  (71, '2026-06-26 11:00:00', 'DRAFT'),
  (72, '2026-06-26 12:00:00', 'PROCESSING'),
  (73, '2026-06-29 13:00:00', 'PROCESSING'),
  (74, '2026-06-29 14:00:00', 'DELIVERING'),
  (75, '2026-07-02 15:00:00', 'DELIVERING'),
  (76, '2026-08-10 16:00:00', 'COMPLETED'),
  (77, '2026-08-10 10:00:00', 'COMPLETED'),
  (78, '2026-08-13 11:00:00', 'COMPLETED'),
  (79, '2026-08-13 12:00:00', 'COMPLETED'),
  (80, '2026-08-16 13:00:00', 'CANCELLED'),
  (81, '2026-08-16 14:00:00', 'DRAFT'),
  (82, '2026-08-19 15:00:00', 'PROCESSING'),
  (83, '2026-08-19 16:00:00', 'PROCESSING'),
  (84, '2026-08-22 10:00:00', 'DELIVERING'),
  (85, '2026-08-22 11:00:00', 'DELIVERING'),
  (86, '2026-08-25 12:00:00', 'COMPLETED'),
  (87, '2026-08-25 13:00:00', 'COMPLETED'),
  (88, '2026-08-28 14:00:00', 'COMPLETED'),
  (89, '2026-08-28 15:00:00', 'COMPLETED'),
  (90, '2026-08-31 16:00:00', 'CANCELLED'),
  (91, '2026-08-31 10:00:00', 'DRAFT'),
  (92, '2026-09-03 11:00:00', 'PROCESSING'),
  (93, '2026-09-03 12:00:00', 'PROCESSING'),
  (94, '2026-09-06 13:00:00', 'DELIVERING'),
  (95, '2026-09-06 14:00:00', 'DELIVERING'),
  (96, '2026-10-09 15:00:00', 'COMPLETED'),
  (97, '2026-10-09 16:00:00', 'COMPLETED'),
  (98, '2026-10-12 10:00:00', 'COMPLETED'),
  (99, '2026-10-12 11:00:00', 'COMPLETED'),
  (100, '2026-10-15 12:00:00', 'CANCELLED');

CREATE TEMPORARY TABLE tmp_seed_sale_items_2026 (
  invoice_no SMALLINT NOT NULL,
  line_no TINYINT NOT NULL,
  product_no SMALLINT NOT NULL,
  quantity INT NOT NULL,
  PRIMARY KEY (invoice_no, line_no)
);

INSERT INTO tmp_seed_sale_items_2026 (invoice_no, line_no, product_no, quantity) VALUES
  (1, 1, 1, 6),
  (1, 2, 16, 5),
  (1, 3, 67, 1),
  (1, 4, 86, 2),
  (2, 1, 2, 6),
  (2, 2, 17, 5),
  (2, 3, 67, 1),
  (2, 4, 86, 2),
  (3, 1, 4, 7),
  (3, 2, 16, 6),
  (3, 3, 68, 1),
  (3, 4, 86, 2),
  (4, 1, 7, 6),
  (4, 2, 17, 5),
  (4, 3, 67, 1),
  (4, 4, 86, 2),
  (5, 1, 8, 7),
  (5, 2, 18, 6),
  (5, 3, 68, 1),
  (5, 4, 86, 2),
  (6, 1, 11, 6),
  (6, 2, 70, 1),
  (6, 3, 76, 2),
  (6, 4, 87, 1),
  (7, 1, 12, 6),
  (7, 2, 72, 1),
  (7, 3, 77, 2),
  (7, 4, 88, 1),
  (8, 1, 20, 6),
  (8, 2, 62, 1),
  (8, 3, 78, 2),
  (8, 4, 86, 2),
  (9, 1, 21, 2),
  (9, 2, 70, 1),
  (9, 3, 76, 2),
  (9, 4, 80, 1),
  (10, 1, 22, 2),
  (10, 2, 72, 1),
  (10, 3, 77, 2),
  (10, 4, 81, 1),
  (11, 1, 23, 2),
  (11, 2, 70, 1),
  (11, 3, 76, 2),
  (11, 4, 80, 1),
  (12, 1, 24, 2),
  (12, 2, 73, 1),
  (12, 3, 76, 2),
  (12, 4, 80, 1),
  (13, 1, 25, 2),
  (13, 2, 72, 1),
  (13, 3, 77, 2),
  (13, 4, 81, 1),
  (14, 1, 26, 2),
  (14, 2, 70, 1),
  (14, 3, 76, 2),
  (14, 4, 80, 1),
  (15, 1, 31, 2),
  (15, 2, 70, 1),
  (15, 3, 76, 2),
  (15, 4, 80, 1),
  (16, 1, 32, 2),
  (16, 2, 73, 1),
  (16, 3, 76, 2),
  (16, 4, 80, 1),
  (17, 1, 41, 1),
  (17, 2, 94, 1),
  (17, 3, 91, 1),
  (17, 4, 93, 1),
  (18, 1, 42, 1),
  (18, 2, 94, 1),
  (18, 3, 92, 1),
  (18, 4, 93, 1),
  (19, 1, 43, 1),
  (19, 2, 94, 1),
  (19, 3, 91, 1),
  (19, 4, 93, 1),
  (20, 1, 51, 1),
  (20, 2, 74, 1),
  (20, 3, 95, 1),
  (20, 4, 78, 2),
  (21, 1, 52, 1),
  (21, 2, 74, 1),
  (21, 3, 95, 1),
  (21, 4, 78, 2),
  (22, 1, 96, 1),
  (22, 2, 99, 1),
  (22, 3, 97, 1),
  (22, 4, 1, 6),
  (23, 1, 96, 1),
  (23, 2, 99, 1),
  (23, 3, 98, 1),
  (23, 4, 2, 6),
  (24, 1, 96, 1),
  (24, 2, 100, 1),
  (24, 3, 97, 1),
  (24, 4, 4, 8),
  (25, 1, 96, 1),
  (25, 2, 100, 1),
  (25, 3, 98, 1),
  (25, 4, 7, 8),
  (26, 1, 26, 2),
  (27, 1, 27, 2),
  (28, 1, 28, 2),
  (29, 1, 29, 2),
  (30, 1, 30, 2),
  (31, 1, 31, 2),
  (32, 1, 32, 2),
  (33, 1, 33, 2),
  (34, 1, 34, 2),
  (35, 1, 35, 2),
  (36, 1, 36, 2),
  (37, 1, 37, 2),
  (38, 1, 38, 2),
  (39, 1, 39, 2),
  (40, 1, 40, 2),
  (41, 1, 41, 1),
  (42, 1, 42, 1),
  (43, 1, 43, 1),
  (44, 1, 44, 1),
  (45, 1, 45, 1),
  (46, 1, 46, 1),
  (47, 1, 47, 1),
  (48, 1, 48, 1),
  (49, 1, 49, 1),
  (50, 1, 50, 1),
  (51, 1, 51, 1),
  (52, 1, 52, 1),
  (53, 1, 53, 1),
  (54, 1, 54, 1),
  (55, 1, 55, 1),
  (56, 1, 56, 1),
  (57, 1, 57, 1),
  (58, 1, 58, 1),
  (59, 1, 59, 1),
  (60, 1, 60, 1),
  (61, 1, 61, 1),
  (62, 1, 62, 1),
  (63, 1, 63, 1),
  (64, 1, 64, 1),
  (65, 1, 65, 1),
  (66, 1, 66, 1),
  (67, 1, 67, 1),
  (68, 1, 68, 1),
  (69, 1, 69, 1),
  (70, 1, 70, 1),
  (71, 1, 71, 1),
  (72, 1, 72, 1),
  (73, 1, 73, 1),
  (74, 1, 74, 1),
  (75, 1, 75, 1),
  (76, 1, 76, 1),
  (77, 1, 77, 1),
  (78, 1, 78, 1),
  (79, 1, 79, 1),
  (80, 1, 80, 1),
  (81, 1, 81, 1),
  (82, 1, 82, 1),
  (83, 1, 83, 1),
  (84, 1, 84, 1),
  (85, 1, 85, 1),
  (86, 1, 86, 1),
  (87, 1, 87, 1),
  (88, 1, 88, 1),
  (89, 1, 89, 1),
  (90, 1, 90, 1),
  (91, 1, 91, 1),
  (92, 1, 92, 1),
  (93, 1, 93, 1),
  (94, 1, 94, 1),
  (95, 1, 95, 1),
  (96, 1, 96, 1),
  (97, 1, 97, 1),
  (98, 1, 98, 1),
  (99, 1, 99, 1),
  (100, 1, 100, 1);

-- Nhu cầu dự kiến của đơn đang xử lý, đang giao, hoàn thành. Nháp/hủy không trừ kho.
CREATE TEMPORARY TABLE tmp_seed_sale_demand_2026 (
  product_no SMALLINT NOT NULL PRIMARY KEY,
  quantity INT NOT NULL
);

INSERT INTO tmp_seed_sale_demand_2026 (product_no, quantity)
SELECT item.product_no, SUM(item.quantity)
FROM tmp_seed_sale_items_2026 AS item
JOIN tmp_seed_sale_specs_2026 AS spec ON spec.invoice_no = item.invoice_no
WHERE spec.status IN ('PROCESSING', 'DELIVERING', 'COMPLETED')
GROUP BY item.product_no;

-- Dùng nhân viên đang hoạt động và kho trung tâm đang có sẵn; không tạo tài khoản mới.
SET @central_warehouse_count = (SELECT COUNT(*) FROM warehouses WHERE TRIM(name) = 'Kho trung tâm');
SET @warehouse_id = (SELECT MIN(id) FROM warehouses WHERE TRIM(name) = 'Kho trung tâm');
SET @sales_employee_id = (
  SELECT id FROM employees WHERE role = 'NHAN_VIEN_BAN_HANG'
    AND is_approved = 1 AND is_locked = 0
    AND (warehouse_id = @warehouse_id OR warehouse_id IS NULL)
  ORDER BY id LIMIT 1
);
SET @keeper_id = (
  SELECT id FROM employees WHERE role = 'THU_KHO'
    AND is_approved = 1 AND is_locked = 0
    AND (warehouse_id = @warehouse_id OR warehouse_id IS NULL)
  ORDER BY id LIMIT 1
);
SET @accountant_id = (
  SELECT id FROM employees WHERE role = 'KE_TOAN'
    AND is_approved = 1 AND is_locked = 0
  ORDER BY id LIMIT 1
);
SET @manager_id = (
  SELECT id FROM employees WHERE role = 'QUAN_LY'
    AND is_approved = 1 AND is_locked = 0
  ORDER BY id LIMIT 1
);

SET @matched_customers = (
  SELECT COUNT(*)
  FROM tmp_seed_sale_specs_2026 AS spec
  JOIN customers AS customer
    ON customer.phone = CONCAT('090000', LPAD(1000 + spec.invoice_no, 4, '0'))
  WHERE customer.sales_area_id IS NOT NULL
);
SET @matched_products_and_prices = (
  SELECT COUNT(*)
  FROM tmp_seed_sale_products_2026 AS catalog
  JOIN products AS product ON product.name = catalog.name
    AND product.default_sale_price = catalog.sample_sale_price
);
SET @invoice_count = (SELECT COUNT(*) FROM tmp_seed_sale_specs_2026);
SET @item_count = (SELECT COUNT(*) FROM tmp_seed_sale_items_2026);
SET @duplicate_items = (
  SELECT COUNT(*) FROM (
    SELECT invoice_no, product_no
    FROM tmp_seed_sale_items_2026
    GROUP BY invoice_no, product_no HAVING COUNT(*) > 1
  ) AS duplicates_found
);
SET @invalid_items = (
  SELECT COUNT(*) FROM tmp_seed_sale_items_2026
  WHERE quantity <= 0 OR product_no NOT BETWEEN 1 AND 100
);

-- Kiểm tra tồn thực tế một cách bảo thủ trước khi tạo đơn: nhập - đơn đã trừ kho
-- - hàng đã cấp đi - hàng hư đã duyệt/đang chờ duyệt. Nếu thiếu hàng, không thêm đơn.
SET @stock_shortages = (
  SELECT COUNT(*)
  FROM tmp_seed_sale_demand_2026 AS demand
  JOIN tmp_seed_sale_products_2026 AS catalog ON catalog.seed_no = demand.product_no
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

SET @can_seed_sales = (
  @central_warehouse_count = 1
  AND @sales_employee_id IS NOT NULL
  AND @keeper_id IS NOT NULL
  AND @accountant_id IS NOT NULL
  AND @manager_id IS NOT NULL
  AND @matched_customers = 100
  AND @matched_products_and_prices = 100
  AND @invoice_count = 100
  AND @item_count = 175
  AND @duplicate_items = 0
  AND @invalid_items = 0
  AND @stock_shortages = 0
);

SELECT @matched_customers AS matched_customers,
       @matched_products_and_prices AS matched_products_and_prices,
       @stock_shortages AS stock_shortages,
       @can_seed_sales AS ready_to_insert;

-- Lưu danh sách đơn chưa từng có trước lần chạy này để không chạm đơn đã chỉnh sửa.
CREATE TEMPORARY TABLE tmp_seed_sale_new_2026 (
  invoice_no SMALLINT NOT NULL PRIMARY KEY
);

INSERT INTO tmp_seed_sale_new_2026 (invoice_no)
SELECT spec.invoice_no FROM tmp_seed_sale_specs_2026 AS spec
WHERE @can_seed_sales = 1
  AND NOT EXISTS (
    SELECT 1 FROM sales_invoices AS actual
    WHERE actual.note LIKE CONCAT('[DEMO-CURTAIN-SALE-', LPAD(spec.invoice_no, 3, '0'), ']%')
  );

CREATE TEMPORARY TABLE tmp_seed_sale_events_2026 (
  invoice_no SMALLINT NOT NULL,
  step_no TINYINT NOT NULL,
  action VARCHAR(32) NOT NULL,
  occurred_at DATETIME NOT NULL,
  PRIMARY KEY (invoice_no, step_no)
);

INSERT INTO tmp_seed_sale_events_2026 (invoice_no, step_no, action, occurred_at)
SELECT spec.invoice_no, step.step_no,
       CASE step.step_no
         WHEN 1 THEN 'submitted_to_warehouse'
         WHEN 2 THEN 'warehouse_processing'
         WHEN 3 THEN 'dispatched'
         WHEN 4 THEN 'delivery_confirmed'
         WHEN 5 THEN 'completed'
         ELSE 'cancelled'
       END,
       DATE_ADD(spec.sold_at, INTERVAL step.step_no HOUR)
FROM tmp_seed_sale_specs_2026 AS spec
CROSS JOIN (
  SELECT 1 AS step_no UNION ALL SELECT 2 UNION ALL SELECT 3
  UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6
) AS step
WHERE (step.step_no = 1 AND (spec.status IN ('PROCESSING', 'DELIVERING', 'COMPLETED')
      OR (spec.status = 'DRAFT' AND MOD(spec.invoice_no, 20) = 1)))
   OR (step.step_no = 2 AND spec.status IN ('PROCESSING', 'DELIVERING', 'COMPLETED'))
   OR (step.step_no = 3 AND spec.status IN ('DELIVERING', 'COMPLETED'))
   OR (step.step_no = 4 AND (spec.status = 'COMPLETED'
      OR (spec.status = 'DELIVERING' AND MOD(spec.invoice_no, 10) = 5)))
   OR (step.step_no = 5 AND spec.status = 'COMPLETED')
   OR (step.step_no = 6 AND spec.status = 'CANCELLED');

START TRANSACTION;

INSERT INTO sales_invoices (
  sold_at, note, status, warehouse_submitted_at, delivered_at,
  delivery_recipient, delivery_note, cancel_requested, cancel_note,
  discount_amount, discount_status, discount_note, discount_approved_by,
  sale_source, payment_status, paid_amount, payment_due_date,
  warehouse_id, customer_id, employee_id, sales_area_id
)
SELECT spec.sold_at,
       CONCAT('[DEMO-CURTAIN-SALE-', LPAD(spec.invoice_no, 3, '0'), '] ',
              IF(spec.invoice_no <= 25, 'Bán theo combo mẫu', 'Bán sản phẩm lẻ')),
       spec.status,
       CASE WHEN spec.status IN ('PROCESSING', 'DELIVERING', 'COMPLETED')
                 OR (spec.status = 'DRAFT' AND MOD(spec.invoice_no, 20) = 1)
            THEN DATE_ADD(spec.sold_at, INTERVAL 1 HOUR) ELSE NULL END,
       CASE WHEN spec.status = 'COMPLETED'
                 OR (spec.status = 'DELIVERING' AND MOD(spec.invoice_no, 10) = 5)
            THEN DATE_ADD(spec.sold_at, INTERVAL 4 HOUR) ELSE NULL END,
       CASE WHEN spec.status = 'COMPLETED'
                 OR (spec.status = 'DELIVERING' AND MOD(spec.invoice_no, 10) = 5)
            THEN LEFT(customer.full_name, 120) ELSE NULL END,
       CASE WHEN spec.status = 'COMPLETED'
                 OR (spec.status = 'DELIVERING' AND MOD(spec.invoice_no, 10) = 5)
            THEN 'Đã bàn giao đủ hàng mẫu' ELSE NULL END,
       CASE WHEN spec.status IN ('PROCESSING', 'DELIVERING')
                 AND MOD(spec.invoice_no, 20) IN (2, 4) THEN 1 ELSE 0 END,
       CASE WHEN spec.status = 'CANCELLED' THEN 'Khách hủy đơn trước khi hoàn tất giao hàng'
            WHEN spec.status IN ('PROCESSING', 'DELIVERING')
                 AND MOD(spec.invoice_no, 20) IN (2, 4)
            THEN 'Khách đề nghị hủy vì muốn đổi mẫu rèm' ELSE NULL END,
       0, 'NO_DISCOUNT', NULL, NULL,
       'CENTRAL_WAREHOUSE', 'UNPAID', 0,
       CASE WHEN spec.status = 'COMPLETED'
            THEN DATE_ADD(DATE(spec.sold_at), INTERVAL
              CASE MOD(spec.invoice_no, 3) WHEN 0 THEN 7 WHEN 1 THEN 14 ELSE 30 END DAY)
            ELSE NULL END,
       @warehouse_id, customer.id,
       IF(MOD(spec.invoice_no, 10) = 9, @manager_id, @sales_employee_id),
       customer.sales_area_id
FROM tmp_seed_sale_specs_2026 AS spec
JOIN tmp_seed_sale_new_2026 AS new_seed ON new_seed.invoice_no = spec.invoice_no
JOIN customers AS customer
  ON customer.phone = CONCAT('090000', LPAD(1000 + spec.invoice_no, 4, '0'))
ORDER BY spec.invoice_no;

SELECT ROW_COUNT() AS sales_invoices_inserted_this_run;

INSERT INTO sales_invoice_items (sales_invoice_id, product_id, quantity, unit_price)
SELECT invoice.id, product.id, item.quantity, catalog.sample_sale_price
FROM tmp_seed_sale_items_2026 AS item
JOIN tmp_seed_sale_new_2026 AS new_seed ON new_seed.invoice_no = item.invoice_no
JOIN tmp_seed_sale_specs_2026 AS spec ON spec.invoice_no = item.invoice_no
JOIN sales_invoices AS invoice
  ON invoice.note LIKE CONCAT('[DEMO-CURTAIN-SALE-', LPAD(spec.invoice_no, 3, '0'), ']%')
JOIN tmp_seed_sale_products_2026 AS catalog ON catalog.seed_no = item.product_no
JOIN products AS product ON product.name = catalog.name;

SELECT ROW_COUNT() AS sales_invoice_items_inserted_this_run;

-- Công nợ tăng đúng tổng giá trị các đơn mới hoàn thành và chưa thanh toán.
UPDATE customers AS customer
JOIN (
  SELECT invoice.customer_id, SUM(item.quantity * item.unit_price) AS amount_due
  FROM tmp_seed_sale_new_2026 AS new_seed
  JOIN tmp_seed_sale_specs_2026 AS spec ON spec.invoice_no = new_seed.invoice_no
  JOIN sales_invoices AS invoice
    ON invoice.note LIKE CONCAT('[DEMO-CURTAIN-SALE-', LPAD(spec.invoice_no, 3, '0'), ']%')
  JOIN sales_invoice_items AS item ON item.sales_invoice_id = invoice.id
  WHERE invoice.status = 'COMPLETED'
  GROUP BY invoice.customer_id
) AS debt ON debt.customer_id = customer.id
SET customer.debt_amount = customer.debt_amount + debt.amount_due
WHERE customer.id > 0;

SELECT ROW_COUNT() AS customers_with_new_debt;

INSERT INTO sales_invoice_workflow_events
  (sales_invoice_id, actor_id, action, detail, occurred_at)
SELECT invoice.id,
       CASE WHEN event.step_no IN (1, 4) THEN invoice.employee_id
            WHEN event.step_no IN (2, 3) THEN @keeper_id
            WHEN event.step_no = 5 THEN @accountant_id
            ELSE @manager_id END,
       event.action,
       IF(event.step_no = 4, LEFT(customer.full_name, 255), NULL),
       event.occurred_at
FROM tmp_seed_sale_events_2026 AS event
JOIN tmp_seed_sale_new_2026 AS new_seed ON new_seed.invoice_no = event.invoice_no
JOIN tmp_seed_sale_specs_2026 AS spec ON spec.invoice_no = event.invoice_no
JOIN sales_invoices AS invoice
  ON invoice.note LIKE CONCAT('[DEMO-CURTAIN-SALE-', LPAD(spec.invoice_no, 3, '0'), ']%')
JOIN customers AS customer ON customer.id = invoice.customer_id;

SELECT ROW_COUNT() AS workflow_events_inserted_this_run;
COMMIT;

-- Lần đầu dự kiến: 100 đơn, 175 dòng; công nợ chỉ ở 40 đơn hoàn thành.
SELECT invoice.status, COUNT(DISTINCT invoice.id) AS invoice_count,
       COUNT(item.id) AS item_count
FROM sales_invoices AS invoice
LEFT JOIN sales_invoice_items AS item ON item.sales_invoice_id = invoice.id
WHERE invoice.note LIKE '[DEMO-CURTAIN-SALE-%]%'
GROUP BY invoice.status
ORDER BY invoice.status;

SELECT COUNT(DISTINCT invoice.id) AS demo_sales_invoices_present,
       COUNT(item.id) AS demo_sales_items_present
FROM sales_invoices AS invoice
LEFT JOIN sales_invoice_items AS item ON item.sales_invoice_id = invoice.id
WHERE invoice.note LIKE '[DEMO-CURTAIN-SALE-%]%';

SELECT COUNT(*) AS demo_workflow_events_present
FROM sales_invoice_workflow_events AS event
JOIN sales_invoices AS invoice ON invoice.id = event.sales_invoice_id
WHERE invoice.note LIKE '[DEMO-CURTAIN-SALE-%]%';

DROP TEMPORARY TABLE tmp_seed_sale_new_2026;
DROP TEMPORARY TABLE tmp_seed_sale_events_2026;
DROP TEMPORARY TABLE tmp_seed_sale_demand_2026;
DROP TEMPORARY TABLE tmp_seed_sale_items_2026;
DROP TEMPORARY TABLE tmp_seed_sale_products_2026;
DROP TEMPORARY TABLE tmp_seed_sale_specs_2026;
