from flask import Blueprint, jsonify, request

from web.blueprints.api_errors import handle_api_errors
from web.middleware.auth_middleware import verify_role, verify_token
from web.models import EmployeeRole, ImportInvoice
from web.services.authorization import ensure_warehouse_access, scoped_warehouse_id
from web.services.validators import parse_bool
from web.services.exceptions import NotFoundError
from web.services.import_invoice_service import (
    create_import_invoice_service,
    delete_import_invoice_service,
    get_import_invoice_detail_service,
    get_import_invoices_list_service,
    serialize_import_invoice,
    serialize_import_invoice_summary,
    update_import_invoice_service,
    record_supplier_payment_service,
)
from web.utils.pagination import build_pagination


import_invoices_bp = Blueprint("import_invoices", __name__, url_prefix="/api/import-invoices")


@import_invoices_bp.route("", methods=["GET"])
@verify_token
@verify_role(EmployeeRole.THU_KHO, EmployeeRole.KE_TOAN, EmployeeRole.QUAN_LY)
@handle_api_errors
def get_import_invoices_list():
       
    invoices, total, page, per_page = get_import_invoices_list_service(
        page_value=request.args.get('page'),
        per_page_value=request.args.get('per_page'),
        warehouse_id_value=scoped_warehouse_id(request.employee_id, request.args.get('warehouse_id')),
        supplier_id_value=request.args.get('supplier_id'),
        from_date_value=request.args.get('from_date'),
        to_date_value=request.args.get('to_date'),
        keyword=request.args.get('keyword')
    )
    
    invoices_data = [serialize_import_invoice_summary(invoice) for invoice in invoices]
    
    return jsonify({
        'invoices': invoices_data,
        'pagination': build_pagination(page, per_page, total)
    }), 200


@import_invoices_bp.route("/<int:invoice_id>", methods=["GET"])
@verify_token
@verify_role(EmployeeRole.THU_KHO, EmployeeRole.KE_TOAN, EmployeeRole.QUAN_LY)
@handle_api_errors
def get_import_invoice_detail(invoice_id):
       
    invoice_record = ImportInvoice.query.get(invoice_id)
    if invoice_record:
        ensure_warehouse_access(request.employee_id, invoice_record.warehouse_id)
    invoice = get_import_invoice_detail_service(invoice_id)
    
    return jsonify(serialize_import_invoice(invoice)), 200


@import_invoices_bp.route("", methods=["POST"])
@verify_token
@verify_role(EmployeeRole.THU_KHO, EmployeeRole.QUAN_LY)
@handle_api_errors
def create_import_invoice():
       
    data = request.get_json(silent=True) or {}

    invoice = create_import_invoice_service(
        employee_id=request.employee_id,
        warehouse_id=data.get("warehouse_id"),
        supplier_id=data.get("supplier_id"),
        supplier_data=data.get("supplier_data"),
        imported_at=data.get("imported_at"),
        note=data.get("note", ""),
        items=data.get("items", []),
        is_return=parse_bool(data.get("is_return", False), "is_return"),
        payment_amount=data.get("payment_amount", 0),
        payment_method=data.get("payment_method"),
    )

    return jsonify({
        "message": "Tạo phiếu nhập kho thành công",
        "invoice": serialize_import_invoice(invoice),
    }), 201


@import_invoices_bp.route("/<int:invoice_id>/payments", methods=["POST"])
@verify_token
@verify_role(EmployeeRole.KE_TOAN, EmployeeRole.QUAN_LY)
@handle_api_errors
def record_supplier_payment(invoice_id):
    invoice = ImportInvoice.query.get(invoice_id)
    if not invoice:
        raise NotFoundError("Phiáº¿u nháº­p khÃ´ng tá»“n táº¡i")
    ensure_warehouse_access(request.employee_id, invoice.warehouse_id)

    data = request.get_json(silent=True) or {}
    updated_invoice, payment = record_supplier_payment_service(
        invoice_id=invoice_id,
        employee_id=request.employee_id,
        amount=data.get("amount"),
        payment_method=data.get("payment_method"),
        note=data.get("note", ""),
    )
    return jsonify({
        "message": "Ghi nháº­n thanh toÃ¡n nhÃ  cung cáº¥p thÃ nh cÃ´ng",
        "invoice": serialize_import_invoice(updated_invoice),
        "payment": {
            "id": payment.id,
            "amount": float(payment.amount),
            "payment_method": payment.payment_method.value,
            "paid_at": payment.paid_at.isoformat() if payment.paid_at else None,
        },
    }), 201


@import_invoices_bp.route("/<int:invoice_id>", methods=["PUT"])
@verify_token
@verify_role(EmployeeRole.THU_KHO, EmployeeRole.KE_TOAN, EmployeeRole.QUAN_LY)
@handle_api_errors
def update_import_invoice(invoice_id):
       
    data = request.get_json(silent=True) or {}

    if request.employee_role == EmployeeRole.KE_TOAN.value and data.get("supplier_data") and not data.get("supplier_id"):
        return jsonify({"error": "Kế toán không được thêm nhà cung cấp khi sửa phiếu nhập"}), 403

    invoice = update_import_invoice_service(
        invoice_id=invoice_id,
        employee_id=request.employee_id,
        warehouse_id=data.get("warehouse_id"),
        supplier_id=data.get("supplier_id"),
        supplier_data=data.get("supplier_data"),
        imported_at=data.get("imported_at"),
        note=data.get("note", ""),
        items=data.get("items", []),
        is_return=parse_bool(data.get("is_return", False), "is_return")
    )

    return jsonify({
        "message": "Cập nhật phiếu nhập kho thành công",
        "invoice": serialize_import_invoice(invoice),
    }), 200


@import_invoices_bp.route("/<int:invoice_id>", methods=["DELETE"])
@verify_token
@verify_role(EmployeeRole.QUAN_LY)
@handle_api_errors
def delete_import_invoice(invoice_id):
       
    delete_import_invoice_service(invoice_id)
    
    return jsonify({
        "message": "Đã xóa phiếu nhập kho"
    }), 200
