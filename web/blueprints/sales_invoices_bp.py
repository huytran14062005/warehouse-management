from flask import Blueprint, jsonify, request
from web import dao

from web.blueprints.api_errors import handle_api_errors
from web.middleware.auth_middleware import verify_role, verify_token
from web.services.sales_invoice_service import (
    approve_cancel_request_service,
    approve_discount_service,
    business_today,
    cancel_invoice_service,
    complete_sales_invoice_service,
    confirm_sales_invoice_delivery_service,
    create_sales_invoice_service,
    get_pending_discount_invoices_service,
    get_sales_invoice_detail_service,
    get_sales_invoice_action_count_service,
    get_sales_invoices_list_service,
    get_status_tracking_board_service,
    request_cancel_invoice_service,
    record_sales_invoice_payment_service,
    serialize_invoice_summary,
    serialize_sales_invoice,
    serialize_sales_invoice_payment,
    submit_sales_invoice_to_warehouse_service,
    update_invoice_status_service,
    update_payment_due_date_service,
    update_sales_invoice_service,
)
from web.models import EmployeeRole, SalesInvoice
from web.services.authorization import ensure_warehouse_access, scoped_warehouse_id
from web.services.validators import parse_bool
from web.services.customer_service import parse_page, parse_per_page
from web.services.exceptions import NotFoundError
from web.utils.query_cache import cached_query


sales_invoices_bp = Blueprint("sales_invoices", __name__, url_prefix="/api/sales-invoices")


@sales_invoices_bp.route("/action-count", methods=["GET"])
@verify_token
@verify_role(EmployeeRole.NHAN_VIEN_BAN_HANG, EmployeeRole.THU_KHO, EmployeeRole.KE_TOAN, EmployeeRole.QUAN_LY)
@handle_api_errors
def get_sales_invoice_action_count():
    return jsonify({"total": get_sales_invoice_action_count_service(
        request.employee_id, request.employee_role,
    )}), 200


@sales_invoices_bp.route("/status-board", methods=["GET"])
@verify_token
@verify_role(EmployeeRole.QUAN_LY)
@handle_api_errors
def get_status_tracking_board():
                                                                                       
    statuses = get_status_tracking_board_service()

    return jsonify({
        "statuses": statuses,
        "total": sum(group["total"] for group in statuses),
    }), 200


@sales_invoices_bp.route("", methods=["GET"])
@verify_token
@verify_role(EmployeeRole.NHAN_VIEN_BAN_HANG, EmployeeRole.THU_KHO, EmployeeRole.KE_TOAN, EmployeeRole.QUAN_LY)
@handle_api_errors
def get_sales_invoices_list():
    cancel_requested_value = request.args.get("cancel_requested")
    cancel_requested = (
        parse_bool(cancel_requested_value, "cancel_requested")
        if cancel_requested_value is not None
        else None
    )

    warehouse_id = scoped_warehouse_id(request.employee_id, request.args.get('warehouse_id'))

    def load():
        invoices, total, page, pages = get_sales_invoices_list_service(
            page_value=request.args.get('page'),
            per_page_value=request.args.get('per_page'),
            status_value=request.args.get('status'),
            keyword=request.args.get('keyword'),
            from_date_value=request.args.get('from_date'),
            to_date_value=request.args.get('to_date'),
            cancel_requested=cancel_requested,
            debt_status=request.args.get('debt_status'),
            warehouse_id=warehouse_id,
        )
        return {
            'invoices': [serialize_invoice_summary(invoice) for invoice in invoices],
            'total': total,
            'pages': pages,
            'current_page': page,
        }

    return jsonify(cached_query(
        'sales-invoices-list',
        {'employee_id': request.employee_id, 'role': request.employee_role,
         'warehouse_id': warehouse_id, 'today': business_today().isoformat(),
         'filters': request.args.to_dict(flat=True)},
        10,
        load,
    )), 200


@sales_invoices_bp.route("/<int:invoice_id>", methods=["GET"])
@verify_token
@verify_role(EmployeeRole.NHAN_VIEN_BAN_HANG, EmployeeRole.THU_KHO, EmployeeRole.KE_TOAN, EmployeeRole.QUAN_LY)
@handle_api_errors
def get_sales_invoice_detail(invoice_id):
       
    invoice_record = SalesInvoice.query.get(invoice_id)
    if invoice_record:
        ensure_warehouse_access(request.employee_id, invoice_record.warehouse_id)
    invoice = get_sales_invoice_detail_service(invoice_id)
    
    return jsonify(serialize_sales_invoice(invoice)), 200


