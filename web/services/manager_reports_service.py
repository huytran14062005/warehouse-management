from datetime import date
from sqlalchemy import case, func, literal
from sqlalchemy.orm import selectinload

from web import db, app
from web.dao import product_dao
from web.models import (
    Customer,
    CustomerPayment,
    InvoiceStatus,
    Product,
    SalesInvoice,
    SalesInvoiceItem,
    SalesArea,
    SupplierPayment,
    PaymentMethod,
)
from web.services.exceptions import ValidationError
from web.services.reports_service import parse_date
from web.utils.pagination import build_pagination


def _date_range(from_date_value, to_date_value):
    from_date = parse_date(from_date_value)
    to_date = parse_date(to_date_value)
    if from_date and to_date and from_date > to_date:
        raise ValidationError("Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc")
    if to_date:
        to_date = to_date.replace(hour=23, minute=59, second=59, microsecond=999999)
    return from_date, to_date


def _invoice_total_subquery():
    return (
        db.session.query(
            SalesInvoiceItem.sales_invoice_id.label("invoice_id"),
            func.sum(SalesInvoiceItem.quantity * SalesInvoiceItem.unit_price).label("gross_amount"),
        )
        .group_by(SalesInvoiceItem.sales_invoice_id)
        .subquery()
    )


def _completed_invoice_filters(from_date, to_date):
    filters = [SalesInvoice.status == InvoiceStatus.COMPLETED]
    if from_date:
        filters.append(SalesInvoice.sold_at >= from_date)
    if to_date:
        filters.append(SalesInvoice.sold_at <= to_date)
    return filters


def _paginate_rows(rows, page, per_page):
    total = len(rows)
    start = (page - 1) * per_page
    return rows[start:start + per_page], total


