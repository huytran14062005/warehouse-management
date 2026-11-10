# E2E trình duyệt cho hệ thống kho

## Cách chạy an toàn trên máy local

Bộ này chạy React và Flask thật trên `127.0.0.1:3107` và `127.0.0.1:5107`. Mỗi lần chạy tạo một SQLite mới trong `tests/.e2e-data/`, không dùng MySQL đang cấu hình. Cấu hình sẽ từ chối chạy nếu có `DATABASE_URL`, `DB_HOST` hoặc `DB_NAME` trong môi trường, nếu thiếu xác nhận ghi, hoặc nếu hai cổng đã có dịch vụ khác. Không chạy trên production.

```powershell
# Từ thư mục gốc dự án, sau khi đã cài Python dependencies vào .venv
cd warehouse-management-front-end
npm.cmd ci
$env:E2E_ALLOW_WRITES = '1'
$env:E2E_TARGET = 'local'
Remove-Item Env:DATABASE_URL,Env:DB_HOST,Env:DB_NAME -ErrorAction SilentlyContinue
npm.cmd run test:e2e
```

Mặc định dùng Chrome cài trên máy. Nếu không có Chrome, chạy `npx.cmd playwright install chromium` và đặt `$env:E2E_CHROME_CHANNEL = 'chromium'` trước khi chạy. Có thể chạy một nhóm bằng `npm.cmd run test:e2e -- --grep 'Nhập kho'`. Bộ test tự tạo mật khẩu và token tạm trong manifest cục bộ bị Git bỏ qua; không commit hoặc chia sẻ manifest, trace hay ảnh chụp khi chưa kiểm tra nội dung.

Sau khi backend/frontend đã dừng, xóa đúng dữ liệu của một lần chạy bằng:

```powershell
..\.venv\Scripts\python.exe ..\tests\e2e_cleanup.py <E2E_RUN_ID>
```

`E2E_RUN_ID` là tên file `.json` tương ứng trong `tests/.e2e-data/`, bỏ đuôi. Script chỉ xóa đúng file `.json` và `.sqlite` theo ID đó, không xóa hàng loạt.

## Ma trận ca đã viết

| Nhóm | Vai trò và trạng thái | Tình huống / kết quả phải kiểm tra | Test trong `warehouse.spec.js` |
| --- | --- | --- | --- |
| Tài khoản | Khách, quản lý, tài khoản chờ duyệt/khóa | Sai mật khẩu, chờ duyệt, khóa bị từ chối; đăng nhập đúng vào UI; route riêng yêu cầu đăng nhập | A. đăng nhập |
| Phân quyền | Bán hàng, thủ kho, giao hàng, quản lý | API cấm tạo sản phẩm, xem quỹ, xem đơn sai vai trò; yêu cầu ID không tồn tại trả lỗi | A. route/API |
| Danh mục | Quản lý, bán hàng | Tạo sản phẩm qua UI rồi đọc API; combo hai thành phần có trên UI/API; bán hàng không được sửa combo | B. hai test |
| Nhập kho | Thủ kho, kế toán | UI tạo phiếu có phí nhập, tồn tăng; UI trả một phần, nợ giảm và quỹ giảm; API chặn trả dưới mức tối thiểu, quá nợ và sai quyền | C. hai test |
| Điều chuyển | Thủ kho, nhân viên bán | UI cấp hàng; tồn kho giảm và tồn nhân viên tăng | D. cấp hàng |
| Đơn và chuyển vai trò | Bán hàng → thủ kho → giao hàng → kế toán | Đơn nháp có khuyến mãi, gửi kho, nhận việc, xử lý, giao, hoàn thành; tồn, tiền, quỹ, công nợ, doanh thu và chống hoàn thành lặp | E–G. hành trình |
| Chi phí và giá | Quản lý | Chưa chi không phân bổ; ghi chi mới phân bổ và trừ quỹ; hủy chi hoàn quỹ | H. chi phí |
| Hàng hư | Thủ kho → quản lý | Lập phiếu trừ tồn theo quy tắc hiện tại, duyệt giữ tồn, duyệt lại bị chặn, thủ kho không được duyệt | I. hàng hư |
| Tìm kiếm và phân trang | Quản lý | Tạo 12 sản phẩm thử, API trả total/trang đúng, UI hiển thị 10 rồi 2 | J. phân trang |

## Khoảng trống cần bổ sung trước khi xem đây là bộ E2E toàn diện

- Chưa có ca trình duyệt cho đăng xuất, refresh token/thu hồi phiên, OTP/mail sink, yêu cầu sản phẩm, từ chối hàng hư, mở/điều chỉnh quỹ, lương, đơn combo nhiều bộ, bán từ tồn nhân viên, hủy/trả hàng sau giao, công nợ nhiều đợt, từ chối khuyến mãi và xuất PDF/Excel.
- Chưa chạy hai thao tác đồng thời trên MySQL test/staging. SQLite local chỉ xác minh luồng cơ bản; không đại diện khóa và transaction MySQL.
- Chưa có test mất mạng/trình duyệt thứ hai, VAT đầu ra, đơn bắc qua hai kỳ báo cáo và tải lớn. Không dùng kết quả E2E này để kết luận chịu tải.
- Một số điều kiện biên và công thức chi tiết đã có test integration trong `tests/test_prelaunch_checklist.py`; chúng không thay thế E2E trình duyệt.

Trace và screenshot lỗi được tạo trong `warehouse-management-front-end/test-results/e2e/` (Git bỏ qua). Sau khi kiểm tra và bỏ dữ liệu nhạy cảm, có thể mở trace bằng `npx.cmd playwright show-trace <đường-dẫn-trace.zip>`.
