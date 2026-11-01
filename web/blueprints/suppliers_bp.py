from flask import Blueprint, jsonify, request

from web.blueprints.api_errors import handle_api_errors
from web.middleware.auth_middleware import verify_role, verify_token
from web.models import EmployeeRole, Supplier
from web.services.supplier_service import (
    create_supplier_service,
    delete_supplier_service,
    get_supplier_service,
    serialize_supplier,
    supplier_has_history,
    update_supplier_service,
)
from web.utils.pagination import build_pagination


suppliers_bp = Blueprint("suppliers", __name__, url_prefix="/api/suppliers")


@suppliers_bp.route("", methods=["POST"])
@verify_token
@verify_role(EmployeeRole.QUAN_LY)
@handle_api_errors
def create_supplier():
    data = request.get_json(silent=True) or {}
    supplier = create_supplier_service(
        request.employee_id,
        data.get("name"),
        data.get("phone"),
        data.get("address"),
    )
    return jsonify({
        "message": "Đã thêm nhà cung cấp",
        "supplier": serialize_supplier(supplier),
    }), 201


@suppliers_bp.route("", methods=["GET"])
@verify_token
@verify_role(EmployeeRole.THU_KHO, EmployeeRole.KE_TOAN, EmployeeRole.QUAN_LY)
@handle_api_errors
def get_suppliers():
    keyword = str(request.args.get("keyword") or "").strip()
    try:
        page = max(1, int(request.args.get("page", 1)))
    except (TypeError, ValueError):
        page = 1
    try:
        per_page = max(1, int(request.args.get("per_page", 10)))
    except (TypeError, ValueError):
        per_page = 10
    query = Supplier.query
    if keyword:
        query = query.filter(Supplier.name.ilike(f"%{keyword}%"))
    query = query.order_by(Supplier.name.asc())
    total = query.count()
    suppliers = query.offset((page - 1) * per_page).limit(per_page).all()
    return jsonify({
        "suppliers": [serialize_supplier(supplier) for supplier in suppliers],
        "pagination": build_pagination(page, per_page, total),
    }), 200


@suppliers_bp.route("/<int:supplier_id>", methods=["GET"])
@verify_token
@verify_role(EmployeeRole.THU_KHO, EmployeeRole.KE_TOAN, EmployeeRole.QUAN_LY)
@handle_api_errors
def get_supplier(supplier_id):
    supplier = get_supplier_service(supplier_id)
    return jsonify({
        "supplier": {
            **serialize_supplier(supplier),
            "can_delete": not supplier_has_history(supplier_id),
        },
    }), 200


@suppliers_bp.route("/<int:supplier_id>", methods=["PUT"])
@verify_token
@verify_role(EmployeeRole.QUAN_LY)
@handle_api_errors
def update_supplier(supplier_id):
    data = request.get_json(silent=True) or {}
    supplier = update_supplier_service(
        supplier_id,
        request.employee_id,
        data.get("name"),
        data.get("phone"),
        data.get("address"),
    )
    return jsonify({
        "message": "Đã cập nhật nhà cung cấp",
        "supplier": serialize_supplier(supplier),
    }), 200


@suppliers_bp.route("/<int:supplier_id>", methods=["DELETE"])
@verify_token
@verify_role(EmployeeRole.QUAN_LY)
@handle_api_errors
def delete_supplier(supplier_id):
    delete_supplier_service(supplier_id, request.employee_id)
    return jsonify({"message": "Đã xóa nhà cung cấp"}), 200
