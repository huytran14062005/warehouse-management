from flask import Blueprint, jsonify, request, send_file

from web.blueprints.api_errors import handle_api_errors
from web.middleware.auth_middleware import verify_role, verify_token
from web.models import EmployeeRole
from web.services.product_service import (
    create_product_request_service,
    create_product_service,
    get_products_inventory_service,
    get_product_requests_service,
    serialize_product_request,
    serialize_product_inventory,
)
from web.services.price_list_export_service import build_price_list_export
from web.services.authorization import scoped_warehouse_id
from web.utils.pagination import build_pagination


products_bp = Blueprint("products", __name__, url_prefix="/api/products")


@products_bp.route("", methods=["POST"])
@verify_token
@verify_role(EmployeeRole.QUAN_LY)
@handle_api_errors
def create_product():
    data = request.get_json(silent=True) or {}
    product, product_request = create_product_service(
        name=data.get("name"),
        unit=data.get("unit"),
        default_sale_price=data.get("default_sale_price", 0),
        request_id=data.get("request_id"),
    )
    return jsonify({
        "message": "Đã thêm sản phẩm thành công",
        "product": {
            "id": product.id,
            "name": product.name,
            "unit": product.unit,
            "default_sale_price": float(product.default_sale_price),
        },
        "request": serialize_product_request(product_request) if product_request else None,
    }), 201


@products_bp.route("/requests", methods=["GET"])
@verify_token
@verify_role(EmployeeRole.QUAN_LY)
@handle_api_errors
def get_product_requests():
    requests = get_product_requests_service(request.args.get("status", "pending"))
    return jsonify({"requests": [serialize_product_request(item) for item in requests]}), 200


@products_bp.route("/requests", methods=["POST"])
@verify_token
@verify_role(EmployeeRole.NHAN_VIEN_BAN_HANG, EmployeeRole.THU_KHO)
@handle_api_errors
def create_product_request():
    data = request.get_json(silent=True) or {}
    product_request = create_product_request_service(
        employee_id=request.employee_id,
        name=data.get("name"),
        unit=data.get("unit"),
        note=data.get("note", ""),
    )
    return jsonify({
        "message": "Đã gửi yêu cầu thêm sản phẩm đến quản lý",
        "request": serialize_product_request(product_request),
    }), 201


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