@sales_invoices_bp.route("", methods=["POST"])
@verify_token
@verify_role(EmployeeRole.NHAN_VIEN_BAN_HANG, EmployeeRole.QUAN_LY)
@handle_api_errors
def create_sales_invoice():
       
    data = request.get_json(silent=True) or {}

    invoice = create_sales_invoice_service(
        employee_id=request.employee_id,
        warehouse_id=data.get("warehouse_id"),
        customer_id=data.get("customer_id"),
        customer_data=data.get("customer"),
        note=data.get("note", ""),
        items=data.get("items", []),
        discount_amount=data.get("discount_amount", 0),
        discount_note=data.get("discount_note", ""),
        promotion_id=data.get("promotion_id"),
        sale_source=data.get("sale_source"),
        payment_amount=data.get("payment_amount", 0),
        payment_method=data.get("payment_method"),
        payment_due_date=data.get("payment_due_date"),
        stock_employee_id=data.get("stock_employee_id"),
    )

    return jsonify({
        "message": "Tạo đơn hàng thành công",
        "invoice": serialize_sales_invoice(invoice),
    }), 201


@sales_invoices_bp.route("/<int:invoice_id>", methods=["PUT"])
@verify_token
@verify_role(EmployeeRole.NHAN_VIEN_BAN_HANG, EmployeeRole.KE_TOAN, EmployeeRole.QUAN_LY)
@handle_api_errors
def update_sales_invoice(invoice_id):
       
    data = request.get_json(silent=True) or {}

    invoice = update_sales_invoice_service(
        invoice_id=invoice_id,
        employee_id=request.employee_id,
        warehouse_id=data.get("warehouse_id"),
        customer_id=data.get("customer_id"),
        note=data.get("note", ""),
        items=data.get("items", []),
        discount_amount=data.get("discount_amount", 0),
        discount_note=data.get("discount_note", ""),
        promotion_id=data.get("promotion_id"),
        payment_due_date=data.get("payment_due_date"),
    )

    return jsonify({
        "message": "Cập nhật đơn hàng thành công",
        "invoice": serialize_sales_invoice(invoice),
    }), 200


@sales_invoices_bp.route("/<int:invoice_id>/status", methods=["PUT"])
@verify_token
@verify_role(EmployeeRole.THU_KHO, EmployeeRole.QUAN_LY)
@handle_api_errors
def update_invoice_status(invoice_id):
       
    data = request.get_json(silent=True) or {}
    
    invoice = SalesInvoice.query.get(invoice_id)
    if invoice:
        ensure_warehouse_access(request.employee_id, invoice.warehouse_id)

    invoice = update_invoice_status_service(
        invoice_id=invoice_id,
        employee_id=request.employee_id,
        status_value=data.get('status', '')
    )
    
    return jsonify({
        "message": "Cập nhật trạng thái thành công",
        "invoice": serialize_sales_invoice(invoice),
    }), 200


@sales_invoices_bp.route("/<int:invoice_id>/submit-to-warehouse", methods=["POST"])
@verify_token
@verify_role(EmployeeRole.NHAN_VIEN_BAN_HANG, EmployeeRole.QUAN_LY)
@handle_api_errors
def submit_sales_invoice_to_warehouse(invoice_id):
    invoice = submit_sales_invoice_to_warehouse_service(invoice_id, request.employee_id)
    return jsonify({"message": "Đã gửi đơn cho kho", "invoice": serialize_sales_invoice(invoice)}), 200


@sales_invoices_bp.route("/<int:invoice_id>/confirm-delivery", methods=["POST"])
@verify_token
@verify_role(EmployeeRole.NHAN_VIEN_BAN_HANG, EmployeeRole.QUAN_LY)
@handle_api_errors
def confirm_sales_invoice_delivery(invoice_id):
    data = request.get_json(silent=True) or {}
    invoice = confirm_sales_invoice_delivery_service(
        invoice_id, request.employee_id, data.get("recipient"), data.get("note"),
    )
    return jsonify({"message": "Đã xác nhận giao hàng", "invoice": serialize_sales_invoice(invoice)}), 200


@sales_invoices_bp.route("/<int:invoice_id>", methods=["DELETE"])
@verify_token
@verify_role(EmployeeRole.NHAN_VIEN_BAN_HANG, EmployeeRole.QUAN_LY)
@handle_api_errors
def cancel_invoice(invoice_id):
       
    invoice = cancel_invoice_service(invoice_id, request.employee_id)
    
    return jsonify({
        "message": "Đã hủy đơn hàng",
        "invoice": {
            "id": invoice.id,
            "status": invoice.status.value
        }
    }), 200


@sales_invoices_bp.route("/<int:invoice_id>/cancel-request", methods=["POST"])
@verify_token
@verify_role(EmployeeRole.NHAN_VIEN_BAN_HANG)
@handle_api_errors
def request_cancel_invoice(invoice_id):
       
    data = request.get_json(silent=True) or {}
    
    invoice = request_cancel_invoice_service(
        invoice_id=invoice_id,
        employee_id=request.employee_id,
        cancel_note=data.get('cancel_note', '')
    )
    
    return jsonify({
        "message": "Đã gửi yêu cầu hủy đơn",
        "invoice": {
            "id": invoice.id,
            "status": invoice.status.value,
            "cancel_requested": invoice.cancel_requested,
            "cancel_note": invoice.cancel_note
        }
    }), 200


