from flask import Blueprint, jsonify, request, send_file

from web.blueprints.api_errors import handle_api_errors
from web.middleware.auth_middleware import verify_role, verify_token
from web.models import EmployeeRole
from web.services.product_service import (
    get_products_inventory_service,
    serialize_product_inventory,
)
from web.services.price_list_export_service import build_price_list_export
from web.services.authorization import scoped_warehouse_id
from web.utils.pagination import build_pagination


products_bp = Blueprint("products", __name__, url_prefix="/api/products")


@products_bp.route("/inventory", methods=["GET"])
@verify_token
@verify_role(EmployeeRole.NHAN_VIEN_BAN_HANG, EmployeeRole.THU_KHO, EmployeeRole.KE_TOAN, EmployeeRole.QUAN_LY)
@handle_api_errors
def get_products_inventory():
       
    products_data, total, page, per_page = get_products_inventory_service(
        page_value=request.args.get('page'),
        per_page_value=request.args.get('per_page'),
        keyword=request.args.get('keyword'),
        warehouse_id_value=scoped_warehouse_id(request.employee_id, request.args.get('warehouse_id')),
        min_price_value=request.args.get('min_price'),
        max_price_value=request.args.get('max_price'),
        status_value=request.args.get('status'),
    )

    products_list = [
        serialize_product_inventory(item["product"], item["inventory"])
        for item in products_data
    ]

    return jsonify({
        'products': products_list,
        'pagination': build_pagination(page, per_page, total)
    }), 200


@products_bp.route("/price-list/export", methods=["GET"])
@verify_token
@verify_role(EmployeeRole.KE_TOAN, EmployeeRole.QUAN_LY)
@handle_api_errors
def export_price_list():
    output, filename, mimetype = build_price_list_export(
        format_value=request.args.get("format", "pdf"),
        keyword=request.args.get("keyword"),
        min_price_value=request.args.get("min_price"),
        max_price_value=request.args.get("max_price"),
        status_value=request.args.get("status"),
    )
    response = send_file(
        output,
        mimetype=mimetype,
        as_attachment=True,
        download_name=filename,
        max_age=0,
    )
    response.headers["Cache-Control"] = "no-store"
    return response
