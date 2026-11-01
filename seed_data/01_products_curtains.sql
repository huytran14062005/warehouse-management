-- Phần 1/?: 100 sản phẩm rèm cửa và phụ kiện.
-- Chạy trên đúng database Aiven của project bằng MySQL Workbench.
-- Chỉ thêm sản phẩm mới; nếu tên đã tồn tại thì giữ nguyên dữ liệu hiện có.
-- Giá bán mặc định là giá MẪU (VND/đơn vị), không phải báo giá thị trường.
-- Chưa tạo tồn kho: số lượng sẽ phát sinh ở phần phiếu nhập sau.
-- Quantity trong project là số nguyên; các mặt hàng theo mét được tính theo mét nguyên.

SET NAMES utf8mb4;
START TRANSACTION;

INSERT INTO products (name, unit, default_sale_price) VALUES
  -- Vải rèm bán theo mét dài, khổ vải cố định 2,8 m (20)
  ('Vải rèm cản sáng polyester màu kem khổ 2,8 m', 'Mét', 280000),
  ('Vải rèm cản sáng polyester màu xám nhạt khổ 2,8 m', 'Mét', 280000),
  ('Vải rèm cản sáng polyester màu xám đậm khổ 2,8 m', 'Mét', 280000),
  ('Vải rèm cản sáng polyester màu xanh navy khổ 2,8 m', 'Mét', 295000),
  ('Vải rèm cản sáng polyester màu xanh rêu khổ 2,8 m', 'Mét', 295000),
  ('Vải rèm cản sáng polyester màu nâu cà phê khổ 2,8 m', 'Mét', 285000),
  ('Vải rèm linen pha màu be khổ 2,8 m', 'Mét', 340000),
  ('Vải rèm linen pha màu trắng ngà khổ 2,8 m', 'Mét', 340000),
  ('Vải rèm linen pha màu xám khổ 2,8 m', 'Mét', 340000),
  ('Vải rèm linen pha màu xanh sage khổ 2,8 m', 'Mét', 360000),
  ('Vải rèm nhung màu đỏ đô khổ 2,8 m', 'Mét', 420000),
  ('Vải rèm nhung màu xanh cổ vịt khổ 2,8 m', 'Mét', 420000),
  ('Vải rèm nhung màu xám bạc khổ 2,8 m', 'Mét', 420000),
  ('Vải rèm bố sọc be khổ 2,8 m', 'Mét', 275000),
  ('Vải rèm bố sọc xám khổ 2,8 m', 'Mét', 275000),
  ('Vải rèm voan trơn màu trắng khổ 2,8 m', 'Mét', 125000),
  ('Vải rèm voan trơn màu kem khổ 2,8 m', 'Mét', 125000),
  ('Vải rèm voan thêu lá màu trắng khổ 2,8 m', 'Mét', 190000),
  ('Vải rèm voan thêu hoa màu kem khổ 2,8 m', 'Mét', 190000),
  ('Vải rèm dimout màu ghi khổ 2,8 m', 'Mét', 250000),

  -- Rèm may sẵn theo kích thước cố định, mỗi mã là một tấm (20)
  ('Rèm may sẵn ore cản sáng màu kem 140 x 260 cm', 'Tấm', 620000),
  ('Rèm may sẵn ore cản sáng màu xám 140 x 260 cm', 'Tấm', 620000),
  ('Rèm may sẵn ore cản sáng màu xanh navy 140 x 260 cm', 'Tấm', 650000),
  ('Rèm may sẵn ore cản sáng màu be linen 140 x 260 cm', 'Tấm', 690000),
  ('Rèm may sẵn ore cản sáng màu nâu 140 x 260 cm', 'Tấm', 640000),
  ('Rèm may sẵn ore cản sáng màu trắng ngà 140 x 220 cm', 'Tấm', 560000),
  ('Rèm may sẵn ore cản sáng màu xám nhạt 140 x 220 cm', 'Tấm', 560000),
  ('Rèm may sẵn ore cản sáng màu xanh rêu 140 x 220 cm', 'Tấm', 580000),
  ('Rèm may sẵn ore cản sáng màu xanh ngọc 140 x 260 cm', 'Tấm', 650000),
  ('Rèm may sẵn ore cản sáng màu xám đậm 180 x 260 cm', 'Tấm', 780000),
  ('Rèm may sẵn ore voan trắng trơn 140 x 260 cm', 'Tấm', 320000),
  ('Rèm may sẵn ore voan kem trơn 140 x 260 cm', 'Tấm', 320000),
  ('Rèm may sẵn ore voan trắng thêu lá 140 x 260 cm', 'Tấm', 390000),
  ('Rèm may sẵn ore voan kem thêu hoa 140 x 260 cm', 'Tấm', 390000),
  ('Rèm may sẵn ore voan trắng sọc dọc 140 x 260 cm', 'Tấm', 340000),
  ('Rèm may sẵn ore voan trắng trơn 140 x 220 cm', 'Tấm', 290000),
  ('Rèm may sẵn ore voan kem trơn 140 x 220 cm', 'Tấm', 290000),
  ('Rèm may sẵn ore voan trắng thêu lá 140 x 220 cm', 'Tấm', 350000),
  ('Rèm may sẵn ore voan trắng trơn 180 x 260 cm', 'Tấm', 400000),
  ('Rèm may sẵn ore voan kem trơn 180 x 260 cm', 'Tấm', 400000),

  -- Mành và rèm theo kích thước cố định, mỗi mã là một bộ (20)
  ('Rèm cuốn cản sáng màu trắng 100 x 160 cm', 'Bộ', 450000),
  ('Rèm cuốn cản sáng màu xám 100 x 160 cm', 'Bộ', 450000),
  ('Rèm cuốn cản sáng màu kem 120 x 180 cm', 'Bộ', 620000),
  ('Rèm cuốn cản sáng màu ghi 120 x 180 cm', 'Bộ', 620000),
  ('Rèm cuốn lưới xuyên sáng màu xám 100 x 160 cm', 'Bộ', 480000),
  ('Rèm cuốn lưới xuyên sáng màu kem 120 x 180 cm', 'Bộ', 660000),
  ('Rèm cầu vồng màu kem 100 x 160 cm', 'Bộ', 780000),
  ('Rèm cầu vồng màu xám 100 x 160 cm', 'Bộ', 780000),
  ('Rèm cầu vồng màu be 120 x 180 cm', 'Bộ', 990000),
  ('Rèm cầu vồng màu ghi 120 x 180 cm', 'Bộ', 990000),
  ('Rèm roman vải linen màu trắng 100 x 160 cm', 'Bộ', 890000),
  ('Rèm roman vải linen màu xám 100 x 160 cm', 'Bộ', 890000),
  ('Rèm roman vải cản sáng màu be 120 x 180 cm', 'Bộ', 1100000),
  ('Rèm sáo nhôm lá 25 mm màu trắng 100 x 160 cm', 'Bộ', 520000),
  ('Rèm sáo nhôm lá 25 mm màu xám 100 x 160 cm', 'Bộ', 520000),
  ('Rèm sáo nhôm lá 25 mm màu đen 120 x 180 cm', 'Bộ', 680000),
  ('Rèm lá dọc màu trắng 100 x 180 cm', 'Bộ', 490000),
  ('Rèm lá dọc màu xám 120 x 180 cm', 'Bộ', 580000),
  ('Rèm tổ ong màu trắng 100 x 160 cm', 'Bộ', 1200000),
  ('Rèm tổ ong màu xám 120 x 180 cm', 'Bộ', 1500000),

  -- Ray và thanh treo bán theo cây có chiều dài cố định (15)
  ('Ray rèm nhôm đơn màu trắng dài 1,5 m', 'Thanh', 130000),
  ('Ray rèm nhôm đơn màu trắng dài 2 m', 'Thanh', 180000),
  ('Ray rèm nhôm đơn màu trắng dài 2,5 m', 'Thanh', 225000),
  ('Ray rèm nhôm đơn màu đen dài 1,5 m', 'Thanh', 150000),
  ('Ray rèm nhôm đơn màu đen dài 2 m', 'Thanh', 210000),
  ('Ray rèm nhôm đơn màu đen dài 2,5 m', 'Thanh', 260000),
  ('Ray rèm nhôm đôi màu trắng dài 2 m', 'Thanh', 330000),
  ('Ray rèm nhôm đôi màu trắng dài 2,5 m', 'Thanh', 400000),
  ('Thanh treo rèm nhôm phi 28 mm màu bạc dài 1,5 m', 'Thanh', 250000),
  ('Thanh treo rèm nhôm phi 28 mm màu bạc dài 2 m', 'Thanh', 290000),
  ('Thanh treo rèm nhôm phi 28 mm màu bạc dài 2,5 m', 'Thanh', 340000),
  ('Thanh treo rèm nhôm phi 28 mm màu đen dài 2 m', 'Thanh', 310000),
  ('Thanh treo rèm nhôm phi 28 mm màu vàng đồng dài 2 m', 'Thanh', 350000),
  ('Ray rèm roman màu trắng dài 1,2 m', 'Thanh', 195000),
  ('Ống nhôm rèm cuốn phi 38 mm dài 2 m', 'Thanh', 160000),

  -- Phụ kiện treo, kéo và lắp đặt (20)
  ('Trụ đỡ tường thanh rèm phi 28 mm màu bạc', 'Cái', 40000),
  ('Trụ đỡ tường thanh rèm phi 28 mm màu đen', 'Cái', 40000),
  ('Trụ đỡ trần ray rèm nhôm đơn màu trắng', 'Cái', 25000),
  ('Trụ đỡ trần ray rèm nhôm đôi màu trắng', 'Cái', 55000),
  ('Đầu chụp thanh rèm phi 28 mm màu bạc', 'Cặp', 65000),
  ('Đầu chụp thanh rèm phi 28 mm màu đen', 'Cặp', 65000),
  ('Vòng treo rèm nhựa phi 28 mm màu trắng gói 10 cái', 'Gói', 40000),
  ('Vòng treo rèm nhựa phi 28 mm màu nâu gói 10 cái', 'Gói', 40000),
  ('Khoen ore kim loại đường kính 40 mm gói 10 cái', 'Gói', 75000),
  ('Móc treo rèm chữ S gói 20 cái', 'Gói', 35000),
  ('Bi trượt ray rèm nhôm gói 20 cái', 'Gói', 45000),
  ('Dây vén rèm bện màu be', 'Cặp', 110000),
  ('Dây vén rèm bện màu xám', 'Cặp', 110000),
  ('Móc vén rèm gắn tường màu vàng đồng', 'Cặp', 85000),
  ('Móc vén rèm gắn tường màu bạc', 'Cặp', 85000),
  ('Dây bi kéo rèm cuốn màu trắng dài 2 m', 'Sợi', 45000),
  ('Dây bi kéo rèm cuốn màu xám dài 2 m', 'Sợi', 45000),
  ('Bộ đầu kéo rèm cuốn dùng cho ống phi 38 mm', 'Bộ', 140000),
  ('Bát treo rèm cuốn dùng cho ống phi 38 mm', 'Cặp', 55000),
  ('Bộ dây kéo rèm roman tiêu chuẩn', 'Bộ', 95000),

  -- Thiết bị rèm điện và phụ kiện điều khiển (5)
  ('Động cơ rèm vải điện điều khiển Wi-Fi', 'Cái', 3200000),
  ('Điều khiển từ xa rèm điện 1 kênh', 'Cái', 420000),
  ('Điều khiển từ xa rèm điện 5 kênh', 'Cái', 650000),
  ('Ray rèm điện màu trắng dài 2 m', 'Bộ', 1500000),
  ('Ray rèm điện màu trắng dài 3 m', 'Bộ', 1900000)
ON DUPLICATE KEY UPDATE id = id;

SELECT ROW_COUNT() AS products_inserted_this_run;

COMMIT;

-- Kiểm tra nhanh tổng số sản phẩm sau khi nhập. Nếu DB đã có sản phẩm,
-- con số này sẽ lớn hơn 100 và không chứng minh có đúng 100 sản phẩm mới.
SELECT COUNT(*) AS total_products_after_import FROM products;
