from flask import Blueprint, jsonify, request

from web.blueprints.api_errors import handle_api_errors
from web.middleware.auth_middleware import verify_role, verify_token
from web.models import EmployeeRole
from web.services.pricing_service import (
    apply_suggested_price, create_expense, create_expense_category,
    list_expense_categories, list_expenses, pricing_catalog,
    pay_expense, profitability_report, save_pricing_cycle, save_pricing_policy, void_expense,
)
from web.utils.query_cache import cached_query


pricing_bp = Blueprint("pricing", __name__, url_prefix="/api/pricing")


@pricing_bp.route("/expense-categories", methods=["GET"])
@verify_token
@verify_role(EmployeeRole.QUAN_LY)
@handle_api_errors
def expense_categories():
    return jsonify({"categories": list_expense_categories()}), 200


@pricing_bp.route("/expense-categories", methods=["POST"])
@verify_token
@verify_role(EmployeeRole.QUAN_LY)
@handle_api_errors
def add_expense_category():
    category = create_expense_category(request.employee_id, request.get_json(silent=True) or {})
    return jsonify({"category": category}), 201


@pricing_bp.route("/expenses", methods=["GET"])
@verify_token
@verify_role(EmployeeRole.QUAN_LY)
@handle_api_errors
def expenses():
    params = request.args
    return jsonify(cached_query("pricing-expenses", params.to_dict(flat=True), 30, lambda: list_expenses(
        params.get("from_date"), params.get("to_date"), params.get("page"),
    ))), 200


@pricing_bp.route("/expenses", methods=["POST"])
@verify_token
@verify_role(EmployeeRole.QUAN_LY)
@handle_api_errors
def add_expense():
    expense = create_expense(request.employee_id, request.get_json(silent=True) or {})
    return jsonify({"expense": expense, "message": "Đã ghi nhận chi phí"}), 201


@pricing_bp.route("/expenses/<int:expense_id>/void", methods=["POST"])
@verify_token
@verify_role(EmployeeRole.QUAN_LY)
@handle_api_errors
def void_recorded_expense(expense_id):
    expense = void_expense(request.employee_id, expense_id, (request.get_json(silent=True) or {}).get("reason"))
    return jsonify({"expense": expense, "message": "Đã hủy khoản chi và hoàn quỹ nếu đã thanh toán"}), 200


@pricing_bp.route("/expenses/<int:expense_id>/pay", methods=["POST"])
@verify_token
@verify_role(EmployeeRole.QUAN_LY)
@handle_api_errors
def pay_recorded_expense(expense_id):
    expense = pay_expense(request.employee_id, expense_id, (request.get_json(silent=True) or {}).get("payment_method"))
    return jsonify({"expense": expense, "message": "Đã ghi khoản chi vào sổ quỹ"}), 200


@pricing_bp.route("/catalog", methods=["GET"])
@verify_token
@verify_role(EmployeeRole.QUAN_LY)
@handle_api_errors
def catalog():
    params = request.args
    return jsonify(cached_query("pricing-catalog", params.to_dict(flat=True), 30, lambda: pricing_catalog(
        params.get("page"), params.get("keyword"),
    ))), 200


@pricing_bp.route("/policies/<int:product_id>", methods=["PUT"])
@verify_token
@verify_role(EmployeeRole.QUAN_LY)
@handle_api_errors
def update_policy(product_id):
    policy = save_pricing_policy(request.employee_id, product_id, request.get_json(silent=True) or {})
    return jsonify({"policy": policy}), 200


@pricing_bp.route("/cycle", methods=["PUT"])
@verify_token
@verify_role(EmployeeRole.QUAN_LY)
@handle_api_errors
def update_cycle():
    return jsonify({"cycle": save_pricing_cycle(request.employee_id, request.get_json(silent=True) or {})}), 200


@pricing_bp.route("/apply/<int:product_id>", methods=["POST"])
@verify_token
@verify_role(EmployeeRole.QUAN_LY)
@handle_api_errors
def apply_price(product_id):
    payload = request.get_json(silent=True) or {}
    result = apply_suggested_price(product_id, payload.get("expected_price"), payload.get("expected_suggested_price"))
    return jsonify(result), 200


@pricing_bp.route("/profitability", methods=["GET"])
@verify_token
@verify_role(EmployeeRole.QUAN_LY)
@handle_api_errors
def profitability():
    params = request.args
    return jsonify(cached_query("pricing-profitability", params.to_dict(flat=True), 30, lambda: profitability_report(
        params.get("from_date"), params.get("to_date"), params.get("page"),
    ))), 200
