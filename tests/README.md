# Kiểm thử theo checklist trước khi đưa lên web chính

## Chạy tự động

Từ thư mục gốc dự án:

```powershell
.venv\Scripts\python.exe -B -m unittest discover -s tests -v
```

Backend test **ép `DATABASE_URL=sqlite:///:memory:` trước khi import ứng dụng**. Mỗi test tạo/xóa schema trong bộ nhớ; không kết nối hay ghi database thật.

```powershell
cd warehouse-management-front-end
$env:CI = 'true'
npm.cmd test -- --watch=false --runInBand
```

Frontend test dùng Jest/DOM giả lập, không truy cập server thật.

## Đối chiếu checklist

| Nhóm | Test tự động | Giới hạn cần kiểm chứng thêm |
| --- | --- | --- |
| Đơn thường | `test_01`: tạo, sửa nháp, gửi kho, nhận việc, giao, bàn giao kế toán, hoàn thành; kiểm tra tiền thối, quỹ, công nợ và tồn | Kiểm tra giao diện thật trên staging |
| Combo | `test_02`: nhiều bộ, số lượng thành phần, sửa nháp, hoàn thành sau khi đổi giá lẻ | Kiểm tra combo trong giao diện thật |
| Biên/tồn kho | `test_03`: bán hết tồn, hai nháp cùng giữ số lượng, từ chối nháp thứ hai khi xử lý; hủy đơn đã giao và chỉ trả tồn sau xác nhận hàng hoàn | **Chưa đo hai request chạy đồng thời trên MySQL** |
| Thanh toán | `test_01`, `test_04`: tiền mặt dư có tiền thối, chuyển khoản, trả một phần và nhiều đợt, không ghi quỹ lặp khi trả dư/thử lại | Chạy đồng thời hai request trả nợ trên MySQL staging |
| Khuyến mãi | `test_05`: điều kiện hợp lệ/không hợp lệ, tổng sau giảm, duyệt/từ chối đơn cũ đang chờ | Khuyến mãi mới hợp lệ được tự duyệt theo logic hiện tại; kiểm tra thao tác giao diện |
| Phân quyền | `test_06`: API từ chối vai trò sai, token hết hạn, khóa tài khoản và token có vai trò cũ | Chạy ma trận endpoint đầy đủ trên staging |
| Giá và báo cáo | `test_07`, `test_08` và `test_pricing_requirements.py`: giá vốn nhập đã trừ VAT đầu vào khấu trừ, lương/tăng ca theo ngày phát sinh hoặc kế hoạch đã xác nhận, phân bổ theo doanh thu dự kiến, chi phí đơn/chuyến theo doanh thu hoặc trọng lượng, làm tròn giá và chỉ áp dụng khi quản lý bấm. Giá vốn đơn mới được chốt khi hoàn tất bán. | Giá đề xuất chưa VAT đầu ra; hóa đơn VAT đầu ra chưa có trong phạm vi tính giá. Đơn cũ chưa có giá vốn chốt được báo là ước tính. Báo cáo vẫn lọc doanh thu theo `sold_at` như nghiệp vụ hiện có; cần xác nhận kỳ ghi nhận nếu đơn bắc qua hai tháng. |
| Quy đổi đơn vị | `test_04`, `test_05`, `test_10`: 1 bao = 1.200 cái, 1 cây = 6 mét, bán 0,5 mét qua đủ luồng đơn hàng, tồn theo đơn vị cơ sở. | Quy cách là riêng cho từng sản phẩm; sửa quy cách đã dùng bị chặn để bảo vệ lịch sử. |
| Độ bền | `test_09`: hai access token đọc ngay sau ghi, thử hoàn thành lặp không ghi quỹ hai lần; `SalesInvoiceEditor.test.js`: ghi chú chưa lưu còn sau khi đóng/mở form, tách theo tài khoản và xóa bản tạm sau khi lưu | Chưa mô phỏng mất mạng, hai phiên refresh token và truy cập staging; cần kiểm tra refresh trình duyệt thực tế |

## Kiểm chứng còn cần trên MySQL local/staging

Chỉ dùng dữ liệu tổng hợp hoặc đã ẩn danh. Không dùng production.

1. Tạo tồn đúng 1 đơn vị, tạo hai nháp lấy cùng sản phẩm rồi gửi đồng thời hai request chuyển sang `processing`. Kỳ vọng tối đa một request thành công, tồn không âm.
2. Tạo đơn hoàn thành còn nợ, gửi đồng thời hai request thu cùng số dư. Kỳ vọng tổng tiền ghi nhận không vượt nợ, quỹ chỉ tăng đúng phần hợp lệ và không có hai bút toán cho cùng một khoản thu.
3. Ngắt mạng ngay sau khi gửi lệnh lưu đơn, nối lại rồi tải lại chi tiết. Đối chiếu số đơn, tiền, tồn và quỹ để phát hiện ghi lặp hoặc mất bản ghi.
4. Trên hai trình duyệt/thiết bị, đăng nhập cùng tài khoản; kiểm tra đọc sau ghi, hết hạn token, đổi vai trò/khóa tài khoản và việc thu hồi phiên.
5. Thử nhập ghi chú trong form mới chưa lưu rồi đóng/mở và refresh trang. Test DOM xác nhận đóng/mở vẫn còn ghi chú; cần xác nhận thêm trên trình duyệt thật. Những trường khác trong form chưa có cơ chế khôi phục sau khi đóng.
6. Tạo đơn cuối tháng và hoàn thành đầu tháng sau. Đối chiếu báo cáo theo cả hai kỳ với quy tắc ghi nhận doanh thu đã được doanh nghiệp phê duyệt.
