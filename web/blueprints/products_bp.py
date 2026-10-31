from flask import Blueprint, jsonify, request, send_file

from web.blueprints.api_errors import handle_api_errors
from web.middleware.auth_middleware import verify_role, verify_token
from web.models import EmployeeRole
from web.services.product_service import (
    create_product_request_service,
    create_product_service,
    get_product_detail_service,
    get_products_inventory_service,
    get_product_requests_service,
    serialize_product_request,
    serialize_product_inventory,
    update_product_service,
)
from web.services.price_list_export_service import build_price_list_export
from web.services.inventory_settings_service import get_low_stock_percentage, update_low_stock_percentage
from web.services.product_combo_service import (
    delete_product_combo_service,
    get_product_combo_catalog_service,
    get_product_combos_service,
    save_product_combo_service,
)
from web.services.authorization import (
    scoped_central_warehouse_id,
    scoped_warehouse_id,
)
from web.utils.pagination import build_pagination
from web.utils.query_cache import cached_query


products_bp = Blueprint("products", __name__, url_prefix="/api/products")


@products_bp.route("/combos", methods=["GET"])
@verify_token
@verify_role(EmployeeRole.NHAN_VIEN_BAN_HANG, EmployeeRole.KE_TOAN, EmployeeRole.QUAN_LY)
@handle_api_errors
def get_product_combos():
    return jsonify({"combos": cached_query("product-combos", {}, 300, get_product_combos_service)}), 200


@products_bp.route("/combos/catalog", methods=["GET"])
@verify_token
@verify_role(EmployeeRole.QUAN_LY)
@handle_api_errors
def get_product_combo_catalog():
    return jsonify({"products": cached_query("combo-catalog", {}, 300, get_product_combo_catalog_service)}), 200


@products_bp.route("/combos", methods=["POST"])
@verify_token
@verify_role(EmployeeRole.QUAN_LY)
@handle_api_errors
def create_product_combo():
    data = request.get_json(silent=True) or {}
    combo = save_product_combo_service(None, data.get("name"), data.get("items"))
    return jsonify({"combo": combo, "message": "Đã tạo combo"}), 201


@products_bp.route("/combos/<int:combo_id>", methods=["PUT"])
@verify_token
@verify_role(EmployeeRole.QUAN_LY)
@handle_api_errors
def update_product_combo(combo_id):
    data = request.get_json(silent=True) or {}
    combo = save_product_combo_service(combo_id, data.get("name"), data.get("items"))
    return jsonify({"combo": combo, "message": "Đã cập nhật combo"}), 200


@products_bp.route("/combos/<int:combo_id>", methods=["DELETE"])
@verify_token
@verify_role(EmployeeRole.QUAN_LY)
@handle_api_errors
def delete_product_combo(combo_id):
    delete_product_combo_service(combo_id)
    return jsonify({"message": "Đã xóa combo"}), 200


@products_bp.route("/inventory-threshold", methods=["GET"])
@verify_token
@verify_role(EmployeeRole.NHAN_VIEN_BAN_HANG, EmployeeRole.THU_KHO, EmployeeRole.KE_TOAN, EmployeeRole.QUAN_LY)
@handle_api_errors
def get_inventory_threshold():
    return jsonify({"low_stock_percentage": float(get_low_stock_percentage())}), 200


@products_bp.route("/inventory-threshold", methods=["PUT"])
@verify_token
@verify_role(EmployeeRole.QUAN_LY)
@handle_api_errors
def update_inventory_threshold():
    data = request.get_json(silent=True) or {}
    percentage = update_low_stock_percentage(request.employee_id, data.get("low_stock_percentage"))
    return jsonify({"low_stock_percentage": float(percentage)}), 200


@products_bp.route("/<int:product_id>", methods=["GET"])
@verify_token
@verify_role(EmployeeRole.NHAN_VIEN_BAN_HANG, EmployeeRole.THU_KHO, EmployeeRole.KE_TOAN, EmployeeRole.QUAN_LY)
@handle_api_errors
def get_product_detail(product_id):
    requested_warehouse_id = request.args.get("warehouse_id")
    if request.args.get("source") == "central":
        requested_warehouse_id = scoped_central_warehouse_id(request.employee_id)
    product = get_product_detail_service(
        product_id,
        warehouse_id=scoped_warehouse_id(request.employee_id, requested_warehouse_id),
    )
    return jsonify({"product": product}), 200


@products_bp.route("/<int:product_id>", methods=["PUT"])
@verify_token
@verify_role(EmployeeRole.QUAN_LY)
@handle_api_errors
def update_product(product_id):
    data = request.get_json(silent=True) or {}
    product = update_product_service(
        product_id,
        name=data.get("name"),
        unit=data.get("unit"),
        default_sale_price=data.get("default_sale_price", 0),
    )
    return jsonify({
        "message": "Đã cập nhật sản phẩm thành công",
        "product": {
            "id": product.id,
            "name": product.name,
            "unit": product.unit,
            "default_sale_price": float(product.default_sale_price),
        },
    }), 200


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
    requested_warehouse_id = request.args.get('warehouse_id')
    if request.args.get('source') == 'central':
        requested_warehouse_id = scoped_central_warehouse_id(request.employee_id)
    warehouse_id = scoped_warehouse_id(request.employee_id, requested_warehouse_id)

    def load():
        products_data, total, page, per_page = get_products_inventory_service(
            page_value=request.args.get('page'),
            per_page_value=request.args.get('per_page'),
            keyword=request.args.get('keyword'),
            warehouse_id_value=warehouse_id,
            min_price_value=request.args.get('min_price'),
            max_price_value=request.args.get('max_price'),
            status_value=request.args.get('status'),
        )
        products_list = [
            serialize_product_inventory(item["product"], item["inventory"])
            for item in products_data
        ]
        return {
            'products': products_list,
            'low_stock_percentage': float(get_low_stock_percentage()),
            'pagination': build_pagination(page, per_page, total),
        }

    return jsonify(cached_query(
        "products-inventory",
        {"employee_id": request.employee_id, "warehouse_id": warehouse_id,
         "filters": request.args.to_dict(flat=True)},
        20,
        load,
    )), 200


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
