from flask import Blueprint, jsonify, request

from web.blueprints.api_errors import handle_api_errors
from web.middleware.auth_middleware import verify_role, verify_token
from web.models import EmployeeRole
from web.services.customer_service import (
    get_customer_detail_service,
    get_customers_list_service,
    serialize_customer,
    update_customer_service,
)
from web.services.payment_service import record_old_debt_payment_service
from web.utils.pagination import build_pagination


customers_bp = Blueprint("customers", __name__, url_prefix="/api/customers")


@customers_bp.route("", methods=["GET"])
@verify_token
@verify_role(EmployeeRole.NHAN_VIEN_BAN_HANG, EmployeeRole.KE_TOAN, EmployeeRole.QUAN_LY)
@handle_api_errors
def get_customers_list():
       
    customers, total, page, per_page = get_customers_list_service(
        page_value=request.args.get('page'),
        per_page_value=request.args.get('per_page'),
        keyword=request.args.get('keyword'),
        has_debt=request.args.get('has_debt'),
        debt_min=request.args.get('debt_min'),
        debt_max=request.args.get('debt_max'),
    )

    include_financial = request.employee_role != EmployeeRole.NHAN_VIEN_BAN_HANG.value
    customers_data = [serialize_customer(customer, include_financial=include_financial) for customer in customers]

    return jsonify({
        'customers': customers_data,
        'pagination': build_pagination(page, per_page, total)
    }), 200


@customers_bp.route("/<int:customer_id>", methods=["GET"])
@verify_token
@verify_role(EmployeeRole.NHAN_VIEN_BAN_HANG, EmployeeRole.KE_TOAN, EmployeeRole.QUAN_LY)
@handle_api_errors
def get_customer_detail(customer_id):
       
    customer, statistics, payments, total_payments, page, per_page = get_customer_detail_service(
        customer_id,
        page_value=request.args.get('payment_page'),
        per_page_value=request.args.get('payment_per_page'),
    )

    include_financial = request.employee_role != EmployeeRole.NHAN_VIEN_BAN_HANG.value
    return jsonify({
        "customer": serialize_customer(customer, include_financial=include_financial),
        "statistics": statistics if include_financial else None,
        "payments": [
            {
                "id": payment.id,
                "amount": float(payment.amount),
                "payment_type": payment.payment_type.value,
                "paid_at": payment.paid_at.isoformat(),
                "note": payment.note,
                "employee": {
                    "id": payment.collected_by_employee.id,
                    "full_name": payment.collected_by_employee.full_name,
                },
                "sales_invoice_id": payment.sales_invoice_id,
            }
            for payment in payments
        ] if include_financial else [],
        "payments_pagination": build_pagination(page, per_page, total_payments) if include_financial else build_pagination(1, 10, 0),
    }), 200


@customers_bp.route("/<int:customer_id>", methods=["PUT"])
@verify_token
@verify_role(EmployeeRole.QUAN_LY)
@handle_api_errors
def update_customer(customer_id):
       
    data = request.get_json(silent=True) or {}

    customer = update_customer_service(
        customer_id=customer_id,
        full_name=data.get("full_name", ""),
        phone=data.get("phone", ""),
        address=data.get("address", ""),
        sales_area_id=data.get("sales_area_id"),
        debt_amount=data.get("debt_amount"),
    )

    return jsonify({
        "message": "Cập nhật thông tin khách hàng thành công",
        "customer": serialize_customer(customer),
    }), 200


@customers_bp.route("/<int:customer_id>/payment", methods=["POST"])
@verify_token
@verify_role(EmployeeRole.KE_TOAN, EmployeeRole.QUAN_LY)
@handle_api_errors
def customer_payment(customer_id):
       
    data = request.get_json(silent=True) or {}

    payment, old_debt, new_debt, customer = record_old_debt_payment_service(
        customer_id=customer_id,
        employee_id=request.employee_id,
        amount=data.get("amount"),
        note=data.get("note", "")
    )

    return jsonify({
        "message": "Ghi nhận thanh toán thành công",
        "customer": {
            "id": customer.id,
            "full_name": customer.full_name,
            "phone": customer.phone,
            "address": customer.address,
            "debt_amount_old": float(old_debt),
            "debt_amount_new": float(new_debt),
            "payment_amount": float(payment.amount),
            "payment_type": payment.payment_type.value,
        }
    }), 200
