# warehouse-management

## Khởi tạo bảng khuyến mãi

Sau khi cấu hình kết nối cơ sở dữ liệu trong `.env`, chạy một lần:

```powershell
.\.venv\Scripts\python.exe create_promotions_table.py
```

## Production auth session

The frontend runs on GitHub Pages while the API runs on Vercel. Configure these Vercel environment variables so the HttpOnly refresh cookie is sent across the two sites:

```text
APP_ENV=production
REFRESH_COOKIE_SECURE=true
REFRESH_COOKIE_SAMESITE=None
FRONTEND_ORIGINS=https://huytran14062005.github.io
```

The access token is short-lived. The frontend automatically calls `/api/auth/refresh` and retries the pending request. The user only needs to sign in again after the refresh session expires (7 days by default) or is revoked.

Lệnh có thể chạy lại an toàn: bảng chỉ được tạo khi chưa tồn tại và không sửa dữ liệu cũ.
