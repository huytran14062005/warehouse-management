-- Phần 3: 100 nhà cung cấp mẫu cho ngành rèm cửa và phụ kiện.
-- Chạy toàn bộ file trên đúng database MySQL của project.
-- Tên và địa chỉ đều là dữ liệu giả lập, không đại diện doanh nghiệp có thật.
-- Bảng suppliers chỉ có name/address; phiếu nhập và khoản phải trả sẽ tạo ở phần sau.
-- File không sửa các nhà cung cấp đã có. Chạy lại sẽ không nhân đôi cùng tên + địa chỉ.

SET NAMES utf8mb4;

CREATE TEMPORARY TABLE tmp_seed_curtain_suppliers_2026 (
  seed_no SMALLINT NOT NULL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  city_code CHAR(3) NOT NULL
);

INSERT INTO tmp_seed_curtain_suppliers_2026 (seed_no, name, city_code) VALUES
  -- Xưởng dệt và nhà phân phối vải rèm (15)
  (1, 'Xưởng dệt vải rèm An Bình', 'HCM'),
  (2, 'Công ty vải rèm Ánh Ngọc', 'HCM'),
  (3, 'Xưởng dệt polyester Bảo Minh', 'HCM'),
  (4, 'Công ty vải nội thất Bình An', 'HCM'),
  (5, 'Xưởng dệt linen Cát Tường', 'HCM'),
  (6, 'Công ty vải rèm Đại Phúc', 'HCM'),
  (7, 'Xưởng dệt nhung Đông Hòa', 'HCM'),
  (8, 'Công ty vải chống nắng Gia Hòa', 'HCM'),
  (9, 'Xưởng dệt voan Hồng Phúc', 'HCM'),
  (10, 'Công ty vải rèm Hưng Lộc', 'HCM'),
  (11, 'Xưởng dệt gấm Kim Anh', 'HCM'),
  (12, 'Công ty vải rèm Lam Giang', 'HCM'),
  (13, 'Xưởng dệt vải Mộc Lan', 'HCM'),
  (14, 'Công ty vải nội thất Nam Khang', 'HCM'),
  (15, 'Xưởng dệt rèm Phúc Thịnh', 'HCM'),

  -- Xưởng may rèm thành phẩm (15)
  (16, 'Xưởng may rèm An Gia', 'HCM'),
  (17, 'Xưởng may rèm Bách Hợp', 'HCM'),
  (18, 'Công ty rèm may sẵn Bảo Châu', 'HCM'),
  (19, 'Xưởng may rèm Cẩm Tú', 'HCM'),
  (20, 'Công ty rèm thành phẩm Đại An', 'HCM'),
  (21, 'Xưởng may rèm Gia Phúc', 'HCM'),
  (22, 'Xưởng may rèm Hòa Thịnh', 'HCM'),
  (23, 'Công ty rèm may sẵn Khánh Minh', 'HCM'),
  (24, 'Xưởng may rèm Lộc Phát', 'HCM'),
  (25, 'Công ty rèm thành phẩm Minh Tâm', 'HCM'),
  (26, 'Xưởng may rèm Ngọc Hà', 'HCM'),
  (27, 'Xưởng may rèm Phương Nam', 'HCM'),
  (28, 'Công ty rèm may sẵn Quang Minh', 'HCM'),
  (29, 'Xưởng may rèm Tâm Phúc', 'HCM'),
  (30, 'Xưởng may rèm Thiên Ân', 'HCM'),

  -- Rèm cuốn, rèm cầu vồng, rèm sáo và rèm roman (20)
  (31, 'Xưởng rèm cuốn An Hòa', 'HCM'),
  (32, 'Công ty rèm cầu vồng Bắc Nam', 'HCM'),
  (33, 'Xưởng rèm sáo nhôm Bình Minh', 'HCM'),
  (34, 'Xưởng rèm roman Cát An', 'HCM'),
  (35, 'Công ty rèm cuốn Duy Phát', 'HCM'),
  (36, 'Xưởng rèm sáo gỗ Gia Hân', 'HCM'),
  (37, 'Công ty rèm cầu vồng Hòa Gia', 'HCM'),
  (38, 'Xưởng rèm cuốn Hồng An', 'HCM'),
  (39, 'Xưởng rèm sáo nhôm Khải Minh', 'HCM'),
  (40, 'Công ty rèm roman Lam Phương', 'HCM'),
  (41, 'Xưởng rèm cuốn Minh Châu', 'HN'),
  (42, 'Công ty rèm cầu vồng Nam Việt', 'HN'),
  (43, 'Xưởng rèm sáo gỗ Ngọc Sơn', 'HN'),
  (44, 'Công ty rèm cuốn Phúc Lâm', 'HN'),
  (45, 'Xưởng rèm roman Phương Anh', 'HN'),
  (46, 'Xưởng rèm sáo nhôm Quang Huy', 'HN'),
  (47, 'Công ty rèm cầu vồng Sơn Hà', 'HN'),
  (48, 'Xưởng rèm cuốn Tân Phú', 'HN'),
  (49, 'Xưởng rèm sáo gỗ Thiên Hà', 'HN'),
  (50, 'Công ty rèm roman Vạn Lộc', 'HN'),

  -- Thanh treo, ray trượt và giá đỡ (20)
  (51, 'Xưởng thanh treo rèm An Khang', 'HN'),
  (52, 'Công ty ray rèm Bảo Long', 'HN'),
  (53, 'Xưởng thanh treo rèm Cường Phát', 'HN'),
  (54, 'Công ty ray nhôm Đại Việt', 'HN'),
  (55, 'Xưởng thanh treo rèm Đông Phú', 'HN'),
  (56, 'Công ty ray rèm Gia Thành', 'HN'),
  (57, 'Xưởng thanh treo rèm Hoàng Gia', 'HN'),
  (58, 'Công ty ray trượt Hưng Thịnh', 'HN'),
  (59, 'Xưởng thanh treo rèm Kim Long', 'HN'),
  (60, 'Công ty ray rèm Minh An', 'HN'),
  (61, 'Xưởng giá đỡ rèm Nam Phát', 'HN'),
  (62, 'Công ty ray nhôm Ngọc Phát', 'HN'),
  (63, 'Xưởng thanh treo rèm Phú Khang', 'HN'),
  (64, 'Công ty ray trượt Quang Lộc', 'HN'),
  (65, 'Xưởng giá đỡ rèm Tân An', 'HN'),
  (66, 'Công ty ray rèm Thanh Bình', 'HN'),
  (67, 'Xưởng thanh treo rèm Thiên Phúc', 'HN'),
  (68, 'Công ty ray nhôm Trường Giang', 'HN'),
  (69, 'Xưởng giá đỡ rèm Vĩnh Hòa', 'HN'),
  (70, 'Công ty ray trượt Xuân Phát', 'HN'),

  -- Phụ kiện móc, khoen, dây và linh kiện rèm (20)
  (71, 'Xưởng phụ kiện rèm An Lộc', 'HN'),
  (72, 'Công ty khoen rèm Bảo Phúc', 'HN'),
  (73, 'Xưởng móc rèm Cát Lợi', 'HN'),
  (74, 'Công ty dây buộc rèm Đông Nam', 'HN'),
  (75, 'Xưởng phụ kiện rèm Gia Bảo', 'HN'),
  (76, 'Công ty khoen rèm Hòa Phát Mẫu', 'DN'),
  (77, 'Xưởng móc rèm Hồng Sơn', 'DN'),
  (78, 'Công ty dây buộc rèm Khánh An', 'DN'),
  (79, 'Xưởng phụ kiện rèm Lam Hải', 'DN'),
  (80, 'Công ty khoen rèm Minh Gia', 'DN'),
  (81, 'Xưởng móc rèm Nam Hòa', 'DN'),
  (82, 'Công ty dây buộc rèm Ngọc Bảo', 'DN'),
  (83, 'Xưởng phụ kiện rèm Phúc Hải', 'DN'),
  (84, 'Công ty khoen rèm Quang Thịnh', 'DN'),
  (85, 'Xưởng móc rèm Sơn Phúc', 'DN'),
  (86, 'Công ty dây buộc rèm Tân Hưng', 'DN'),
  (87, 'Xưởng phụ kiện rèm Thanh An', 'DN'),
  (88, 'Công ty khoen rèm Thiên Lộc', 'DN'),
  (89, 'Xưởng móc rèm Trường Phúc', 'DN'),
  (90, 'Công ty dây buộc rèm Vạn Gia', 'DN'),

  -- Động cơ, điều khiển và ray rèm điện (10)
  (91, 'Công ty động cơ rèm An Tín', 'DN'),
  (92, 'Nhà phân phối rèm điện Bảo Khang', 'DN'),
  (93, 'Công ty điều khiển rèm Gia Minh', 'DN'),
  (94, 'Nhà phân phối ray điện Hưng Phát', 'DN'),
  (95, 'Công ty động cơ rèm Khánh Thành', 'DN'),
  (96, 'Nhà phân phối rèm điện Minh Quân', 'DN'),
  (97, 'Công ty điều khiển rèm Phú An', 'DN'),
  (98, 'Nhà phân phối ray điện Tâm Việt', 'DN'),
  (99, 'Công ty động cơ rèm Thiên Minh', 'DN'),
  (100, 'Nhà phân phối rèm điện Vĩnh Phúc', 'DN');

