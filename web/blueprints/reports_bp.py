import hmac
from datetime import timedelta
from io import BytesIO

from flask import Blueprint, jsonify, request, send_file
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
from web.services.warehouse_report_export_service import (
    EXCEL_CONTENT_TYPE,
    build_warehouse_report_workbook,
)
from web.services.sales_invoice_service import business_today
from web.services.inventory_settings_service import get_low_stock_percentage
from web.services.authorization import scoped_central_warehouse_id, scoped_warehouse_id
from web.utils.pagination import build_pagination
from web.utils.query_cache import cached_query


reports_bp = Blueprint("reports", __name__, url_prefix="/api/reports")


@reports_bp.route("/internal/overdue-debt-email", methods=["GET"])
@handle_api_errors
def send_overdue_debt_email_report():
    """Vercel Cron entrypoint; it sends only on the last day of each month."""
    configured_secret = str(app.config.get("CRON_SECRET") or "")
    authorization = request.headers.get("Authorization", "")
    provided_secret = authorization.removeprefix("Bearer ").strip()
    if not configured_secret or not hmac.compare_digest(provided_secret, configured_secret):
        return jsonify({"error": "Unauthorized"}), 401

    today = business_today()
    report_day = "cuối tháng"
    tomorrow = today + timedelta(days=1)
    if tomorrow.month == today.month:
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
    return jsonify(cached_query(
        "manager-sales", request.args.to_dict(flat=True), 60,
        lambda: get_manager_sales_analytics_service(
            from_date_value=request.args.get("from_date"),
            to_date_value=request.args.get("to_date"),
            page_value=request.args.get("page"),
            per_page_value=request.args.get("per_page"),
            table_value=request.args.get("table"),
            table_page_value=request.args.get("table_page"),
            table_per_page_value=request.args.get("table_per_page"),
            granularity_value=request.args.get("granularity"),
        ),
    )), 200


@reports_bp.route("/inventory", methods=["GET"])
@verify_token
@verify_role(EmployeeRole.THU_KHO, EmployeeRole.KE_TOAN, EmployeeRole.QUAN_LY)
@handle_api_errors
def get_inventory_report():
    requested_warehouse_id = request.args.get("warehouse_id")
    if request.args.get("source") == "central":
        requested_warehouse_id = scoped_central_warehouse_id(request.employee_id)
       
    warehouse_id = scoped_warehouse_id(request.employee_id, requested_warehouse_id)

    def load():
        products_data = get_inventory_report_service(
            warehouse_id_value=warehouse_id,
            product_id_value=request.args.get('product_id'),
            keyword=request.args.get('keyword'),
        )
        products_list = [
            serialize_product_inventory(item["product"], item["inventory"])
            for item in products_data
        ]
        return {
            'products': products_list,
            'low_stock_percentage': float(get_low_stock_percentage()),
            'total': len(products_list),
        }

    return jsonify(cached_query(
        'warehouse-inventory-report',
        {'employee_id': request.employee_id, 'warehouse_id': warehouse_id,
         'filters': request.args.to_dict(flat=True)},
        20,
        load,
    )), 200


@reports_bp.route("/movements", methods=["GET"])
@verify_token
@verify_role(EmployeeRole.THU_KHO, EmployeeRole.KE_TOAN, EmployeeRole.QUAN_LY)
@handle_api_errors
def get_movements_report():
       
    requested_warehouse_id = request.args.get("warehouse_id")
    if request.args.get("source") == "central":
        requested_warehouse_id = scoped_central_warehouse_id(request.employee_id)
    warehouse_id = scoped_warehouse_id(request.employee_id, requested_warehouse_id)
    return jsonify(cached_query(
        'warehouse-movements-report',
        {'employee_id': request.employee_id, 'warehouse_id': warehouse_id,
         'filters': request.args.to_dict(flat=True)},
        30,
        lambda: _build_movements_report(warehouse_id),
    )), 200


@reports_bp.route("/movements/export", methods=["GET"])
@verify_token
@verify_role(EmployeeRole.THU_KHO, EmployeeRole.KE_TOAN, EmployeeRole.QUAN_LY)
@handle_api_errors
def export_movements_report():
    warehouse_id = scoped_central_warehouse_id(request.employee_id)
    report = _build_movements_report(warehouse_id, include_all_products=True)
    filename = (
        f"bao-cao-nhap-xuat-kho-{report['period']['from'] or 'tat-ca'}"
        f"-{report['period']['to'] or 'tat-ca'}.xlsx"
    )
    response = send_file(
        BytesIO(build_warehouse_report_workbook(report)),
        mimetype=EXCEL_CONTENT_TYPE,
        as_attachment=True,
        download_name=filename,
    )
    response.headers["Cache-Control"] = "no-store"
    return response


def _build_movements_report(warehouse_id, include_all_products=False):
    report_data, warehouse, from_date, to_date = get_movements_report_service(
        from_date_value=request.args.get('from_date'),
        to_date_value=request.args.get('to_date'),
        warehouse_id_value=warehouse_id,
    )
    totals = report_data["totals"]

    summary = {
        "total_imported": sum(p["imported"] for p in report_data["by_product"]),
        "total_exported": sum(p["exported"] for p in report_data["by_product"]),
        "net_change": sum(p["net_change"] for p in report_data["by_product"]),
        "import_invoices_count": totals["import_invoices_count"],
        "sales_invoices_count": totals["sales_invoices_count"],
        "total_import_amount": totals["total_import_amount"],
        "total_export_amount": totals["total_export_amount"],
        "damage_reports_count": totals["damage_reports_count"],
        "total_damage_quantity": totals["total_damage_quantity"],
        "stock_transfers_count": totals["stock_transfers_count"],
        "total_transferred_quantity": totals["total_transferred_quantity"],
    }
    low_stock_percentage = float(get_low_stock_percentage())
    summary["current_stock"] = sum(int(p["current_stock"] or 0) for p in report_data["by_product"])
    summary["out_of_stock_count"] = sum(
        int(p["current_stock"] or 0) <= 0 for p in report_data["by_product"]
    )
    summary["low_stock_count"] = sum(
        int(p["current_stock"] or 0) > 0
        and int(p["total_imported"] or 0) > 0
        and int(p["current_stock"] or 0) <= int(p["total_imported"] or 0) * low_stock_percentage / 100
        for p in report_data["by_product"]
    )
    summary["low_stock_percentage"] = low_stock_percentage
    
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
    paged_products = by_product if include_all_products else by_product[start : start + per_page]

    return {
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
    }
