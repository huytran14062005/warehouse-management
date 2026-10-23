from functools import wraps

import jwt
from flask import current_app, jsonify, request

from web.models import Employee
from web.services.token_service import revoke_all_refresh_sessions


def _decode_access_token(auth_header):
    scheme, token = auth_header.split()

    if scheme.lower() != "bearer":
        raise jwt.InvalidTokenError

    return jwt.decode(
        token,
        current_app.config["JWT_SECRET"],
        algorithms=["HS256"],
        options={"require": ["employee_id", "iat", "exp"]},
    )


def verify_token(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization")

        if not auth_header:
            return jsonify({"error": "Chưa đăng nhập"}), 401

        try:
            decoded = _decode_access_token(auth_header)
            employee = Employee.query.get(decoded["employee_id"])

            if not employee:
                return jsonify({"error": "Tài khoản không tồn tại"}), 401

            if employee.is_locked:
                return jsonify({"error": "Tài khoản đã bị khóa"}), 403

            if not employee.is_approved:
                return jsonify({"error": "Tài khoản phải được duyệt bởi quản lý."}), 403

            if decoded.get("role") and decoded["role"] != employee.role.value:
                revoke_all_refresh_sessions(employee.id)
                return jsonify({"error": "Phiên đăng nhập cần được làm mới"}), 401

            request.employee_id = employee.id
            request.username = employee.username
            request.employee_role = employee.role.value
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token đã hết hạn"}), 401
        except (jwt.InvalidTokenError, ValueError):
            # Invalid credentials are authentication failures. Returning 401
            # allows the frontend to refresh the access token; 403 remains for
            # an authenticated user who lacks permission.
            return jsonify({"error": "Token không hợp lệ"}), 401

        return f(*args, **kwargs)

    return decorated


def verify_role(*allowed_roles):
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            if request.employee_role not in [r.value for r in allowed_roles]:
                return jsonify({"error": "Không có quyền truy cập"}), 403
            return f(*args, **kwargs)

        return decorated

    return decorator
