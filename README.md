# warehouse-management

## Luồng đơn bán hàng

Nhân viên bán hàng tạo nháp và bấm **Gửi đơn cho kho**. Thủ kho nhận đơn **Chờ kho**, chuyển sang **Đang xử lý**, rồi **Đang giao** khi hàng đã lên xe. Nhân viên lập đơn hoặc quản lý xác nhận người nhận khi giao xong; kế toán nhập số tiền, phương thức và hạn thanh toán nếu còn nợ rồi bấm **Lưu thanh toán** để đơn tự hoàn thành. Quản lý xem số lượng theo từng giai đoạn trên bảng trạng thái. Mỗi đơn chờ thao tác của vai trò đăng nhập có chấm đỏ ở góc trên bên trái trong danh sách; ô số đỏ cạnh **Đơn bán hàng** trong menu cho biết tổng số đơn cần thao tác của vai trò đó.

Danh sách đơn được phân trang tại API. Chi tiết đơn chỉ tải 20 mốc xử lý và 20 thanh toán gần nhất; lịch sử thanh toán có nút tải thêm từng trang.

Các đơn cũ được giữ nguyên trạng thái, không tự xác nhận đã gửi kho hoặc đã giao. Đơn cũ đang giao cần được xác nhận thủ công trước khi kế toán hoàn thành.
