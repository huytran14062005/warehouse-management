from flask import current_app

from web import dao
from web.models import EmployeeRole
from web.services.exceptions import ForbiddenError, NotFoundError, ValidationError
from web.services.password_reset_service import (
    send_account_approved_email,
    send_account_locked_email,
    send_account_unlocked_email,
)
from web.services.token_service import revoke_all_refresh_sessions
from web.services.validators import parse_bool


ACCOUNT_STATUSES = {"pending", "approved", "locked", "active"}


def _send_status_notification(employee, send_email, action):
    """Email is secondary to the committed account change."""
    sender = current_app.config.get("MAIL_DEFAULT_SENDER")
    sender_address = sender[1] if isinstance(sender, (tuple, list)) else sender
    if not employee.email or not sender_address:
        current_app.logger.warning("%s email skipped: missing recipient or sender", action)
        return False

    if str(current_app.config.get("MAIL_SERVER", "")).lower() in {
        "smtp.gmail.com", "smtp.googlemail.com"
    } and not (current_app.config.get("MAIL_USERNAME") and current_app.config.get("MAIL_PASSWORD")):
        current_app.logger.warning("%s email skipped: Gmail SMTP credentials are not configured", action)
        return False

    try:
        send_email(employee)
    except Exception:
        current_app.logger.exception("%s email failed after account update for employee %s", action, employee.id)
        return False
    return True


def _require_manager(actor_id):
    actor = dao.get_employee_by_id(actor_id)
    if not actor or actor.role != EmployeeRole.QUAN_LY:
        raise ForbiddenError("Chỉ quản lý mới được thực hiện thao tác này")
    return actor


def _get_manageable_employee(employee_id):
    employee = dao.get_employee_by_id(employee_id)
    if not employee or employee.role == EmployeeRole.QUAN_LY:
        raise NotFoundError("Không tìm thấy tài khoản nhân viên")
    return employee


def list_employee_accounts_service(page, per_page, keyword=None, status=None):
    status = (status or "").strip().lower() or None
    if status and status not in ACCOUNT_STATUSES:
        raise ValidationError("Trạng thái tài khoản không hợp lệ")
    rows, total = dao.get_manageable_employees(
        page=page,
        per_page=per_page,
        keyword=(keyword or "").strip() or None,
        status=status,
    )
    return rows, total


def approve_employee_service(employee_id, actor_id):
    _require_manager(actor_id)
    employee = _get_manageable_employee(employee_id)
    if employee.is_approved:
        raise ValidationError("Tài khoản đã được duyệt trước đó")
    if employee.is_locked:
        raise ValidationError("Không thể duyệt tài khoản đang bị khóa")
    employee = dao.approve_employee(employee)
    email_sent = _send_status_notification(employee, send_account_approved_email, "Account approval")
    return employee, email_sent


def set_employee_lock_service(employee_id, actor_id, is_locked):
    _require_manager(actor_id)
    employee = _get_manageable_employee(employee_id)
    locked = parse_bool(is_locked, "is_locked")
    if employee.is_locked == locked:
        state = "khóa" if locked else "mở khóa"
        raise ValidationError(f"Tài khoản đã ở trạng thái {state}")
    employee = dao.set_employee_locked(employee, locked)
    if locked:
        revoke_all_refresh_sessions(employee.id)
        email_sent = _send_status_notification(employee, send_account_locked_email, "Account lock")
    else:
        email_sent = _send_status_notification(employee, send_account_unlocked_email, "Account unlock")
    return employee, email_sent
