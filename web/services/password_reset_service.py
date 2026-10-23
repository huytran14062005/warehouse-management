import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

from flask_mail import Message
from flask import current_app

from web import dao, mail
from web.services.exceptions import AppError, AuthenticationError, NotFoundError, ValidationError
from web.services.token_service import revoke_all_refresh_sessions
from web.services.validators import (
    validate_email,
    validate_password_confirmation,
    validate_password_strength,
    require_otp_code,
)


OTP_TTL = timedelta(minutes=5)
RESET_TOKEN_TTL = timedelta(minutes=10)
MAX_OTP_ATTEMPTS = 5

# The application currently runs as a single Flask process. These stores keep
# the implementation consistent with job-portal without adding another table.
# A production multi-instance deployment should move them to a shared store.
_password_reset_requests = {}
_password_reset_tokens = {}


def _now():
    return datetime.now(timezone.utc)


def _cleanup_expired_state():
    now = _now()
    for store in (_password_reset_requests, _password_reset_tokens):
        expired = [
            key for key, value in store.items()
            if value["expires_at"] <= now
        ]
        for key in expired:
            store.pop(key, None)


def _otp_digest(otp):
    secret = str(current_app.config["SECRET_KEY"]).encode("utf-8")
    return hmac.new(secret, otp.encode("utf-8"), hashlib.sha256).hexdigest()


def _send_otp_email(employee, otp):
    message = Message(
        subject="Mã OTP khôi phục mật khẩu - Warehouse Management",
        recipients=[employee.email],
        body=(
            f"Xin chào {employee.full_name},\n\n"
            f"Mã OTP khôi phục mật khẩu của bạn là: {otp}\n"
            "Mã có hiệu lực trong 5 phút và chỉ được sử dụng một lần.\n\n"
            "Nếu bạn không yêu cầu đổi mật khẩu, hãy bỏ qua email này."
        ),
    )
    mail.send(message)


def _send_account_status_email(employee, subject, body):
    if not employee.email:
        return
    mail.send(Message(subject=subject, recipients=[employee.email], body=body))


def send_account_approved_email(employee):
    _send_account_status_email(
        employee,
        "Tài khoản đã được duyệt - Warehouse Management",
        (
            f"Xin chào {employee.full_name},\n\n"
            "Tài khoản của bạn đã được quản lý duyệt và có thể đăng nhập vào hệ thống.\n"
            "Nếu bạn không thực hiện đăng ký tài khoản này, hãy liên hệ quản lý."
        ),
    )


def send_account_locked_email(employee):
    _send_account_status_email(
        employee,
        "Thông báo tài khoản bị khóa - Warehouse Management",
        (
            f"Xin chào {employee.full_name},\n\n"
            "Tài khoản của bạn đã bị quản lý khóa và hiện không thể đăng nhập vào hệ thống.\n"
            "Vui lòng liên hệ quản lý nếu cần được hỗ trợ."
        ),
    )


def send_account_unlocked_email(employee):
    _send_account_status_email(
        employee,
        "Thông báo tài khoản đã được mở khóa - Warehouse Management",
        (
            f"Xin chào {employee.full_name},\n\n"
            "Tài khoản của bạn đã được quản lý mở khóa và có thể tiếp tục đăng nhập vào hệ thống.\n"
            "Nếu bạn không thực hiện yêu cầu này, hãy liên hệ quản lý."
        ),
    )


def request_password_reset_service(email):
    clean_email = validate_email(email)
    _cleanup_expired_state()

    employee = dao.get_employee_by_email(clean_email)
    otp = f"{secrets.randbelow(1_000_000):06d}"
    challenge_token = secrets.token_urlsafe(32)

    _password_reset_requests[challenge_token] = {
        "email": clean_email,
        "employee_id": employee.id if employee and not employee.is_locked else None,
        "otp_digest": _otp_digest(otp),
        "expires_at": _now() + OTP_TTL,
        "attempts": 0,
    }

    if employee and not employee.is_locked:
        try:
            _send_otp_email(employee, otp)
        except Exception as ex:
            _password_reset_requests.pop(challenge_token, None)
            current_app.logger.exception("Password reset email could not be sent")
            raise AppError("Không thể gửi email lúc này. Vui lòng thử lại sau.", status_code=503) from ex

    # Keep the response identical for existing and unknown addresses.
    return challenge_token


def verify_password_reset_otp_service(email, otp, challenge_token):
    clean_email = validate_email(email)
    clean_otp = require_otp_code(otp)
    challenge_token = str(challenge_token or "").strip()
    if not challenge_token:
        raise ValidationError("Yêu cầu OTP không hợp lệ hoặc đã hết hạn.")

    _cleanup_expired_state()
    challenge = _password_reset_requests.get(challenge_token)
    if not challenge or challenge["email"] != clean_email or not challenge["employee_id"]:
        raise ValidationError("Yêu cầu OTP không hợp lệ hoặc đã hết hạn.")

    if challenge["attempts"] >= MAX_OTP_ATTEMPTS:
        _password_reset_requests.pop(challenge_token, None)
        raise AppError("Bạn đã nhập sai OTP quá số lần cho phép.", status_code=429)

    if not hmac.compare_digest(challenge["otp_digest"], _otp_digest(clean_otp)):
        challenge["attempts"] += 1
        remaining = MAX_OTP_ATTEMPTS - challenge["attempts"]
        raise ValidationError(f"Mã OTP không đúng. Bạn còn {remaining} lần thử.")

    _password_reset_requests.pop(challenge_token, None)
    reset_token = secrets.token_urlsafe(32)
    _password_reset_tokens[reset_token] = {
        "employee_id": challenge["employee_id"],
        "expires_at": _now() + RESET_TOKEN_TTL,
    }
    return reset_token


def reset_password_service(reset_token, new_password, confirm_password=None):
    _cleanup_expired_state()
    reset_token = str(reset_token or "").strip()
    if not reset_token:
        raise ValidationError("Token đổi mật khẩu không hợp lệ hoặc đã hết hạn.")

    reset_request = _password_reset_tokens.get(reset_token)
    if not reset_request:
        raise ValidationError("Token đổi mật khẩu không hợp lệ hoặc đã hết hạn.")

    validate_password_strength(new_password)
    if confirm_password is not None:
        validate_password_confirmation(new_password, confirm_password)

    employee = dao.get_employee_by_id(reset_request["employee_id"])
    if not employee:
        raise NotFoundError("Tài khoản không tồn tại.")
    if employee.is_locked:
        raise AuthenticationError("Tài khoản đang bị khóa.")

    dao.update_employee_password(employee, new_password)
    revoke_all_refresh_sessions(employee.id)
    _password_reset_tokens.pop(reset_token, None)
    return employee
