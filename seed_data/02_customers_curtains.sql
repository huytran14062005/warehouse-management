-- Phần 2: 100 khách hàng mẫu cho cửa hàng rèm cửa và phụ kiện.
-- Chạy toàn bộ file trong đúng database MySQL của project, sau phần 1.
-- Tên, số điện thoại và địa chỉ dưới đây là dữ liệu giả lập; không dùng để liên hệ/giao hàng thật.
-- Công nợ ban đầu bằng 0: công nợ chỉ nên phát sinh từ đơn bán và thanh toán ở các phần sau.
-- Chạy lại sẽ giữ nguyên khách hàng đã tồn tại theo số điện thoại, không sửa công nợ hiện có.

SET NAMES utf8mb4;
START TRANSACTION;

-- Ba khu vực chuẩn mà project dùng cho khách hàng và báo cáo.
INSERT INTO sales_areas (code, name, is_active) VALUES
  ('HCM', 'TP. Hồ Chí Minh', 1),
  ('HN', 'Hà Nội', 1),
  ('DN', 'Đà Nẵng', 1)
ON DUPLICATE KEY UPDATE id = id;

SET @area_hcm = (SELECT id FROM sales_areas WHERE code = 'HCM' LIMIT 1);
SET @area_hn = (SELECT id FROM sales_areas WHERE code = 'HN' LIMIT 1);
SET @area_dn = (SELECT id FROM sales_areas WHERE code = 'DN' LIMIT 1);

