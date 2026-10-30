from flask import Blueprint, jsonify, request

from web.blueprints.api_errors import handle_api_errors
from web.middleware.auth_middleware import verify_role, verify_token
from web.models import EmployeeRole, Supplier
from web.services.supplier_service import create_supplier_service, serialize_supplier
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
