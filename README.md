# warehouse-management

## Khởi tạo bảng khuyến mãi

Sau khi cấu hình kết nối cơ sở dữ liệu trong `.env`, chạy một lần:

```powershell
.\.venv\Scripts\python.exe create_promotions_table.py
```

Lệnh có thể chạy lại an toàn: bảng chỉ được tạo khi chưa tồn tại và không sửa dữ liệu cũ.
