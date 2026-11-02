-- Repair the demo product requests that were imported with literal '?' characters.
-- Run once against the selected database. This only targets the seeded demo rows
-- identified by their [DEMO-CURTAIN-REQUEST-xxx] note marker.

SET NAMES utf8mb4;

DROP TEMPORARY TABLE IF EXISTS tmp_demo_product_request_encoding_2026;

CREATE TEMPORARY TABLE tmp_demo_product_request_encoding_2026 (
  request_no SMALLINT NOT NULL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  unit VARCHAR(50) NOT NULL
);

INSERT INTO tmp_demo_product_request_encoding_2026 (request_no, name, unit) VALUES
  (51, 'Vải rèm chenille chống nắng màu kem sữa khổ 2,8 m', 'Mét'),
  (52, 'Vải rèm chenille chống nắng màu xám khói khổ 2,8 m', 'Mét'),
  (53, 'Vải rèm chenille chống nắng màu xanh ngọc khổ 2,8 m', 'Mét'),
  (54, 'Vải rèm chenille chống nắng màu xanh than khổ 2,8 m', 'Mét'),
  (55, 'Vải rèm chenille chống nắng màu hồng đất khổ 2,8 m', 'Mét'),
  (56, 'Vải rèm chenille chống nắng màu nâu hạt dẻ khổ 2,8 m', 'Mét'),
  (57, 'Vải rèm chenille chống nắng màu vàng cát khổ 2,8 m', 'Mét'),
  (58, 'Vải rèm chenille chống nắng màu xanh olive khổ 2,8 m', 'Mét'),
  (59, 'Vải rèm chenille chống nắng màu ghi sáng khổ 2,8 m', 'Mét'),
  (60, 'Vải rèm chenille chống nắng màu trắng ngà khổ 2,8 m', 'Mét'),
  (61, 'Rèm may sẵn xếp ly vải bố màu kem sữa 160 x 240 cm', 'Tấm'),
  (62, 'Rèm may sẵn xếp ly vải bố màu xám khói 160 x 240 cm', 'Tấm'),
  (63, 'Rèm may sẵn xếp ly vải bố màu xanh ngọc 160 x 240 cm', 'Tấm'),
  (64, 'Rèm may sẵn xếp ly vải bố màu xanh than 160 x 240 cm', 'Tấm'),
  (65, 'Rèm may sẵn xếp ly vải bố màu hồng đất 160 x 240 cm', 'Tấm'),
  (66, 'Rèm may sẵn xếp ly vải bố màu nâu hạt dẻ 160 x 240 cm', 'Tấm'),
  (67, 'Rèm may sẵn xếp ly vải bố màu vàng cát 160 x 240 cm', 'Tấm'),
  (68, 'Rèm may sẵn xếp ly vải bố màu xanh olive 160 x 240 cm', 'Tấm'),
  (69, 'Rèm may sẵn xếp ly vải bố màu ghi sáng 160 x 240 cm', 'Tấm'),
  (70, 'Rèm may sẵn xếp ly vải bố màu trắng ngà 160 x 240 cm', 'Tấm'),
  (71, 'Rèm cầu vồng 2 lớp màu kem sữa 120 x 160 cm', 'Bộ'),
  (72, 'Rèm cầu vồng 2 lớp màu xám khói 120 x 160 cm', 'Bộ'),
  (73, 'Rèm cầu vồng 2 lớp màu xanh ngọc 120 x 160 cm', 'Bộ'),
  (74, 'Rèm cầu vồng 2 lớp màu xanh than 120 x 160 cm', 'Bộ'),
  (75, 'Rèm cầu vồng 2 lớp màu hồng đất 120 x 160 cm', 'Bộ'),
  (76, 'Rèm cầu vồng 2 lớp màu nâu hạt dẻ 120 x 160 cm', 'Bộ'),
  (77, 'Rèm cầu vồng 2 lớp màu vàng cát 120 x 160 cm', 'Bộ'),
  (78, 'Rèm cầu vồng 2 lớp màu xanh olive 120 x 160 cm', 'Bộ'),
  (79, 'Rèm cầu vồng 2 lớp màu ghi sáng 120 x 160 cm', 'Bộ'),
  (80, 'Rèm cầu vồng 2 lớp màu trắng ngà 120 x 160 cm', 'Bộ'),
  (81, 'Ray rèm nhôm âm trần màu trắng dài 2,5 m', 'Thanh'),
  (82, 'Ray rèm nhôm âm trần màu trắng dài 3 m', 'Thanh'),
  (83, 'Ray rèm nhôm âm trần màu đen dài 2,5 m', 'Thanh'),
  (84, 'Ray rèm nhôm âm trần màu đen dài 3 m', 'Thanh'),
  (85, 'Ray rèm nhôm âm trần màu bạc dài 2,5 m', 'Thanh'),
  (86, 'Ray rèm nhôm âm trần màu bạc dài 3 m', 'Thanh'),
  (87, 'Ray rèm nhôm âm trần màu vàng đồng dài 2,5 m', 'Thanh'),
  (88, 'Ray rèm nhôm âm trần màu vàng đồng dài 3 m', 'Thanh'),
  (89, 'Ray rèm nhôm âm trần màu ghi dài 2,5 m', 'Thanh'),
  (90, 'Ray rèm nhôm âm trần màu ghi dài 3 m', 'Thanh'),
  (91, 'Bộ phụ kiện lắp rèm cuốn ống phi 38 mm màu trắng', 'Bộ'),
  (92, 'Bộ phụ kiện lắp rèm cuốn ống phi 38 mm màu đen', 'Bộ'),
  (93, 'Bộ phụ kiện lắp rèm cuốn ống phi 38 mm màu ghi', 'Bộ'),
  (94, 'Bộ phụ kiện lắp rèm cuốn ống phi 38 mm màu kem', 'Bộ'),
  (95, 'Bộ phụ kiện lắp rèm cuốn ống phi 38 mm màu bạc', 'Bộ'),
  (96, 'Bộ phụ kiện lắp rèm cuốn ống phi 45 mm màu trắng', 'Bộ'),
  (97, 'Bộ phụ kiện lắp rèm cuốn ống phi 45 mm màu đen', 'Bộ'),
  (98, 'Bộ phụ kiện lắp rèm cuốn ống phi 45 mm màu ghi', 'Bộ'),
  (99, 'Bộ phụ kiện lắp rèm cuốn ống phi 45 mm màu kem', 'Bộ'),
  (100, 'Bộ phụ kiện lắp rèm cuốn ống phi 45 mm màu bạc', 'Bộ');

START TRANSACTION;

UPDATE product_requests AS request
JOIN tmp_demo_product_request_encoding_2026 AS repair
  ON request.note LIKE CONCAT('[DEMO-CURTAIN-REQUEST-',
                              LPAD(repair.request_no, 3, '0'), ']%')
SET request.name = repair.name,
    request.unit = repair.unit
WHERE request.status = 'pending';

SELECT COUNT(*) AS repaired_demo_product_requests
FROM product_requests AS request
WHERE request.status = 'pending'
  AND request.note LIKE '[DEMO-CURTAIN-REQUEST-%]%'
  AND request.name NOT LIKE '%?%';

COMMIT;

DROP TEMPORARY TABLE tmp_demo_product_request_encoding_2026;
