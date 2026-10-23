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
    send_account_approved_email(employee)
    return employee


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
        send_account_locked_email(employee)
    else:
        send_account_unlocked_email(employee)
    return employee
