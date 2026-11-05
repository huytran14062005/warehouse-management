# warehouse-management

## Nhập hàng theo combo

Trước khi triển khai bản API có chức năng nhập combo, chạy
`.venv\Scripts\python.exe -m migrations.apply_import_combo_columns` trên cơ sở
dữ liệu MySQL hiện có. Lệnh có thể chạy lại an toàn; nội dung SQL tương ứng ở
[`migrations/20261105_import_combo_columns.sql`](migrations/20261105_import_combo_columns.sql).
Migration chỉ thêm cột vào `import_invoices` và
`import_invoice_items`, không tạo bảng mới. Sao lưu cơ sở dữ liệu trước khi chạy.

Phiếu nhập có thể chứa hàng lẻ và combo. Giá trọn combo do nhà cung cấp báo được
lưu nguyên trên phiếu. Nếu nhà cung cấp không báo giá từng món, hệ thống chia đều
giá combo cho từng đơn vị sản phẩm trong bộ (sai lệch tối đa 1 đồng khi chia lẻ).
Nếu có giá từng món, nhập đơn giá nhà cung cấp báo cho mỗi món; tổng đơn giá nhân
số lượng trong một bộ phải bằng giá trọn combo. `line_total` là giá trị chính xác
để đối chiếu, còn `unit_price` trên dòng tổng hợp là giá bình quân hiển thị.
