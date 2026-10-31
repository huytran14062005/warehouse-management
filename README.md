# warehouse-management

## Cache dữ liệu đọc

Backend dùng Upstash Redis REST khi có `UPSTASH_REDIS_REST_URL` và
`UPSTASH_REDIS_REST_TOKEN` trong biến môi trường của Vercel. Cache áp dụng cho
báo cáo quản lý (60 giây), báo cáo kho (20–30 giây), danh sách sản phẩm
(20 giây), khách hàng (30 giây), đơn bán hàng và tồn hàng nhân viên (10 giây),
phiếu nhập và điều chuyển (20 giây), combo và ngưỡng tồn kho (5 phút).
Giao dịch ghi thành công sẽ đổi phiên bản cache; khi Redis lỗi, hệ thống đọc
từ MySQL. Các thao tác xác nhận tồn kho và thanh toán vẫn dùng MySQL.
