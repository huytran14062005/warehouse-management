from datetime import datetime, timezone

from flask import Blueprint, jsonify, request

from web.blueprints.api_errors import handle_api_errors
from web.config import Config
from web.middleware.auth_middleware import verify_role, verify_token
from web.models import (
    DamageReport,
    DamageReportStatus,
    DiscountStatus,
    Employee,
    EmployeeRole,
    InvoiceStatus,
    SalesInvoice,
)
from web.services.employee_account_service import (
    approve_employee_service,
    list_employee_accounts_service,
    set_employee_lock_service,
)
from web.services.validators import parse_bool
from web.utils.pagination import build_pagination


employee_accounts_bp = Blueprint(
    "employee_accounts", __name__, url_prefix="/api/admin/employees"
)


def _parse_page(value, default=1):
    try:
        return max(1, int(value))
    except (TypeError, ValueError):
        return default


def _parse_per_page(value):
    try:
        return min(Config.MAX_PAGE_SIZE, max(1, int(value)))
    except (TypeError, ValueError):
        return Config.APPLICATION_SIZE


def _serialize_employee(employee):
    return {
        "id": employee.id,
        "full_name": employee.full_name,
        "phone": employee.phone,
        "username": employee.username,
        "email": employee.email,
        "role": employee.role.value,
        "is_locked": bool(employee.is_locked),
        "is_approved": bool(employee.is_approved),
        "approved_at": employee.approved_at.isoformat() if employee.approved_at else None,
        "created_at": employee.created_at.isoformat() if employee.created_at else None,
    }


@employee_accounts_bp.route("", methods=["GET"])
@verify_token
@verify_role(EmployeeRole.QUAN_LY)
@handle_api_errors
def get_employee_accounts():
    page = _parse_page(request.args.get("page", 1))
    per_page = _parse_per_page(request.args.get("per_page", Config.APPLICATION_SIZE))
    employees, total = list_employee_accounts_service(
        page=page,
        per_page=per_page,
        keyword=request.args.get("keyword"),
        status=request.args.get("status"),
    )
    return jsonify({
        "employees": [_serialize_employee(employee) for employee in employees],
        "pagination": build_pagination(page, per_page, total),
    }), 200


@employee_accounts_bp.route("/pending-summary", methods=["GET"])
@verify_token
@verify_role(EmployeeRole.QUAN_LY)
@handle_api_errors
def get_pending_requests_summary():
    counts = {
        "accounts": Employee.query.filter(
            Employee.role != EmployeeRole.QUAN_LY,
            Employee.is_approved.is_(False),
        ).count(),
        "damage_reports": DamageReport.query.filter(
            DamageReport.status == DamageReportStatus.PENDING,
        ).count(),
        "discount_invoices": SalesInvoice.query.filter(
            SalesInvoice.discount_status == DiscountStatus.PENDING_APPROVAL,
        ).count(),
        "cancel_requests": SalesInvoice.query.filter(
            SalesInvoice.cancel_requested.is_(True),
            SalesInvoice.status.in_(
                [InvoiceStatus.PROCESSING, InvoiceStatus.DELIVERING]
            ),
        ).count(),
    }
    return jsonify({
        "counts": counts,
        "total": sum(counts.values()),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }), 200


@employee_accounts_bp.route("/<int:employee_id>/approve", methods=["PUT"])
@verify_token
@verify_role(EmployeeRole.QUAN_LY)
@handle_api_errors
def approve_employee(employee_id):
    employee = approve_employee_service(employee_id, request.employee_id)
    return jsonify({
        "message": "Đã duyệt tài khoản. Email thông báo đã được gửi.",
        "employee": _serialize_employee(employee),
    }), 200


@employee_accounts_bp.route("/<int:employee_id>/lock", methods=["PUT"])
@verify_token
@verify_role(EmployeeRole.QUAN_LY)
@handle_api_errors
def update_employee_lock(employee_id):
    data = request.get_json(silent=True) or {}
    employee = set_employee_lock_service(
        employee_id,
        request.employee_id,
        parse_bool(data.get("is_locked"), "is_locked"),
    )
    return jsonify({
        "message": (
            "Đã khóa tài khoản. Email thông báo đã được gửi."
            if employee.is_locked
            else "Đã mở khóa tài khoản. Email thông báo đã được gửi."
        ),
        "employee": _serialize_employee(employee),
    }), 200
