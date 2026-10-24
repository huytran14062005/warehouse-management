from flask import Blueprint, jsonify, request

from web.blueprints.api_errors import handle_api_errors
from web.middleware.auth_middleware import verify_role, verify_token
from web.models import EmployeeRole
from web.services.promotion_service import (
    create_promotion,
    delete_promotion,
    list_promotions,
    serialize_promotion,
    update_promotion,
)


promotions_bp = Blueprint("promotions", __name__, url_prefix="/api/promotions")


@promotions_bp.route("", methods=["GET"])
@verify_token
@verify_role(
    EmployeeRole.NHAN_VIEN_BAN_HANG,
    EmployeeRole.KE_TOAN,
    EmployeeRole.QUAN_LY,
)
@handle_api_errors
def get_promotions():
    include_inactive = (
        request.args.get("include_inactive", "false").strip().lower() == "true"
        and request.employee_role == EmployeeRole.QUAN_LY.value
    )
    subtotal = request.args.get("subtotal")
    total_quantity = request.args.get("total_quantity")
    evaluate = subtotal not in (None, "") and total_quantity not in (None, "")
    promotions = list_promotions(include_inactive=include_inactive)
    return jsonify(
        {
            "promotions": [
                serialize_promotion(
                    promotion,
                    subtotal=subtotal if evaluate else None,
                    total_quantity=total_quantity if evaluate else None,
                )
                for promotion in promotions
            ],
            "total": len(promotions),
        }
    ), 200


@promotions_bp.route("", methods=["POST"])
@verify_token
@verify_role(EmployeeRole.QUAN_LY)
@handle_api_errors
def create_promotion_route():
    promotion = create_promotion(request.get_json(silent=True) or {}, request.employee_id)
    return jsonify(
        {
            "message": "Tạo khuyến mãi thành công",
            "promotion": serialize_promotion(promotion),
        }
    ), 201


@promotions_bp.route("/<int:promotion_id>", methods=["PUT"])
@verify_token
@verify_role(EmployeeRole.QUAN_LY)
@handle_api_errors
def update_promotion_route(promotion_id):
    promotion = update_promotion(
        promotion_id,
        request.get_json(silent=True) or {},
    )
    return jsonify(
        {
            "message": "Cập nhật khuyến mãi thành công",
            "promotion": serialize_promotion(promotion),
        }
    ), 200


@promotions_bp.route("/<int:promotion_id>", methods=["DELETE"])
@verify_token
@verify_role(EmployeeRole.QUAN_LY)
@handle_api_errors
def delete_promotion_route(promotion_id):
    delete_promotion(promotion_id)
    return jsonify({"message": "Đã xóa khuyến mãi"}), 200