START TRANSACTION;

INSERT INTO suppliers (name, address)
SELECT candidate.name, candidate.address
FROM (
  SELECT seed_no, name,
         CONCAT('Số ', 200 + seed_no, ' đường Mẫu, ',
           CASE city_code
             WHEN 'HCM' THEN ELT(1 + MOD(seed_no, 5),
               'Quận 1, TP. Hồ Chí Minh', 'Quận 7, TP. Hồ Chí Minh',
               'Quận Bình Thạnh, TP. Hồ Chí Minh', 'Quận Tân Bình, TP. Hồ Chí Minh',
               'TP. Thủ Đức, TP. Hồ Chí Minh')
             WHEN 'HN' THEN ELT(1 + MOD(seed_no, 5),
               'Quận Ba Đình, Hà Nội', 'Quận Cầu Giấy, Hà Nội',
               'Quận Đống Đa, Hà Nội', 'Quận Thanh Xuân, Hà Nội',
               'Quận Hà Đông, Hà Nội')
             WHEN 'DN' THEN ELT(1 + MOD(seed_no, 5),
               'Quận Hải Châu, Đà Nẵng', 'Quận Sơn Trà, Đà Nẵng',
               'Quận Thanh Khê, Đà Nẵng', 'Quận Liên Chiểu, Đà Nẵng',
               'Quận Cẩm Lệ, Đà Nẵng')
           END) AS address
  FROM tmp_seed_curtain_suppliers_2026
) AS candidate
WHERE NOT EXISTS (
  SELECT 1 FROM suppliers AS existing
  WHERE existing.name = candidate.name
    AND existing.address = candidate.address
);

-- Lần chạy đầu tiên dự kiến ra 100, nếu chưa có bản ghi trùng tên + địa chỉ.
SELECT ROW_COUNT() AS suppliers_inserted_this_run;
COMMIT;

-- Kiểm tra riêng danh sách mẫu; kết quả dự kiến là 100.
SELECT COUNT(*) AS demo_suppliers_present
FROM suppliers
WHERE address LIKE 'Số ___ đường Mẫu, %'
  AND name IN (SELECT name FROM tmp_seed_curtain_suppliers_2026);

DROP TEMPORARY TABLE tmp_seed_curtain_suppliers_2026;
