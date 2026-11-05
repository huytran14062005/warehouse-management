from flask import Blueprint, jsonify, request

from web.blueprints.api_errors import handle_api_errors
from web.middleware.auth_middleware import verify_role, verify_token
from web.models import EmployeeRole
from web.services.sales_area_service import create_sales_area_service, serialize_sales_area
from web import dao


sales_areas_bp = Blueprint("sales_areas", __name__, url_prefix="/api/sales-areas")


@sales_areas_bp.route("", methods=["GET"])
@verify_token
@verify_role(EmployeeRole.NHAN_VIEN_BAN_HANG, EmployeeRole.KE_TOAN, EmployeeRole.QUAN_LY)
@handle_api_errors
def get_sales_areas():
    areas = dao.get_active_sales_areas()
    return jsonify({"sales_areas": [serialize_sales_area(area) for area in areas], "total": len(areas)}), 200


@sales_areas_bp.route("", methods=["POST"])
@verify_token
@verify_role(EmployeeRole.NHAN_VIEN_BAN_HANG, EmployeeRole.QUAN_LY)
@handle_api_errors
def create_sales_area():
    data = request.get_json(silent=True) or {}
    area = create_sales_area_service(data.get("name"))
    return jsonify({"sales_area": serialize_sales_area(area), "message": "Đã thêm khu vực bán hàng"}), 201