INSERT INTO customers (full_name, phone, address, sales_area_id, debt_amount) VALUES
  -- TP. Hồ Chí Minh: khách lẻ, cửa hàng, đơn vị thi công (40)
  ('Nguyễn Minh Anh', '0900001001', 'Số 101 đường Mẫu, Quận 1, TP. Hồ Chí Minh', @area_hcm, 0),
  ('Trần Gia Bảo', '0900001002', 'Số 102 đường Mẫu, Quận 3, TP. Hồ Chí Minh', @area_hcm, 0),
  ('Lê Ngọc Châu', '0900001003', 'Số 103 đường Mẫu, Quận 5, TP. Hồ Chí Minh', @area_hcm, 0),
  ('Phạm Hoàng Duy', '0900001004', 'Số 104 đường Mẫu, Quận 7, TP. Hồ Chí Minh', @area_hcm, 0),
  ('Võ Thanh Hà', '0900001005', 'Số 105 đường Mẫu, Quận 10, TP. Hồ Chí Minh', @area_hcm, 0),
  ('Đặng Thùy Linh', '0900001006', 'Số 106 đường Mẫu, Quận 11, TP. Hồ Chí Minh', @area_hcm, 0),
  ('Bùi Quang Huy', '0900001007', 'Số 107 đường Mẫu, Quận 12, TP. Hồ Chí Minh', @area_hcm, 0),
  ('Đỗ Minh Khang', '0900001008', 'Số 108 đường Mẫu, Quận Bình Thạnh, TP. Hồ Chí Minh', @area_hcm, 0),
  ('Ngô Phương Lan', '0900001009', 'Số 109 đường Mẫu, Quận Phú Nhuận, TP. Hồ Chí Minh', @area_hcm, 0),
  ('Hoàng Đức Long', '0900001010', 'Số 110 đường Mẫu, Quận Tân Bình, TP. Hồ Chí Minh', @area_hcm, 0),
  ('Dương Bảo Ngọc', '0900001011', 'Số 111 đường Mẫu, Quận Tân Phú, TP. Hồ Chí Minh', @area_hcm, 0),
  ('Phan Tuấn Phong', '0900001012', 'Số 112 đường Mẫu, Quận Gò Vấp, TP. Hồ Chí Minh', @area_hcm, 0),
  ('Mai Thị Quỳnh', '0900001013', 'Số 113 đường Mẫu, TP. Thủ Đức, TP. Hồ Chí Minh', @area_hcm, 0),
  ('Lý Quốc Thái', '0900001014', 'Số 114 đường Mẫu, Quận 6, TP. Hồ Chí Minh', @area_hcm, 0),
  ('Tạ Minh Trang', '0900001015', 'Số 115 đường Mẫu, Quận 8, TP. Hồ Chí Minh', @area_hcm, 0),
  ('Hồ Anh Tuấn', '0900001016', 'Số 116 đường Mẫu, Huyện Bình Chánh, TP. Hồ Chí Minh', @area_hcm, 0),
  ('Vũ Thảo Vy', '0900001017', 'Số 117 đường Mẫu, Huyện Hóc Môn, TP. Hồ Chí Minh', @area_hcm, 0),
  ('Cao Đức Việt', '0900001018', 'Số 118 đường Mẫu, Quận Bình Tân, TP. Hồ Chí Minh', @area_hcm, 0),
  ('La Mỹ Yến', '0900001019', 'Số 119 đường Mẫu, Quận 4, TP. Hồ Chí Minh', @area_hcm, 0),
  ('Lâm Nhật Nam', '0900001020', 'Số 120 đường Mẫu, TP. Thủ Đức, TP. Hồ Chí Minh', @area_hcm, 0),
  ('Cửa hàng Rèm An Nhiên', '0900001021', 'Số 121 đường Mẫu, Quận 7, TP. Hồ Chí Minh', @area_hcm, 0),
  ('Cửa hàng Rèm Ánh Dương', '0900001022', 'Số 122 đường Mẫu, Quận 3, TP. Hồ Chí Minh', @area_hcm, 0),
  ('Cửa hàng Rèm Bình Minh', '0900001023', 'Số 123 đường Mẫu, Quận Bình Thạnh, TP. Hồ Chí Minh', @area_hcm, 0),
  ('Cửa hàng Rèm Gia Phúc', '0900001024', 'Số 124 đường Mẫu, Quận Tân Bình, TP. Hồ Chí Minh', @area_hcm, 0),
  ('Cửa hàng Rèm Hương Giang', '0900001025', 'Số 125 đường Mẫu, Quận Gò Vấp, TP. Hồ Chí Minh', @area_hcm, 0),
  ('Cửa hàng Rèm Lam Sơn', '0900001026', 'Số 126 đường Mẫu, TP. Thủ Đức, TP. Hồ Chí Minh', @area_hcm, 0),
  ('Cửa hàng Rèm Minh Khuê', '0900001027', 'Số 127 đường Mẫu, Quận Phú Nhuận, TP. Hồ Chí Minh', @area_hcm, 0),
  ('Cửa hàng Rèm Phúc An', '0900001028', 'Số 128 đường Mẫu, Quận 10, TP. Hồ Chí Minh', @area_hcm, 0),
  ('Cửa hàng Rèm Thiên Thanh', '0900001029', 'Số 129 đường Mẫu, Quận 12, TP. Hồ Chí Minh', @area_hcm, 0),
  ('Cửa hàng Rèm Tường Vy', '0900001030', 'Số 130 đường Mẫu, Quận Bình Tân, TP. Hồ Chí Minh', @area_hcm, 0),
  ('Nội thất Mộc Sáng', '0900001031', 'Số 131 đường Mẫu, Quận 1, TP. Hồ Chí Minh', @area_hcm, 0),
  ('Nội thất Không Gian Xanh', '0900001032', 'Số 132 đường Mẫu, Quận 7, TP. Hồ Chí Minh', @area_hcm, 0),
  ('Nội thất Góc Nhà Êm', '0900001033', 'Số 133 đường Mẫu, Quận Tân Phú, TP. Hồ Chí Minh', @area_hcm, 0),
  ('Đội thi công Rèm Nam Sài Gòn', '0900001034', 'Số 134 đường Mẫu, Huyện Nhà Bè, TP. Hồ Chí Minh', @area_hcm, 0),
  ('Đội thi công Rèm Đông Sài Gòn', '0900001035', 'Số 135 đường Mẫu, TP. Thủ Đức, TP. Hồ Chí Minh', @area_hcm, 0),
  ('Studio Nội thất Nắng Mai', '0900001036', 'Số 136 đường Mẫu, TP. Thủ Đức, TP. Hồ Chí Minh', @area_hcm, 0),
  ('Studio Nội thất Đan Mây', '0900001037', 'Số 137 đường Mẫu, Quận 3, TP. Hồ Chí Minh', @area_hcm, 0),
  ('Cửa hàng Phụ kiện Rèm Thanh Tâm', '0900001038', 'Số 138 đường Mẫu, Quận 11, TP. Hồ Chí Minh', @area_hcm, 0),
  ('Cửa hàng Phụ kiện Rèm Minh Tâm', '0900001039', 'Số 139 đường Mẫu, Quận 6, TP. Hồ Chí Minh', @area_hcm, 0),
  ('Nội thất Căn Nhà Nhỏ', '0900001040', 'Số 140 đường Mẫu, Quận 8, TP. Hồ Chí Minh', @area_hcm, 0),

  -- Hà Nội: khách lẻ, cửa hàng, đơn vị thi công (35)
  ('Nguyễn Thu An', '0900001041', 'Số 141 đường Mẫu, Quận Ba Đình, Hà Nội', @area_hn, 0),
  ('Trần Minh Bắc', '0900001042', 'Số 142 đường Mẫu, Quận Cầu Giấy, Hà Nội', @area_hn, 0),
  ('Lê Hải Châu', '0900001043', 'Số 143 đường Mẫu, Quận Đống Đa, Hà Nội', @area_hn, 0),
  ('Phạm Thị Duyên', '0900001044', 'Số 144 đường Mẫu, Quận Hai Bà Trưng, Hà Nội', @area_hn, 0),
  ('Võ Minh Đức', '0900001045', 'Số 145 đường Mẫu, Quận Hoàn Kiếm, Hà Nội', @area_hn, 0),
  ('Đặng Khánh Hòa', '0900001046', 'Số 146 đường Mẫu, Quận Hoàng Mai, Hà Nội', @area_hn, 0),
  ('Bùi Gia Hân', '0900001047', 'Số 147 đường Mẫu, Quận Long Biên, Hà Nội', @area_hn, 0),
  ('Đỗ Quang Hưng', '0900001048', 'Số 148 đường Mẫu, Quận Nam Từ Liêm, Hà Nội', @area_hn, 0),
  ('Ngô Đức Kiên', '0900001049', 'Số 149 đường Mẫu, Quận Bắc Từ Liêm, Hà Nội', @area_hn, 0),
  ('Hoàng Mai Lan', '0900001050', 'Số 150 đường Mẫu, Quận Thanh Xuân, Hà Nội', @area_hn, 0),
  ('Dương Bảo Long', '0900001051', 'Số 151 đường Mẫu, Quận Tây Hồ, Hà Nội', @area_hn, 0),
  ('Phan Trúc Ly', '0900001052', 'Số 152 đường Mẫu, Huyện Gia Lâm, Hà Nội', @area_hn, 0),
  ('Mai Quang Minh', '0900001053', 'Số 153 đường Mẫu, Huyện Đông Anh, Hà Nội', @area_hn, 0),
  ('Lý Kim Ngân', '0900001054', 'Số 154 đường Mẫu, Quận Hà Đông, Hà Nội', @area_hn, 0),
  ('Tạ Thanh Phúc', '0900001055', 'Số 155 đường Mẫu, Huyện Thanh Trì, Hà Nội', @area_hn, 0),
  ('Hồ Thị Quyên', '0900001056', 'Số 156 đường Mẫu, Quận Cầu Giấy, Hà Nội', @area_hn, 0),
  ('Vũ Hoàng Sơn', '0900001057', 'Số 157 đường Mẫu, Quận Đống Đa, Hà Nội', @area_hn, 0),
  ('Cao Thúy Trang', '0900001058', 'Số 158 đường Mẫu, Quận Thanh Xuân, Hà Nội', @area_hn, 0),
  ('La Đức Trung', '0900001059', 'Số 159 đường Mẫu, Quận Long Biên, Hà Nội', @area_hn, 0),
  ('Lâm Ngọc Yến', '0900001060', 'Số 160 đường Mẫu, Quận Tây Hồ, Hà Nội', @area_hn, 0),
  ('Cửa hàng Rèm Bách Hợp', '0900001061', 'Số 161 đường Mẫu, Quận Cầu Giấy, Hà Nội', @area_hn, 0),
  ('Cửa hàng Rèm Cánh Sen', '0900001062', 'Số 162 đường Mẫu, Quận Hà Đông, Hà Nội', @area_hn, 0),
  ('Cửa hàng Rèm Hòa Bình', '0900001063', 'Số 163 đường Mẫu, Quận Đống Đa, Hà Nội', @area_hn, 0),
  ('Cửa hàng Rèm Kim Ngân', '0900001064', 'Số 164 đường Mẫu, Quận Hoàng Mai, Hà Nội', @area_hn, 0),
  ('Cửa hàng Rèm Mây Trắng', '0900001065', 'Số 165 đường Mẫu, Quận Ba Đình, Hà Nội', @area_hn, 0),
  ('Cửa hàng Rèm Ngọc Bích', '0900001066', 'Số 166 đường Mẫu, Quận Nam Từ Liêm, Hà Nội', @area_hn, 0),
  ('Cửa hàng Rèm Phố Nhỏ', '0900001067', 'Số 167 đường Mẫu, Quận Tây Hồ, Hà Nội', @area_hn, 0),
  ('Cửa hàng Rèm Thanh Xuân', '0900001068', 'Số 168 đường Mẫu, Quận Thanh Xuân, Hà Nội', @area_hn, 0),
  ('Cửa hàng Rèm Vạn Phúc', '0900001069', 'Số 169 đường Mẫu, Quận Hà Đông, Hà Nội', @area_hn, 0),
  ('Nội thất Gỗ và Vải', '0900001070', 'Số 170 đường Mẫu, Quận Long Biên, Hà Nội', @area_hn, 0),
  ('Nội thất Lụa Mềm', '0900001071', 'Số 171 đường Mẫu, Quận Cầu Giấy, Hà Nội', @area_hn, 0),
  ('Studio Nội thất Mộc Hà', '0900001072', 'Số 172 đường Mẫu, Quận Đống Đa, Hà Nội', @area_hn, 0),
  ('Đội thi công Rèm Tây Hà Nội', '0900001073', 'Số 173 đường Mẫu, Quận Hà Đông, Hà Nội', @area_hn, 0),
  ('Đội thi công Rèm Bắc Hà Nội', '0900001074', 'Số 174 đường Mẫu, Huyện Đông Anh, Hà Nội', @area_hn, 0),
  ('Cửa hàng Phụ kiện Rèm An Khang', '0900001075', 'Số 175 đường Mẫu, Quận Hoàng Mai, Hà Nội', @area_hn, 0),

  -- Đà Nẵng: khách lẻ, cửa hàng, đơn vị thi công (25)
  ('Nguyễn Gia An', '0900001076', 'Số 176 đường Mẫu, Quận Hải Châu, Đà Nẵng', @area_dn, 0),
  ('Trần Khánh Bình', '0900001077', 'Số 177 đường Mẫu, Quận Thanh Khê, Đà Nẵng', @area_dn, 0),
  ('Lê Ngọc Diệp', '0900001078', 'Số 178 đường Mẫu, Quận Sơn Trà, Đà Nẵng', @area_dn, 0),
  ('Phạm Đức Hải', '0900001079', 'Số 179 đường Mẫu, Quận Ngũ Hành Sơn, Đà Nẵng', @area_dn, 0),
  ('Võ Thu Hằng', '0900001080', 'Số 180 đường Mẫu, Quận Liên Chiểu, Đà Nẵng', @area_dn, 0),
  ('Đặng Minh Hiếu', '0900001081', 'Số 181 đường Mẫu, Quận Cẩm Lệ, Đà Nẵng', @area_dn, 0),
  ('Bùi Thanh Hoa', '0900001082', 'Số 182 đường Mẫu, Huyện Hòa Vang, Đà Nẵng', @area_dn, 0),
  ('Đỗ Quang Khải', '0900001083', 'Số 183 đường Mẫu, Quận Hải Châu, Đà Nẵng', @area_dn, 0),
  ('Ngô Thùy My', '0900001084', 'Số 184 đường Mẫu, Quận Sơn Trà, Đà Nẵng', @area_dn, 0),
  ('Hoàng Quốc Nam', '0900001085', 'Số 185 đường Mẫu, Quận Thanh Khê, Đà Nẵng', @area_dn, 0),
  ('Dương Bảo Nhi', '0900001086', 'Số 186 đường Mẫu, Quận Cẩm Lệ, Đà Nẵng', @area_dn, 0),
  ('Phan Thanh Phương', '0900001087', 'Số 187 đường Mẫu, Quận Ngũ Hành Sơn, Đà Nẵng', @area_dn, 0),
  ('Mai Đức Quân', '0900001088', 'Số 188 đường Mẫu, Quận Liên Chiểu, Đà Nẵng', @area_dn, 0),
  ('Lý Minh Thư', '0900001089', 'Số 189 đường Mẫu, Quận Hải Châu, Đà Nẵng', @area_dn, 0),
  ('Tạ Anh Vũ', '0900001090', 'Số 190 đường Mẫu, Quận Sơn Trà, Đà Nẵng', @area_dn, 0),
  ('Cửa hàng Rèm Biển Xanh', '0900001091', 'Số 191 đường Mẫu, Quận Sơn Trà, Đà Nẵng', @area_dn, 0),
  ('Cửa hàng Rèm Hạ Vàng', '0900001092', 'Số 192 đường Mẫu, Quận Hải Châu, Đà Nẵng', @area_dn, 0),
  ('Cửa hàng Rèm Minh Châu', '0900001093', 'Số 193 đường Mẫu, Quận Thanh Khê, Đà Nẵng', @area_dn, 0),
  ('Cửa hàng Rèm Ngũ Hành', '0900001094', 'Số 194 đường Mẫu, Quận Ngũ Hành Sơn, Đà Nẵng', @area_dn, 0),
  ('Cửa hàng Rèm Sông Hàn', '0900001095', 'Số 195 đường Mẫu, Quận Hải Châu, Đà Nẵng', @area_dn, 0),
  ('Cửa hàng Rèm Thuận Phát', '0900001096', 'Số 196 đường Mẫu, Quận Liên Chiểu, Đà Nẵng', @area_dn, 0),
  ('Nội thất Nhà Ven Biển', '0900001097', 'Số 197 đường Mẫu, Quận Sơn Trà, Đà Nẵng', @area_dn, 0),
  ('Studio Nội thất An Hải', '0900001098', 'Số 198 đường Mẫu, Quận Sơn Trà, Đà Nẵng', @area_dn, 0),
  ('Đội thi công Rèm Miền Trung', '0900001099', 'Số 199 đường Mẫu, Quận Cẩm Lệ, Đà Nẵng', @area_dn, 0),
  ('Cửa hàng Phụ kiện Rèm Hải Vân', '0900001100', 'Số 200 đường Mẫu, Quận Liên Chiểu, Đà Nẵng', @area_dn, 0)
ON DUPLICATE KEY UPDATE id = id;

-- Lần chạy đầu tiên, kết quả mong đợi là 100 (nếu chưa có số điện thoại nào trùng).
SELECT ROW_COUNT() AS customers_inserted_this_run;
COMMIT;

-- Phải ra 100 khách hàng mẫu và mỗi nhóm đúng khu vực: HCM 40, HN 35, DN 25.
SELECT sa.code AS sales_area, COUNT(*) AS customers_count
FROM customers AS c
JOIN sales_areas AS sa ON sa.id = c.sales_area_id
WHERE c.phone BETWEEN '0900001001' AND '0900001100'
GROUP BY sa.code
ORDER BY sa.code;

SELECT COUNT(*) AS demo_customers_present,
       SUM(c.debt_amount) AS total_initial_debt
FROM customers AS c
WHERE c.phone BETWEEN '0900001001' AND '0900001100';