def _build_monthly_trend(from_date, to_date):
    """Return one comparable row per calendar month in the selected period."""
    totals = _invoice_total_subquery()
    invoice_filters = _completed_invoice_filters(from_date, to_date)
    month_year = func.year(SalesInvoice.sold_at)
    month_number = func.month(SalesInvoice.sold_at)
    revenue_rows = (
        db.session.query(
            month_year.label("year"),
            month_number.label("month"),
            func.count(SalesInvoice.id).label("orders"),
            func.coalesce(func.sum(totals.c.gross_amount - SalesInvoice.discount_amount), 0).label("revenue"),
        )
        .join(totals, totals.c.invoice_id == SalesInvoice.id)
        .filter(*invoice_filters, SalesInvoice.sold_at.isnot(None))
        .group_by(month_year, month_number)
        .all()
    )
    quantity_rows = (
        db.session.query(
            month_year.label("year"),
            month_number.label("month"),
            func.coalesce(func.sum(SalesInvoiceItem.quantity), 0).label("quantity"),
        )
        .join(SalesInvoice, SalesInvoice.id == SalesInvoiceItem.sales_invoice_id)
        .filter(*invoice_filters, SalesInvoice.sold_at.isnot(None))
        .group_by(month_year, month_number)
        .all()
    )
    payment_year = func.year(CustomerPayment.paid_at)
    payment_month = func.month(CustomerPayment.paid_at)
    payment_filters = []
    if from_date:
        payment_filters.append(CustomerPayment.paid_at >= from_date)
    if to_date:
        payment_filters.append(CustomerPayment.paid_at <= to_date)
    payment_rows = (
        db.session.query(
            payment_year.label("year"),
            payment_month.label("month"),
            func.coalesce(func.sum(CustomerPayment.amount), 0).label("paid"),
            func.coalesce(func.sum(case((CustomerPayment.payment_method == PaymentMethod.CASH, CustomerPayment.amount), else_=0)), 0).label("cash_paid"),
            func.coalesce(func.sum(case((CustomerPayment.payment_method == PaymentMethod.BANK_TRANSFER, CustomerPayment.amount), else_=0)), 0).label("bank_paid"),
        )
        .filter(*payment_filters)
        .group_by(payment_year, payment_month)
        .all()
    )
    supplier_payment_year = func.year(SupplierPayment.paid_at)
    supplier_payment_month = func.month(SupplierPayment.paid_at)
    supplier_payment_filters = []
    if from_date:
        supplier_payment_filters.append(SupplierPayment.paid_at >= from_date)
    if to_date:
        supplier_payment_filters.append(SupplierPayment.paid_at <= to_date)
    supplier_payment_rows = (
        db.session.query(
            supplier_payment_year.label("year"),
            supplier_payment_month.label("month"),
            func.coalesce(func.sum(SupplierPayment.amount), 0).label("paid"),
            func.coalesce(func.sum(case((SupplierPayment.payment_method == PaymentMethod.CASH, SupplierPayment.amount), else_=0)), 0).label("cash_paid"),
            func.coalesce(func.sum(case((SupplierPayment.payment_method == PaymentMethod.BANK_TRANSFER, SupplierPayment.amount), else_=0)), 0).label("bank_paid"),
        )
        .filter(*supplier_payment_filters)
        .group_by(supplier_payment_year, supplier_payment_month)
        .all()
    )

    revenue_by_month = {
        f"{int(row.year):04d}-{int(row.month):02d}": {
            "orders": int(row.orders or 0),
            "revenue": float(row.revenue or 0),
        }
        for row in revenue_rows
    }
    quantity_by_month = {
        f"{int(row.year):04d}-{int(row.month):02d}": int(row.quantity or 0)
        for row in quantity_rows
    }
    paid_by_month = {
        f"{int(row.year):04d}-{int(row.month):02d}": float(row.paid or 0)
        for row in payment_rows
    }
    cash_paid_by_month = {
        f"{int(row.year):04d}-{int(row.month):02d}": float(row.cash_paid or 0)
        for row in payment_rows
    }
    bank_paid_by_month = {
        f"{int(row.year):04d}-{int(row.month):02d}": float(row.bank_paid or 0)
        for row in payment_rows
    }
    supplier_paid_by_month = {
        f"{int(row.year):04d}-{int(row.month):02d}": float(row.paid or 0)
        for row in supplier_payment_rows
    }
    supplier_cash_paid_by_month = {
        f"{int(row.year):04d}-{int(row.month):02d}": float(row.cash_paid or 0)
        for row in supplier_payment_rows
    }
    supplier_bank_paid_by_month = {
        f"{int(row.year):04d}-{int(row.month):02d}": float(row.bank_paid or 0)
        for row in supplier_payment_rows
    }

    def to_month_start(value):
        if not value:
            return None
        value = value.date() if hasattr(value, "date") else value
        return date(value.year, value.month, 1)

    start = to_month_start(from_date)
    end = to_month_start(to_date)
    observed_keys = (
        set(revenue_by_month)
        | set(quantity_by_month)
        | set(paid_by_month)
        | set(supplier_paid_by_month)
    )
    if not start and observed_keys:
        start = date.fromisoformat(min(observed_keys) + "-01")
    if not end and observed_keys:
        end = date.fromisoformat(max(observed_keys) + "-01")

    keys = []
    if start and end:
        cursor = start
        while cursor <= end:
            keys.append(f"{cursor.year:04d}-{cursor.month:02d}")
            cursor = date(cursor.year + (1 if cursor.month == 12 else 0), 1 if cursor.month == 12 else cursor.month + 1, 1)
    else:
        keys = sorted(observed_keys)

    rows = []
    for month_key in keys:
        revenue = revenue_by_month.get(month_key, {})
        orders = int(revenue.get("orders", 0))
        revenue_value = float(revenue.get("revenue", 0))
        rows.append({
            "month": month_key,
            "orders": orders,
            "sold_quantity": quantity_by_month.get(month_key, 0),
            "revenue": revenue_value,
            "paid": paid_by_month.get(month_key, 0.0),
            "cash_paid": cash_paid_by_month.get(month_key, 0.0),
            "bank_paid": bank_paid_by_month.get(month_key, 0.0),
            "supplier_paid": supplier_paid_by_month.get(month_key, 0.0),
            "supplier_cash_paid": supplier_cash_paid_by_month.get(month_key, 0.0),
            "supplier_bank_paid": supplier_bank_paid_by_month.get(month_key, 0.0),
            "average_order_value": revenue_value / orders if orders else 0,
        })
    peak = max(rows, key=lambda row: row["revenue"], default=None)
    if peak and peak["revenue"] <= 0:
        peak = None
    return rows, peak


