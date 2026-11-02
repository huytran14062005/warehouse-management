from io import BytesIO

from flask import Blueprint, jsonify, request, send_file

from web.blueprints.api_errors import handle_api_errors
from web.middleware.auth_middleware import verify_role, verify_token
from web.models import EmployeeRole
from web.services.company_fund_service import (
    adjust_company_fund, get_company_fund_export_rows,
    get_company_fund_export_summary, get_company_funds,
    initialize_company_funds, list_company_fund_entries,
)
from web.services.company_fund_export_service import (
    EXCEL_CONTENT_TYPE, build_company_fund_history_workbook,
)


company_funds_bp = Blueprint("company_funds", __name__, url_prefix="/api/company-funds")


@company_funds_bp.route("", methods=["GET"])
@verify_token
@verify_role(EmployeeRole.KE_TOAN, EmployeeRole.QUAN_LY)
@handle_api_errors
def company_funds():
    return jsonify(get_company_funds()), 200


@company_funds_bp.route("/opening", methods=["POST"])
@verify_token
@verify_role(EmployeeRole.QUAN_LY)
@handle_api_errors
def open_company_funds():
    data = request.get_json(silent=True) or {}
    return jsonify(initialize_company_funds(
        request.employee_id, data.get("cash_balance"), data.get("bank_balance"),
    )), 201


@company_funds_bp.route("/adjustments", methods=["POST"])
@verify_token
@verify_role(EmployeeRole.QUAN_LY)
@handle_api_errors
def adjust_company_fund_balance():
    data = request.get_json(silent=True) or {}
    return jsonify(adjust_company_fund(
        request.employee_id, data.get("method"), data.get("new_balance"),
        data.get("expected_balance"), data.get("reason"),
    )), 201


@company_funds_bp.route("/entries", methods=["GET"])
@verify_token
@verify_role(EmployeeRole.KE_TOAN, EmployeeRole.QUAN_LY)
@handle_api_errors
def company_fund_entries():
    return jsonify(list_company_fund_entries(
        request.args.get("method"), request.args.get("page", 1),
    )), 200


@company_funds_bp.route("/entries/export", methods=["GET"])
@verify_token
@verify_role(EmployeeRole.KE_TOAN, EmployeeRole.QUAN_LY)
@handle_api_errors
def export_company_fund_entries():
    method = request.args.get("method") or None
    summary = get_company_fund_export_summary(method)
    content = build_company_fund_history_workbook(
        get_company_fund_export_rows(method), method, summary,
    )
    suffix = {None: "tat-ca", "cash": "tien-mat", "bank_transfer": "ngan-hang"}[method]
    response = send_file(
        BytesIO(content),
        mimetype=EXCEL_CONTENT_TYPE,
        as_attachment=True,
        download_name=f"lich-su-thu-chi-{suffix}.xlsx",
    )
    response.headers["Cache-Control"] = "no-store"
    return response
