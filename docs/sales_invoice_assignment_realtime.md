# Phân công xử lý đơn bán hàng

## Nâng cấp cơ sở dữ liệu

Chọn đúng schema trong MySQL Workbench rồi chạy `schema_changes/2026_11_sales_invoice_assignments.sql` một lần, sau `schema_changes/2026_11_sales_delivery_workflow.sql`. Sao lưu dữ liệu trước khi thay đổi schema. Câu `SELECT` cuối migration liệt kê những đơn cũ chưa tìm được nhân viên hoạt động; quản lý mở đơn và dùng **Đổi người phụ trách** để giao lại.

Migration tự gán thủ kho theo kho, nhân viên giao hàng theo phân công sẵn có, hoặc quản lý cho dịch vụ ngoài. Việc nhận đơn vẫn cần người được giao xác nhận. Đơn đã ở trạng thái **Đang giao** trước khi nâng cấp cần người giao xác nhận lại và nhập người nhận hàng trước khi bàn giao kế toán.

Nếu đơn cũ đang giao nhưng thiếu hẳn phương án giao, quản lý có thể khôi phục phương án trong chi tiết đơn. Khi chọn dịch vụ ngoài, hệ thống ghi chi phí vào quỹ đúng một lần; đơn đã có dấu vết chi phí cũ phải được đối chiếu trước.

Khi chọn dịch vụ giao ngoài cho đơn mới, thủ kho phải chọn quản lý tiếp nhận. Khi nhân viên giao hàng hoặc quản lý xác nhận đã giao, họ chọn kế toán tiếp nhận. Người nhận bấm **Nhận xử lý đơn này** trước khi thực hiện bước tiếp theo.

## Realtime

Cài Python từ `requirements.txt`, cài frontend từ `package-lock.json`, chạy local bằng `python web/index.py` (hoặc `python app.py`) và `npm start`. Cả hai lệnh Python đều khởi động máy chủ Socket.IO. Socket.IO dùng access token hiện có, báo sự kiện sau khi MySQL commit; giao diện tải lại đơn từ API khi kết nối lại. API vẫn là nguồn dữ liệu chính.

Vercel bật Fluid compute trong `vercel.json`. Khi chạy nhiều instance, cấu hình `SOCKETIO_REDIS_URL` tới Redis để phát thông báo giữa các instance. Nếu WebSocket ở môi trường deploy chưa được runtime Flask WSGI hỗ trợ, giao diện vẫn tải lại bằng cơ chế làm mới định kỳ; cần kiểm tra thực tế đường `/socket.io/` sau triển khai. Có thể đặt `REACT_APP_SOCKET_URL` cho frontend khi Socket.IO chạy ở một dịch vụ riêng.