def _get_manager_sales_table_page(table, from_date, to_date, page, per_page):
    """Load only the requested statistics table for an independent page change."""
    if table == "debt":
        totals = _invoice_total_subquery()
        invoice_filters = _completed_invoice_filters(from_date, to_date)
        sales_rows = (
            db.session.query(
                SalesInvoice.customer_id,
                func.coalesce(func.sum(totals.c.gross_amount - SalesInvoice.discount_amount), 0).label("period_sales"),
            )
            .join(totals, totals.c.invoice_id == SalesInvoice.id)
            .filter(*invoice_filters)
            .group_by(SalesInvoice.customer_id)
            .all()
        )
        payment_filters = []
        if from_date:
            payment_filters.append(CustomerPayment.paid_at >= from_date)
        if to_date:
            payment_filters.append(CustomerPayment.paid_at <= to_date)
        payment_rows = (
            db.session.query(
                CustomerPayment.customer_id,
                func.coalesce(func.sum(CustomerPayment.amount), 0).label("period_paid"),
            )
            .filter(*payment_filters)
            .group_by(CustomerPayment.customer_id)
            .all()
        )
        sales_by_customer = {row.customer_id: float(row.period_sales or 0) for row in sales_rows}
        paid_by_customer = {row.customer_id: float(row.period_paid or 0) for row in payment_rows}
        customer_ids = set(sales_by_customer) | set(paid_by_customer)
        customers = (
            Customer.query
            .options(selectinload(Customer.sales_area_ref))
            .order_by(Customer.debt_amount.desc(), Customer.id.asc())
            .all()
        )
        rows = []
        for customer in customers:
            period_sales = sales_by_customer.get(customer.id, 0.0)
            period_paid = paid_by_customer.get(customer.id, 0.0)
            if customer.id not in customer_ids and float(customer.debt_amount or 0) == 0:
                continue
            rows.append({
                "customer_id": customer.id,
                "customer_name": customer.full_name,
                "phone": customer.phone,
                "area": customer.sales_area_ref.name if customer.sales_area_ref else "ChÆ°a xÃ¡c Ä‘á»‹nh",
                "period_sales": period_sales,
                "period_paid": period_paid,
                "net_debt_change": period_sales - period_paid,
                "current_debt": float(customer.debt_amount or 0),
            })
        rows.sort(key=lambda row: (-row["current_debt"], -row["net_debt_change"], row["customer_name"]))
        key = "debts"
    elif table == "revenue":
        totals = _invoice_total_subquery()
        invoice_filters = _completed_invoice_filters(from_date, to_date)
        area_id_expr = func.coalesce(SalesInvoice.sales_area_id, Customer.sales_area_id)
        area_expr = func.coalesce(SalesArea.name, literal("ChÆ°a xÃ¡c Ä‘á»‹nh"))
        revenue_rows = (
            db.session.query(
                area_expr.label("area"),
                func.count(SalesInvoice.id).label("orders"),
                func.coalesce(func.sum(totals.c.gross_amount - SalesInvoice.discount_amount), 0).label("revenue"),
            )
            .join(Customer, Customer.id == SalesInvoice.customer_id)
            .join(totals, totals.c.invoice_id == SalesInvoice.id)
            .outerjoin(SalesArea, SalesArea.id == area_id_expr)
            .filter(*invoice_filters)
            .group_by(area_expr)
            .order_by(func.sum(totals.c.gross_amount - SalesInvoice.discount_amount).desc())
            .all()
        )
        quantity_rows = (
            db.session.query(
                area_expr.label("area"),
                func.sum(SalesInvoiceItem.quantity).label("quantity"),
            )
            .join(SalesInvoice, SalesInvoice.id == SalesInvoiceItem.sales_invoice_id)
            .join(Customer, Customer.id == SalesInvoice.customer_id)
            .outerjoin(SalesArea, SalesArea.id == area_id_expr)
            .filter(*invoice_filters)
            .group_by(area_expr)
            .all()
        )
        quantity_by_area = {row.area: int(row.quantity or 0) for row in quantity_rows}
        rows = [
            {
                "area": row.area,
                "orders": int(row.orders or 0),
                "revenue": float(row.revenue or 0),
                "quantity": quantity_by_area.get(row.area, 0),
            }
            for row in revenue_rows
        ]
        key = "revenue_table"
    elif table == "inventory":
        products = Product.query.order_by(Product.name.asc()).all()
        inventory_by_product = product_dao.calculate_inventory_for_products([product.id for product in products])
        rows = []
        for product in products:
            available_stock = max(0, int(inventory_by_product.get(product.id, {}).get("available_stock", 0) or 0))
            if available_stock > 0:
                rows.append({
                    "product_id": product.id,
                    "product_name": product.name,
                    "unit": product.unit,
                    "quantity": available_stock,
                })
        rows.sort(key=lambda row: (-row["quantity"], row["product_name"]))
        key = "inventory_table"
    elif table == "monthly":
        rows, peak = _build_monthly_trend(from_date, to_date)
        page_rows, total = _paginate_rows(rows, page, per_page)
        return {
            "table": "monthly",
            "monthly_table": page_rows,
            "monthly_pagination": build_pagination(page, per_page, total),
            "monthly_peak": peak,
        }
    else:
        invoice_filters = _completed_invoice_filters(from_date, to_date)
        sold_rows = (
            db.session.query(
                Product.id.label("product_id"),
                Product.name.label("product_name"),
                Product.unit.label("unit"),
                func.sum(SalesInvoiceItem.quantity).label("quantity"),
            )
            .join(SalesInvoice, SalesInvoice.id == SalesInvoiceItem.sales_invoice_id)
            .join(Product, Product.id == SalesInvoiceItem.product_id)
            .filter(*invoice_filters)
            .group_by(Product.id, Product.name, Product.unit)
            .order_by(func.sum(SalesInvoiceItem.quantity).desc(), Product.name.asc())
            .all()
        )
        rows = [
            {
                "product_id": row.product_id,
                "product_name": row.product_name,
                "unit": row.unit,
                "quantity": int(row.quantity or 0),
            }
            for row in sold_rows
            if int(row.quantity or 0) > 0
        ]
        key = "sold_table"

    page_rows, total = _paginate_rows(rows, page, per_page)
    pagination_key = key.replace("_table", "") + "_pagination"
    if table == "debt":
        pagination_key = "debt_pagination"
    return {
        "table": table,
        key: page_rows,
        pagination_key: build_pagination(page, per_page, total),
    }


