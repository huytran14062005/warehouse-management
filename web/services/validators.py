import re

from web.services.exceptions import ValidationError


class Limits:
    USERNAME_MAX = 50
    EMAIL_MAX = 120
    PASSWORD_MIN = 8
    PASSWORD_MAX_BYTES = 72
    FULL_NAME_MAX = 150
    PHONE_MIN = 10
    PHONE_MAX = 11
    OTP_LENGTH = 6


def require_text(value, label, max_length=None):
    text = "" if value is None else str(value).strip()

    if not text:
        raise ValidationError(f"{label} không được để trống")

    if max_length and len(text) > max_length:
        raise ValidationError(f"{label} không được quá {max_length} ký tự")

    return text


def validate_required_fields(**fields):
    for field_name, value in fields.items():
        if value is None or (isinstance(value, str) and not value.strip()):
            raise ValidationError(f"{field_name} không được để trống!")

    return True


def parse_bool(value, field_name="Giá trị"):
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in {"true", "1", "yes"}:
            return True
        if normalized in {"false", "0", "no"}:
            return False
    raise ValidationError(f"{field_name} phải là true hoặc false")


def validate_username_format(username):
    return require_text(username, "Username", Limits.USERNAME_MAX)


def validate_email(email):
    text = require_text(email, "Email", Limits.EMAIL_MAX).lower()
    if not re.fullmatch(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", text):
        raise ValidationError("Email không đúng định dạng")
    return text


def require_otp_code(otp):
    text = str(otp or "").strip()
    if not text:
        raise ValidationError("Vui lòng nhập mã OTP")
    if not text.isdigit() or len(text) != Limits.OTP_LENGTH:
        raise ValidationError(f"Mã OTP phải gồm đúng {Limits.OTP_LENGTH} chữ số")
    return text


def validate_full_name(full_name):
    return require_text(full_name, "Họ tên", Limits.FULL_NAME_MAX)


def validate_phone(phone):
    text = re.sub(r"[\s-]", "", require_text(phone, "Số điện thoại"))

    if not text.isdigit() or not (Limits.PHONE_MIN <= len(text) <= Limits.PHONE_MAX):
        raise ValidationError("Số điện thoại không hợp lệ")

    if not text.startswith("0"):
        raise ValidationError("Số điện thoại phải bắt đầu bằng số 0")

    return text


def validate_password_strength(password):
    text = "" if password is None else str(password)

    if len(text) < Limits.PASSWORD_MIN:
        raise ValidationError(f"Password phải có ít nhất {Limits.PASSWORD_MIN} ký tự.")

    if len(text.encode("utf-8")) > Limits.PASSWORD_MAX_BYTES:
        raise ValidationError(f"Password không được quá {Limits.PASSWORD_MAX_BYTES} bytes.")

    if not re.search(r"[A-Z]", text):
        raise ValidationError("Password phải chứa ít nhất một chữ hoa.")
    if not re.search(r"[a-z]", text):
        raise ValidationError("Password phải chứa ít nhất một chữ thường.")
    if not re.search(r"[0-9]", text):
        raise ValidationError("Password phải chứa ít nhất một chữ số.")
    if not re.search(r"[^A-Za-z0-9]", text):
        raise ValidationError("Password phải chứa ít nhất một ký tự đặc biệt.")

    return text


def validate_password_confirmation(password, confirm):
    if password != confirm:
        raise ValidationError("Mật khẩu xác nhận không khớp.")

    return True


