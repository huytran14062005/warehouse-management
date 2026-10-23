from flask import Blueprint, jsonify, request

from web.blueprints.api_errors import handle_api_errors
from web.middleware.auth_middleware import verify_role, verify_token
from web.models import EmployeeRole
from web.models import DamageReport
from web.services.authorization import ensure_warehouse_access, scoped_warehouse_id
from web.services.damage_report_service import (
    create_damage_report_service,
    get_damage_report_detail_service,
    get_damage_reports_service,
    review_damage_report_service,
    serialize_damage_report,
)
from web.utils.pagination import build_pagination


damage_reports_bp = Blueprint(
    "damage_reports",
    __name__,
    url_prefix="/api/damage-reports",
)


@damage_reports_bp.route("", methods=["GET"])
@verify_token
@verify_role(EmployeeRole.THU_KHO, EmployeeRole.KE_TOAN, EmployeeRole.QUAN_LY)
@handle_api_errors
def get_damage_reports():
    reports, total, page, per_page = get_damage_reports_service(
        page_value=request.args.get("page"),
        per_page_value=request.args.get("per_page"),
        status_value=request.args.get("status"),
        warehouse_id_value=scoped_warehouse_id(request.employee_id, request.args.get("warehouse_id")),
    )
    return jsonify(
        {
            "reports": [serialize_damage_report(report) for report in reports],
            "pagination": build_pagination(page, per_page, total),
        }
    ), 200


@damage_reports_bp.route("", methods=["POST"])
@verify_token
@verify_role(EmployeeRole.THU_KHO)
@handle_api_errors
def create_damage_report():
    data = request.get_json(silent=True) or {}
    report = create_damage_report_service(
        reported_by_employee_id=request.employee_id,
        warehouse_id=data.get("warehouse_id"),
        note=data.get("note"),
        items=data.get("items"),
    )
    return jsonify(
        {
            "message": "Đã tạo phiếu báo hàng hư, chờ quản lý duyệt",
            "report": serialize_damage_report(report),
        }
    ), 201


@damage_reports_bp.route("/<int:report_id>", methods=["GET"])
@verify_token
@verify_role(EmployeeRole.THU_KHO, EmployeeRole.KE_TOAN, EmployeeRole.QUAN_LY)
@handle_api_errors
def get_damage_report_detail(report_id):
    report_record = DamageReport.query.get(report_id)
    if report_record:
        ensure_warehouse_access(request.employee_id, report_record.warehouse_id)
    report = get_damage_report_detail_service(report_id)
    return jsonify(serialize_damage_report(report)), 200


@damage_reports_bp.route("/<int:report_id>/approve", methods=["PATCH"])
@verify_token
@verify_role(EmployeeRole.QUAN_LY)
@handle_api_errors
def approve_damage_report(report_id):
    data = request.get_json(silent=True) or {}
    report = review_damage_report_service(
        report_id=report_id,
        manager_id=request.employee_id,
        decision="approved",
        review_note=data.get("review_note"),
    )
    return jsonify(
        {
            "message": "Đã duyệt phiếu hàng hư",
            "report": serialize_damage_report(report),
        }
    ), 200


@damage_reports_bp.route("/<int:report_id>/reject", methods=["PATCH"])
@verify_token
@verify_role(EmployeeRole.QUAN_LY)
@handle_api_errors
def reject_damage_report(report_id):
    data = request.get_json(silent=True) or {}
    report = review_damage_report_service(
        report_id=report_id,
        manager_id=request.employee_id,
        decision="rejected",
        review_note=data.get("review_note"),
    )
    return jsonify(
        {
            "message": "Đã từ chối phiếu hàng hư",
            "report": serialize_damage_report(report),
        }
    ), 200