@sales_invoices_bp.route("/<int:invoice_id>/complete", methods=["PUT"])
@verify_token
@verify_role(EmployeeRole.KE_TOAN)
@handle_api_errors
def complete_sales_invoice(invoice_id):
    data = request.get_json(silent=True) or {}

    invoice = complete_sales_invoice_service(
        invoice_id=invoice_id,
        employee_id=request.employee_id,
        payment_amount=data.get("payment_amount", 0),
        payment_method=data.get("payment_method"),
        payment_due_date=data.get("payment_due_date"),
    )

    return jsonify({
        "message": "Đã đánh dấu đơn hàng hoàn thành",
        "invoice": serialize_sales_invoice(invoice),
    }), 200


@sales_invoices_bp.route("/<int:invoice_id>/payments", methods=["POST"])
@verify_token
@verify_role(EmployeeRole.KE_TOAN)
@handle_api_errors
def record_sales_invoice_payment(invoice_id):
    data = request.get_json(silent=True) or {}
    invoice, payment = record_sales_invoice_payment_service(
        invoice_id=invoice_id,
        employee_id=request.employee_id,
        amount=data.get("amount"),
        payment_method=data.get("payment_method"),
        payment_due_date=data.get("payment_due_date"),
    )
    return jsonify({
        "message": "Đã ghi nhận thanh toán đơn hàng",
        "invoice": serialize_sales_invoice(invoice),
        "payment_id": payment.id,
    }), 201


@sales_invoices_bp.route("/<int:invoice_id>/payments", methods=["GET"])
@verify_token
@verify_role(EmployeeRole.NHAN_VIEN_BAN_HANG, EmployeeRole.THU_KHO, EmployeeRole.KE_TOAN, EmployeeRole.QUAN_LY)
@handle_api_errors
def get_sales_invoice_payments(invoice_id):
    invoice = SalesInvoice.query.get(invoice_id)
    if not invoice:
        raise NotFoundError("Đơn hàng không tồn tại")
    ensure_warehouse_access(request.employee_id, invoice.warehouse_id)
    page = parse_page(request.args.get("page"))
    per_page = parse_per_page(request.args.get("per_page"), 20)
    payments, total = dao.get_sales_invoice_payments_page(invoice_id, page, per_page)
    return jsonify({
        "payments": [serialize_sales_invoice_payment(payment) for payment in payments],
        "total": total, "page": page, "pages": (total + per_page - 1) // per_page,
    }), 200


@sales_invoices_bp.route("/<int:invoice_id>/payment-due-date", methods=["PUT"])
@verify_token
@verify_role(EmployeeRole.KE_TOAN, EmployeeRole.QUAN_LY)
@handle_api_errors
def update_payment_due_date(invoice_id):
    data = request.get_json(silent=True) or {}
    invoice = update_payment_due_date_service(
        invoice_id=invoice_id,
        employee_id=request.employee_id,
        payment_due_date=data.get("payment_due_date"),
    )
    return jsonify({
        "message": "Đã cập nhật hạn thanh toán",
        "invoice": serialize_sales_invoice(invoice),
    }), 200


@sales_invoices_bp.route("/pending-discount", methods=["GET"])
@verify_token
@verify_role(EmployeeRole.QUAN_LY)
@handle_api_errors
def get_pending_discount_invoices():
       
    invoices, total, page, pages = get_pending_discount_invoices_service(
        page_value=request.args.get('page'),
        per_page_value=request.args.get('per_page'),
        keyword=request.args.get('keyword')
    )
    
    invoices_data = [serialize_invoice_summary(invoice) for invoice in invoices]
    
    return jsonify({
        'invoices': invoices_data,
        'total': total,
        'pages': pages,
        'current_page': page
    }), 200


@sales_invoices_bp.route("/<int:invoice_id>/approve-discount", methods=["PUT"])
@verify_token
@verify_role(EmployeeRole.QUAN_LY)
@handle_api_errors
def approve_discount(invoice_id):
       
    data = request.get_json(silent=True) or {}
    
    approved = data.get("approved")
    if approved is None:
        return jsonify({"error": "Thiếu trường 'approved'"}), 400
    
    invoice, message = approve_discount_service(
        invoice_id=invoice_id,
        manager_id=request.employee_id,
        approved=parse_bool(approved, "approved"),
        note=data.get("note", "")
    )
    
    return jsonify({
        "message": message,
        "invoice": serialize_sales_invoice(invoice)
    }), 200


@sales_invoices_bp.route("/<int:invoice_id>/approve-cancel", methods=["PUT"])
@verify_token
@verify_role(EmployeeRole.KE_TOAN, EmployeeRole.QUAN_LY)
@handle_api_errors
def approve_cancel_request(invoice_id):
       
    data = request.get_json(silent=True) or {}
    
    approved = data.get("approved")
    if approved is None:
        return jsonify({"error": "Thiếu trường 'approved'"}), 400
    
    invoice, message = approve_cancel_request_service(
        invoice_id=invoice_id,
        manager_id=request.employee_id,
        approved=parse_bool(approved, "approved"),
        note=data.get("note", "")
    )
    
    return jsonify({
        "message": message,
        "invoice": serialize_sales_invoice(invoice)
    }), 200
