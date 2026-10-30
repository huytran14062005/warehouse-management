from flask import Blueprint, jsonify, request

from web.blueprints.api_errors import handle_api_errors
from web.middleware.auth_middleware import verify_role, verify_token
from web.models import EmployeeRole
from web.services.company_fund_service import (
    adjust_company_fund, get_company_funds, initialize_company_funds, list_company_fund_entries,
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
