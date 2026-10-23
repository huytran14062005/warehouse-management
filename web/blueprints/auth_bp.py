from flask import Blueprint, current_app, jsonify, request

from web.blueprints.api_errors import handle_api_errors
from web.services.auth_service import login_service, register_service
from web.services.password_reset_service import (
    request_password_reset_service,
    reset_password_service,
    verify_password_reset_otp_service,
)
from web.services.token_service import (
    create_access_token,
    create_refresh_session,
    revoke_refresh_session,
    rotate_refresh_session,
)
from web.middleware.rate_limit import rate_limit


auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


def _origin_is_allowed():
    origin = request.headers.get("Origin")
    return not origin or origin in current_app.config.get("FRONTEND_ORIGINS", [])


def _reject_untrusted_origin():
    if not _origin_is_allowed():
        return jsonify({"error": "Nguồn yêu cầu không được phép"}), 403
    return None


def _set_refresh_cookie(response, token):
    max_age = current_app.config["JWT_REFRESH_TOKEN_EXPIRES_DAYS"] * 24 * 60 * 60
    secure = current_app.config["REFRESH_COOKIE_SECURE"]
    samesite = current_app.config["REFRESH_COOKIE_SAMESITE"]
    partitioned = secure and str(samesite).lower() == "none"

    response.set_cookie(
        key=current_app.config["REFRESH_COOKIE_NAME"],
        value=token,
        max_age=max_age,
        httponly=True,
        secure=secure,
        samesite=samesite,
        partitioned=partitioned,
        path="/api/auth",
    )
    return response


def _clear_refresh_cookie(response):
    secure = current_app.config["REFRESH_COOKIE_SECURE"]
    samesite = current_app.config["REFRESH_COOKIE_SAMESITE"]
    partitioned = secure and str(samesite).lower() == "none"

    response.delete_cookie(
        key=current_app.config["REFRESH_COOKIE_NAME"],
        secure=secure,
        samesite=samesite,
        partitioned=partitioned,
        path="/api/auth",
    )
    return response


@auth_bp.route("/login", methods=["POST"])
@rate_limit("login", limit=5, window_seconds=60)
@handle_api_errors
def login_process():
    rejected = _reject_untrusted_origin()
    if rejected:
        return rejected
    data = request.get_json(silent=True) or {}

    employee = login_service(data.get("username", ""), data.get("password", ""))

    access_token = create_access_token(employee)
    refresh_token = create_refresh_session(employee)

    response = jsonify({
        "message": "Đăng nhập thành công",
        "token": access_token,
        "user": {
            "id": employee.id,
            "username": employee.username,
            "full_name": employee.full_name,
            "role": employee.role.value,
        },
    })

    return _set_refresh_cookie(response, refresh_token), 200


@auth_bp.route("/forgot-password/request", methods=["POST"])
@rate_limit("forgot-password-request", limit=3, window_seconds=300)
@handle_api_errors
def request_password_reset():
    rejected = _reject_untrusted_origin()
    if rejected:
        return rejected
    data = request.get_json(silent=True) or {}
    challenge_token = request_password_reset_service(data.get("email", ""))
    return jsonify({
        "message": "Nếu email hợp lệ, mã OTP đã được gửi đến hộp thư của bạn.",
        "challenge_token": challenge_token,
    }), 200


@auth_bp.route("/forgot-password/verify", methods=["POST"])
@rate_limit("forgot-password-verify", limit=10, window_seconds=300)
@handle_api_errors
def verify_password_reset_otp():
    rejected = _reject_untrusted_origin()
    if rejected:
        return rejected
    data = request.get_json(silent=True) or {}
    reset_token = verify_password_reset_otp_service(
        email=data.get("email", ""),
        otp=data.get("otp", ""),
        challenge_token=data.get("challenge_token") or data.get("challengeToken"),
    )
    return jsonify({"reset_token": reset_token}), 200


@auth_bp.route("/forgot-password/reset", methods=["POST"])
@rate_limit("forgot-password-reset", limit=10, window_seconds=300)
@handle_api_errors
def reset_password():
    rejected = _reject_untrusted_origin()
    if rejected:
        return rejected
    data = request.get_json(silent=True) or {}
    confirm = data.get("confirm_password", data.get("confirmPassword"))
    reset_password_service(
        reset_token=data.get("reset_token") or data.get("resetToken"),
        new_password=str(data.get("new_password", "") or data.get("newPassword", "")),
        confirm_password=None if confirm is None else str(confirm),
    )
    return jsonify({"message": "Đổi mật khẩu thành công."}), 200


@auth_bp.route("/refresh", methods=["POST"])
@rate_limit("refresh", limit=20, window_seconds=60)
@handle_api_errors
def refresh_access_token():
    rejected = _reject_untrusted_origin()
    if rejected:
        return rejected
    refresh_token = request.cookies.get(current_app.config["REFRESH_COOKIE_NAME"])
    employee, rotated_token = rotate_refresh_session(refresh_token)

    response = jsonify({"token": create_access_token(employee)})
    return _set_refresh_cookie(response, rotated_token), 200


@auth_bp.route("/logout", methods=["POST"])
@handle_api_errors
def logout_process():
    rejected = _reject_untrusted_origin()
    if rejected:
        return rejected
    refresh_token = request.cookies.get(current_app.config["REFRESH_COOKIE_NAME"])
    revoke_refresh_session(refresh_token)

    response = jsonify({"message": "Đăng xuất thành công"})
    return _clear_refresh_cookie(response), 200


@auth_bp.route("/register", methods=["POST"])
@rate_limit("register", limit=10, window_seconds=60)
@handle_api_errors
def register_process():
    rejected = _reject_untrusted_origin()
    if rejected:
        return rejected
    data = request.get_json(silent=True) or {}

    register_service(
        full_name=data.get("full_name", ""),
        phone=data.get("phone", ""),
        username=data.get("username", ""),
        email=data.get("email", ""),
        password=data.get("password", ""),
        confirm=data.get("confirm", ""),
        role=data.get("role", ""),
    )

    return jsonify({
        "message": "Đăng ký thành công. Vui lòng chờ quản lý duyệt tài khoản trước khi đăng nhập."
    }), 201


