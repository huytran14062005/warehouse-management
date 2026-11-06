# warehouse-management

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
được giới hạn trong khoảng ±10% giá hệ thống. Khi API combo khởi động trên cơ sở
dữ liệu cũ, nó tự bổ sung cột này nếu chưa có.
