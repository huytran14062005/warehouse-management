from flask import Blueprint, jsonify, request

from web.blueprints.api_errors import handle_api_errors
from web.middleware.auth_middleware import verify_role, verify_token
from web.models import EmployeeRole
from web.services.authorization import scoped_warehouse_id
from web.services.customer_purchase_service import (
    get_customer_order_detail_service,
    get_customer_orders_service,
    get_customer_purchased_products_service,
    serialize_customer_basic,
    serialize_order_detail,
    serialize_order_summary,
)
from web.utils.pagination import build_pagination


customer_purchases_bp = Blueprint("customer_purchases", __name__, url_prefix="/api/customers")


@customer_purchases_bp.route("/<int:customer_id>/orders", methods=["GET"])
@verify_token
@verify_role(EmployeeRole.NHAN_VIEN_BAN_HANG, EmployeeRole.KE_TOAN, EmployeeRole.QUAN_LY)
@handle_api_errors
def get_customer_orders(customer_id):
       
    customer, orders, total, page, per_page = get_customer_orders_service(
        customer_id=customer_id,
        page_value=request.args.get('page'),
        per_page_value=request.args.get('per_page'),
        warehouse_id=scoped_warehouse_id(request.employee_id),
    )

    orders_data = [serialize_order_summary(order) for order in orders]

    return jsonify({
        'customer': serialize_customer_basic(customer),
        'orders': orders_data,
        'pagination': build_pagination(page, per_page, total)
    }), 200


@customer_purchases_bp.route("/<int:customer_id>/orders/<int:order_id>", methods=["GET"])
@verify_token
@verify_role(EmployeeRole.NHAN_VIEN_BAN_HANG, EmployeeRole.KE_TOAN, EmployeeRole.QUAN_LY)
@handle_api_errors
def get_customer_order_detail(customer_id, order_id):
       
    customer, order = get_customer_order_detail_service(
        customer_id=customer_id,
        order_id=order_id,
        warehouse_id=scoped_warehouse_id(request.employee_id),
    )

    return jsonify({
        'customer': serialize_customer_basic(customer),
        'order': serialize_order_detail(order)
    }), 200


@customer_purchases_bp.route("/<int:customer_id>/purchased-products", methods=["GET"])
@verify_token
@verify_role(EmployeeRole.NHAN_VIEN_BAN_HANG, EmployeeRole.KE_TOAN, EmployeeRole.QUAN_LY)
@handle_api_errors
def get_customer_purchased_products(customer_id):
       
    customer, products, total, total_amount, page, per_page = get_customer_purchased_products_service(
        customer_id,
        page_value=request.args.get('page'),
        per_page_value=request.args.get('per_page'),
        warehouse_id=scoped_warehouse_id(request.employee_id),
    )

    products_data = [
        {
            "product_id": p.product_id,
            "product_name": p.product_name,
            "unit": p.unit,
            "total_quantity": int(p.total_quantity),
            "total_amount": float(p.total_amount),
            "last_purchased": p.last_purchased.isoformat() if p.last_purchased else None
        }
        for p in products
    ]

    return jsonify({
        'customer': serialize_customer_basic(customer),
        'products': products_data,
        'summary': {
            'total_products': total,
            'total_spent': total_amount
        },
        'pagination': build_pagination(page, per_page, total),
    }), 200
