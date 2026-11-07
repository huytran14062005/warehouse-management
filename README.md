# warehouse-management

## Email thông báo tài khoản

API gửi email khi duyệt, khóa hoặc mở khóa tài khoản. Với Gmail SMTP, cấu hình các biến sau trong môi trường chạy API (Production trên Vercel), không chỉ trong `.env` ở máy phát triển:

```text
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=<địa chỉ Gmail gửi thư>
SMTP_PASSWORD=<mật khẩu ứng dụng của tài khoản gửi>
MAIL_SENDER=<địa chỉ Gmail gửi thư>
```

Tài khoản Google cần bật xác minh 2 bước để tạo mật khẩu ứng dụng. Sau khi sửa biến môi trường trên Vercel, triển khai lại API để cấu hình mới có hiệu lực. Nếu SMTP không hoạt động, thao tác tài khoản vẫn được lưu và API trả cảnh báo email chưa gửi; hãy xử lý cấu hình trước khi thử gửi thông báo tiếp theo.

## Nhập hàng theo combo

Chức năng nhập combo dùng hai cột `import_invoices.combo_groups` và
`import_invoice_items.line_total`. `init_db.py` tạo hai cột này khi khởi tạo
cơ sở dữ liệu mới. Với cơ sở dữ liệu cũ chưa có cột, thêm chúng trong MySQL
trước khi triển khai API:

```sql
ALTER TABLE import_invoices ADD COLUMN combo_groups JSON NULL;
ALTER TABLE import_invoice_items ADD COLUMN line_total DECIMAL(14, 2) NULL;
```

Chỉ chạy từng lệnh nếu cột tương ứng chưa tồn tại.

Phiếu nhập có thể chứa hàng lẻ và combo. Giá trọn combo do nhà cung cấp báo được
lưu nguyên trên phiếu. Nếu nhà cung cấp không báo giá từng món, hệ thống chia đều
giá combo cho từng đơn vị sản phẩm trong bộ. Nếu có giá từng món, tổng đơn giá
nhân số lượng trong một bộ phải bằng giá trọn combo.

## Giá combo sản phẩm

Combo dùng cột `product_combos.sale_price` trong bảng hiện có. Giá hệ thống được
tính từ giá bán mặc định của từng sản phẩm nhân số lượng trong bộ; giá áp dụng
do quản lý nhập, là số nguyên dương và không bị giới hạn ±10% so với giá hệ thống.
Giá sản phẩm bán lẻ trong đơn vẫn phải nằm trong khoảng ±10% giá bán mặc định.
Khi API khởi động trên cơ sở dữ liệu cũ, nó tự bổ sung cột `product_combos.sale_price`
và `sales_invoice_items.combo_id` nếu chưa có. Dòng sản phẩm thuộc combo được
đánh dấu `combo_id` và xác thực đủ thành phần trước khi áp dụng giá combo trong đơn.