def get_manager_sales_analytics_service(
    from_date_value=None,
    to_date_value=None,
    page_value=1,
    per_page_value=None,
    table_value=None,
    table_page_value=1,
    table_per_page_value=None,
):
    from_date, to_date = _date_range(from_date_value, to_date_value)
    try:
        page = max(1, int(page_value or 1))
    except (TypeError, ValueError):
        page = 1
    try:
        per_page = min(max(1, int(per_page_value or app.config.get("APPLICATION_SIZE", 10))), app.config.get("MAX_PAGE_SIZE", 100))
    except (TypeError, ValueError):
        per_page = min(app.config.get("APPLICATION_SIZE", 10), app.config.get("MAX_PAGE_SIZE", 100))

    try:
        table_page = max(1, int(table_page_value or 1))
    except (TypeError, ValueError):
        table_page = 1
    try:
        table_per_page = min(
            max(1, int(table_per_page_value or app.config.get("APPLICATION_SIZE", 10))),
            app.config.get("MAX_PAGE_SIZE", 100),
        )
    except (TypeError, ValueError):
        table_per_page = min(app.config.get("APPLICATION_SIZE", 10), app.config.get("MAX_PAGE_SIZE", 100))

    if table_value in {"debt", "revenue", "inventory", "sold", "monthly"}:
        return _get_manager_sales_table_page(table_value, from_date, to_date, table_page, table_per_page)

    totals = _invoice_total_subquery()
    invoice_filters = _completed_invoice_filters(from_date, to_date)

    # Công nợ theo khách hàng: doanh số phát sinh trong kỳ, tiền đã thu trong kỳ
    # và số dư công nợ hiện tại. Số dư lịch sử đầu kỳ không được suy diễn vì hệ thống
    # chưa lưu sổ công nợ theo từng thời điểm.
    sales_rows = (
        db.session.query(
            SalesInvoice.customer_id,
            func.coalesce(func.sum(totals.c.gross_amount - SalesInvoice.discount_amount), 0).label("period_sales"),
        )
        .join(totals, totals.c.invoice_id == SalesInvoice.id)
        .filter(*invoice_filters)
        .group_by(SalesInvoice.customer_id)
        .all()
    )
    payment_filters = []
    if from_date:
        payment_filters.append(CustomerPayment.paid_at >= from_date)
    if to_date:
        payment_filters.append(CustomerPayment.paid_at <= to_date)
    payment_rows = (
        db.session.query(
            CustomerPayment.customer_id,
            func.coalesce(func.sum(CustomerPayment.amount), 0).label("period_paid"),
        )
        .filter(*payment_filters)
        .group_by(CustomerPayment.customer_id)
        .all()
    )
    sales_by_customer = {row.customer_id: float(row.period_sales or 0) for row in sales_rows}
    paid_by_customer = {row.customer_id: float(row.period_paid or 0) for row in payment_rows}

    customer_ids = set(sales_by_customer) | set(paid_by_customer)
    customers = (
        Customer.query
        .options(selectinload(Customer.sales_area_ref))
        .order_by(Customer.debt_amount.desc(), Customer.id.asc())
        .all()
    )
    debt_rows = []
    for customer in customers:
        period_sales = sales_by_customer.get(customer.id, 0.0)
        period_paid = paid_by_customer.get(customer.id, 0.0)
        if customer.id not in customer_ids and float(customer.debt_amount or 0) == 0:
            continue
        debt_rows.append({
            "customer_id": customer.id,
            "customer_name": customer.full_name,
            "phone": customer.phone,
            "area": customer.sales_area_ref.name if customer.sales_area_ref else "Chưa xác định",
            "period_sales": period_sales,
            "period_paid": period_paid,
            "net_debt_change": period_sales - period_paid,
            "current_debt": float(customer.debt_amount or 0),
        })
    debt_rows.sort(key=lambda row: (-row["current_debt"], -row["net_debt_change"], row["customer_name"]))
    debt_total = len(debt_rows)
    debt_chart_rows = [
        {
            "customer_name": row["customer_name"],
            "current_debt": row["current_debt"],
        }
        for row in debt_rows[:8]
        if row["current_debt"] > 0
    ]
    remaining_debt = sum(
        float(row["current_debt"] or 0)
        for row in debt_rows[8:]
    )
    if remaining_debt > 0:
        debt_chart_rows.append({
            "customer_name": "Khách còn lại",
            "current_debt": remaining_debt,
        })
    start = (page - 1) * per_page
    paged_debts = debt_rows[start:start + per_page]

    # Doanh thu theo khu vực sử dụng snapshot trên đơn. Nhờ subquery tổng tiền,
    # chiết khấu của một đơn chỉ được trừ một lần, không bị nhân theo số dòng hàng.
    area_id_expr = func.coalesce(SalesInvoice.sales_area_id, Customer.sales_area_id)
    area_expr = func.coalesce(SalesArea.name, literal("Chưa xác định"))
    revenue_rows = (
        db.session.query(
            area_expr.label("area"),
            func.count(SalesInvoice.id).label("orders"),
            func.coalesce(func.sum(totals.c.gross_amount - SalesInvoice.discount_amount), 0).label("revenue"),
        )
        .join(Customer, Customer.id == SalesInvoice.customer_id)
        .join(totals, totals.c.invoice_id == SalesInvoice.id)
        .outerjoin(SalesArea, SalesArea.id == area_id_expr)
        .filter(*invoice_filters)
        .group_by(area_expr)
        .order_by(func.sum(totals.c.gross_amount - SalesInvoice.discount_amount).desc())
        .all()
    )
    quantity_rows = (
        db.session.query(
            area_expr.label("area"),
            Product.name.label("product_name"),
            func.sum(SalesInvoiceItem.quantity).label("quantity"),
        )
        .join(SalesInvoice, SalesInvoice.id == SalesInvoiceItem.sales_invoice_id)
        .join(Customer, Customer.id == SalesInvoice.customer_id)
        .join(Product, Product.id == SalesInvoiceItem.product_id)
        .outerjoin(SalesArea, SalesArea.id == area_id_expr)
        .filter(*invoice_filters)
        .group_by(area_expr, Product.id, Product.name)
        .all()
    )
    top_products = {}
    for row in quantity_rows:
        current = top_products.get(row.area)
        quantity = int(row.quantity or 0)
        if not current or quantity > current["quantity"]:
            top_products[row.area] = {"name": row.product_name, "quantity": quantity}
    quantity_by_area = {}
    for item in quantity_rows:
        quantity_by_area[item.area] = quantity_by_area.get(item.area, 0) + int(item.quantity or 0)

    revenue_by_area = [
        {
            "area": row.area,
            "orders": int(row.orders or 0),
            "revenue": float(row.revenue or 0),
            "quantity": quantity_by_area.get(row.area, 0),
            "top_product": top_products.get(row.area),
        }
        for row in revenue_rows
    ]

    # Tồn kho hiện tại lấy theo cùng một công thức với màn hình quản lý kho:
    # nhập - bán trực tiếp - hư hỏng - đã cấp cho nhân viên.
    products = Product.query.order_by(Product.name.asc()).all()
    inventory_by_product = product_dao.calculate_inventory_for_products(
        [product.id for product in products]
    )
    inventory_chart = []
    total_current_stock = 0
    for product in products:
        available_stock = max(0, int(
            inventory_by_product.get(product.id, {}).get("available_stock", 0) or 0
        ))
        total_current_stock += available_stock
        if available_stock > 0:
            inventory_chart.append({
                "product_id": product.id,
                "product_name": product.name,
                "unit": product.unit,
                "quantity": available_stock,
            })
    inventory_chart.sort(key=lambda row: (-row["quantity"], row["product_name"]))

    sold_rows = (
        db.session.query(
            Product.id.label("product_id"),
            Product.name.label("product_name"),
            Product.unit.label("unit"),
            func.sum(SalesInvoiceItem.quantity).label("quantity"),
        )
        .join(SalesInvoice, SalesInvoice.id == SalesInvoiceItem.sales_invoice_id)
        .join(Product, Product.id == SalesInvoiceItem.product_id)
        .filter(*invoice_filters)
        .group_by(Product.id, Product.name, Product.unit)
        .order_by(func.sum(SalesInvoiceItem.quantity).desc(), Product.name.asc())
        .all()
    )
    sold_chart = [
        {
            "product_id": row.product_id,
            "product_name": row.product_name,
            "unit": row.unit,
            "quantity": int(row.quantity or 0),
        }
        for row in sold_rows
        if int(row.quantity or 0) > 0
    ]
    total_period_sold = sum(row["quantity"] for row in sold_chart)

    total_current_debt = sum(float(customer.debt_amount or 0) for customer in customers)
    total_period_sales = sum(sales_by_customer.values())
    total_period_paid = sum(paid_by_customer.values())
    monthly_trend, monthly_peak = _build_monthly_trend(from_date, to_date)
    revenue_table, revenue_total = _paginate_rows(revenue_by_area, 1, per_page)
    inventory_table, inventory_total = _paginate_rows(inventory_chart, 1, per_page)
    sold_table, sold_total = _paginate_rows(sold_chart, 1, per_page)

    return {
        "period": {
            "from": from_date.strftime("%Y-%m-%d") if from_date else None,
            "to": to_date.strftime("%Y-%m-%d") if to_date else None,
        },
        "debt_summary": {
            "customer_count": debt_total,
            "current_debt_total": total_current_debt,
            "period_sales_total": total_period_sales,
            "period_paid_total": total_period_paid,
            "net_debt_change": total_period_sales - total_period_paid,
            "current_stock_total": total_current_stock,
            "period_sold_quantity": total_period_sold,
            "customer_cash_paid_total": sum(row.get("cash_paid", 0) for row in monthly_trend),
            "customer_bank_paid_total": sum(row.get("bank_paid", 0) for row in monthly_trend),
            "supplier_paid_total": sum(row.get("supplier_paid", 0) for row in monthly_trend),
            "supplier_cash_paid_total": sum(row.get("supplier_cash_paid", 0) for row in monthly_trend),
            "supplier_bank_paid_total": sum(row.get("supplier_bank_paid", 0) for row in monthly_trend),
        },
        "debts": paged_debts,
        "debt_chart": debt_chart_rows,
        "debt_pagination": build_pagination(page, per_page, debt_total),
        "revenue_by_area": revenue_by_area,
        "revenue_table": revenue_table,
        "revenue_pagination": build_pagination(1, per_page, revenue_total),
        "inventory_chart": inventory_chart,
        "inventory_table": inventory_table,
        "inventory_pagination": build_pagination(1, per_page, inventory_total),
        "sold_chart": sold_chart,
        "sold_table": sold_table,
        "sold_pagination": build_pagination(1, per_page, sold_total),
        "monthly_trend": monthly_trend,
        "monthly_table": monthly_trend[:per_page],
        "monthly_pagination": build_pagination(1, per_page, len(monthly_trend)),
        "monthly_peak": monthly_peak,
    }
