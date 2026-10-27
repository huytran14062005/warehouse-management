import hmac

from flask import Blueprint, jsonify, request
from web import app

from web.blueprints.api_errors import handle_api_errors
from web.middleware.auth_middleware import verify_role, verify_token
from web.models import EmployeeRole
from web.services.product_service import serialize_product_inventory
from web.services.reports_service import (
    get_inventory_report_service,
    get_movements_report_service,
)
from web.services.manager_reports_service import get_manager_sales_analytics_service
from web.services.overdue_debt_report_service import send_overdue_debt_report
from web.services.sales_invoice_service import business_today
from web.services.authorization import scoped_warehouse_id
from web.utils.pagination import build_pagination


reports_bp = Blueprint("reports", __name__, url_prefix="/api/reports")


@reports_bp.route("/internal/overdue-debt-email", methods=["GET"])
@handle_api_errors
def send_overdue_debt_email_report():
    """Vercel Cron entrypoint; it sends only on the configured monthly day."""
    configured_secret = str(app.config.get("CRON_SECRET") or "")
    authorization = request.headers.get("Authorization", "")
    provided_secret = authorization.removeprefix("Bearer ").strip()
    if not configured_secret or not hmac.compare_digest(provided_secret, configured_secret):
        return jsonify({"error": "Unauthorized"}), 401

    today = business_today()
    report_day = max(1, min(28, int(app.config.get("OVERDUE_REPORT_DAY", 15))))
    if today.day != report_day:
        return jsonify({
            "sent": False,
            "message": f"Báo cáo được lập vào ngày {report_day} hàng tháng.",
            "report_date": today.isoformat(),
        }), 200

    result = send_overdue_debt_report(today)
    return jsonify({"sent": True, **result}), 200


@reports_bp.route("/manager-sales", methods=["GET"])
@verify_token
@verify_role(EmployeeRole.QUAN_LY)
@handle_api_errors
def get_manager_sales_report():
    return jsonify(get_manager_sales_analytics_service(
        from_date_value=request.args.get("from_date"),
        to_date_value=request.args.get("to_date"),
        page_value=request.args.get("page"),
        per_page_value=request.args.get("per_page"),
        table_value=request.args.get("table"),
        table_page_value=request.args.get("table_page"),
        table_per_page_value=request.args.get("table_per_page"),
    )), 200


@reports_bp.route("/inventory", methods=["GET"])
@verify_token
@verify_role(EmployeeRole.THU_KHO, EmployeeRole.KE_TOAN, EmployeeRole.QUAN_LY)
@handle_api_errors
def get_inventory_report():
       
    products_data = get_inventory_report_service(
        warehouse_id_value=scoped_warehouse_id(request.employee_id, request.args.get('warehouse_id')),
        product_id_value=request.args.get('product_id'),
        keyword=request.args.get('keyword')
    )
    
    products_list = [
        serialize_product_inventory(item["product"], item["inventory"])
        for item in products_data
    ]
    
    return jsonify({
        'products': products_list,
        'total': len(products_list)
    }), 200


@reports_bp.route("/movements", methods=["GET"])
@verify_token
@verify_role(EmployeeRole.THU_KHO, EmployeeRole.KE_TOAN, EmployeeRole.QUAN_LY)
@handle_api_errors
def get_movements_report():
       
    report_data, warehouse, from_date, to_date = get_movements_report_service(
        from_date_value=request.args.get('from_date'),
        to_date_value=request.args.get('to_date'),
        warehouse_id_value=scoped_warehouse_id(request.employee_id, request.args.get('warehouse_id'))
    )
    
                               
    total_import_quantity = 0
    total_import_amount = 0
    
    for invoice in report_data["import_invoices"]:
        invoice_quantity = sum(int(item.quantity) for item in invoice.items)
        invoice_amount = sum(float(item.quantity) * float(item.unit_price) for item in invoice.items)
        
        total_import_quantity += invoice_quantity
        total_import_amount += invoice_amount
        
    
    total_export_quantity = 0
    total_export_amount = 0
    
    for invoice in report_data["sales_invoices"]:
        invoice_quantity = sum(int(item.quantity) for item in invoice.items)
        invoice_amount = sum(float(item.quantity) * float(item.unit_price) for item in invoice.items)
        
        total_export_quantity += invoice_quantity
        total_export_amount += invoice_amount
        
    total_damage_quantity = 0
    for report in report_data["damage_reports"]:
        report_quantity = sum(int(item.quantity) for item in report.items)
        total_damage_quantity += report_quantity

    total_transferred_quantity = 0
    for transfer in report_data["stock_transfers"]:
        transfer_quantity = sum(int(item.quantity) for item in transfer.items)
        total_transferred_quantity += transfer_quantity
    
                  
    summary = {
        "total_imported": sum(p["imported"] for p in report_data["by_product"]),
        "total_exported": sum(p["exported"] for p in report_data["by_product"]),
        "net_change": sum(p["net_change"] for p in report_data["by_product"]),
        "import_invoices_count": len(report_data["import_invoices"]),
        "sales_invoices_count": len(report_data["sales_invoices"]),
        "total_import_amount": total_import_amount,
        "total_export_amount": total_export_amount,
        "damage_reports_count": len(report_data["damage_reports"]),
        "total_damage_quantity": total_damage_quantity,
        "stock_transfers_count": len(report_data["stock_transfers"]),
        "total_transferred_quantity": total_transferred_quantity,
    }
    
    try:
        page = max(1, int(request.args.get("page", 1)))
    except (TypeError, ValueError):
        page = 1
    try:
        per_page = min(max(1, int(request.args.get("per_page", 10))), app.config.get("MAX_PAGE_SIZE", 100))
    except (TypeError, ValueError):
        per_page = 10
    keyword = str(request.args.get("keyword") or "").strip().lower()
    by_product = report_data["by_product"]
    if keyword:
        by_product = [
            product for product in by_product
            if keyword in str(product.get("product_name") or "").lower()
        ]
    total_products = len(by_product)
    start = (page - 1) * per_page
    paged_products = by_product[start : start + per_page]

    return jsonify({
        "period": {
            "from": from_date.strftime("%Y-%m-%d") if from_date else None,
            "to": to_date.strftime("%Y-%m-%d") if to_date else None
        },
        "warehouse": {
            "id": warehouse.id,
            "name": warehouse.name,
            "address": warehouse.address
        } if warehouse else None,
        "summary": summary,
        "by_product": paged_products,
        "pagination": build_pagination(page, per_page, total_products),
    }), 200
