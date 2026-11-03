"""Managerial pricing and operating profit estimates.

Expenses are booked once. Invoice-linked expenses are allocated to its items
for product analysis; other expenses remain period costs. Purchase cost is a
weighted import estimate, not a perpetual inventory valuation.
"""

from datetime import datetime, timedelta
from decimal import Decimal, InvalidOperation, ROUND_CEILING, ROUND_HALF_UP

from sqlalchemy import case, func

from web import db
from web.models import (
    ImportInvoice, ImportInvoiceItem, InvoiceStatus, OperatingExpense,
    PaymentMethod, PricingPolicy, Product, SalesInvoice, SalesInvoiceItem,
    vietnam_payment_time,
)
from web.services.company_fund_service import record_fund_movement
from web.services.exceptions import NotFoundError, ValidationError
from web.utils.pagination import build_pagination


CATEGORIES = {
    "fuel": "Xăng xe",
    "vehicle_repair": "Sửa xe",
    "lodging": "Nhà nghỉ",
    "sales_salary": "Lương nhân viên bán hàng",
    "other": "Chi phí bán hàng khác",
}
CENT = Decimal("0.01")
DEFAULT_MARGIN = Decimal("20")
DEFAULT_QUANTITY = 100


def money(value):
    return Decimal(str(value or 0))


def rounded(value):
    return value.quantize(CENT, rounding=ROUND_HALF_UP)


def positive_amount(value):
    try:
        result = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        raise ValidationError("Số tiền không hợp lệ")
    if not result.is_finite() or result <= 0 or result > Decimal("999999999999.99") or result.as_tuple().exponent < -2:
        raise ValidationError("Số tiền phải lớn hơn 0 và có tối đa 2 chữ số thập phân")
    return result


def parse_period(from_value=None, to_value=None):
    today = vietnam_payment_time().date()
    try:
        start = datetime.strptime(from_value, "%Y-%m-%d").date() if from_value else today - timedelta(days=29)
        end = datetime.strptime(to_value, "%Y-%m-%d").date() if to_value else today
    except (TypeError, ValueError):
        raise ValidationError("Ngày phải có định dạng YYYY-MM-DD")
    if start > end or (end - start).days > 366:
        raise ValidationError("Khoảng thời gian phải từ 1 đến 367 ngày")
    return start, end


def parse_page(value):
    try:
        page = int(value or 1)
    except (TypeError, ValueError):
        raise ValidationError("Trang không hợp lệ")
    if page < 1:
        raise ValidationError("Trang không hợp lệ")
    return page


def create_expense(employee_id, payload):
    category = str(payload.get("category") or "").strip()
    if category not in CATEGORIES:
        raise ValidationError("Loại chi phí không hợp lệ")
    amount = positive_amount(payload.get("amount"))
    try:
        occurred_on = datetime.strptime(str(payload.get("occurred_on")), "%Y-%m-%d").date()
    except (TypeError, ValueError):
        raise ValidationError("Ngày phát sinh không hợp lệ")
    description = str(payload.get("description") or "").strip()
    if not description or len(description) > 500:
        raise ValidationError("Diễn giải cần từ 1 đến 500 ký tự")
    invoice_id = payload.get("invoice_id") or None
    if invoice_id is not None:
        try:
            if str(invoice_id).strip() != str(int(invoice_id)):
                raise ValueError
            invoice_id = int(invoice_id)
        except (TypeError, ValueError):
            raise ValidationError("Mã đơn hàng không hợp lệ")
        if invoice_id <= 0 or not db.session.get(SalesInvoice, invoice_id):
            raise ValidationError("Đơn hàng liên quan không tồn tại")
    payment_method = payload.get("payment_method") or None
    if payment_method not in (None, PaymentMethod.CASH.value, PaymentMethod.BANK_TRANSFER.value):
        raise ValidationError("Phương thức thanh toán không hợp lệ")
    expense = OperatingExpense(
        category=category, amount=amount, occurred_on=occurred_on,
        invoice_id=invoice_id, description=description,
        payment_method=payment_method, created_by_id=employee_id,
    )
    try:
        db.session.add(expense)
        db.session.flush()
        if payment_method:
            record_fund_movement(
                payment_method, "out", amount, "operating_expense", expense.id,
                employee_id, f"{CATEGORIES[category]} #{expense.id}", description,
                occurred_at=vietnam_payment_time(),
            )
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise
    return serialize_expense(expense)


def serialize_expense(row):
    return {
        "id": row.id, "category": row.category, "category_label": CATEGORIES[row.category],
        "amount": float(row.amount), "occurred_on": row.occurred_on.isoformat(),
        "invoice_id": row.invoice_id, "description": row.description,
        "payment_method": row.payment_method, "created_at": row.created_at.isoformat(),
        "created_by_id": row.created_by_id,
        "voided_at": row.voided_at.isoformat() if row.voided_at else None,
        "void_reason": row.void_reason,
    }


def void_expense(employee_id, expense_id, reason):
    reason = str(reason or "").strip()
    if not reason or len(reason) > 500:
        raise ValidationError("Lý do hủy cần từ 1 đến 500 ký tự")
    try:
        expense = OperatingExpense.query.filter_by(id=expense_id).with_for_update().first()
        if expense is None:
            raise NotFoundError("Khoản chi không tồn tại")
        if expense.voided_at:
            raise ValidationError("Khoản chi đã được hủy", status_code=409)
        if expense.payment_method:
            record_fund_movement(
                expense.payment_method, "in", expense.amount,
                "operating_expense_void", expense.id, employee_id,
                f"Hoàn khoản chi #{expense.id}", reason,
                occurred_at=vietnam_payment_time(),
            )
        expense.voided_at = vietnam_payment_time()
        expense.voided_by_id = employee_id
        expense.void_reason = reason
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise
    return serialize_expense(expense)


def pay_expense(employee_id, expense_id, payment_method):
    if payment_method not in (PaymentMethod.CASH.value, PaymentMethod.BANK_TRANSFER.value):
        raise ValidationError("Chọn tiền mặt hoặc chuyển khoản")
    try:
        expense = OperatingExpense.query.filter_by(id=expense_id).with_for_update().first()
        if expense is None:
            raise NotFoundError("Khoản chi không tồn tại")
        if expense.voided_at or expense.payment_method:
            raise ValidationError("Khoản chi đã được thanh toán hoặc đã hủy", status_code=409)
        record_fund_movement(
            payment_method, "out", expense.amount, "operating_expense",
            expense.id, employee_id, f"{CATEGORIES[expense.category]} #{expense.id}",
            expense.description, occurred_at=vietnam_payment_time(),
        )
        expense.payment_method = payment_method
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise
    return serialize_expense(expense)


def list_expenses(from_value=None, to_value=None, page_value=None):
    start, end = parse_period(from_value, to_value)
    page = parse_page(page_value)
    query = OperatingExpense.query.filter(
        OperatingExpense.occurred_on >= start, OperatingExpense.occurred_on <= end,
    )
    total = query.count()
    rows = query.order_by(OperatingExpense.occurred_on.desc(), OperatingExpense.id.desc()).offset((page - 1) * 20).limit(20).all()
    return {
        "expenses": [serialize_expense(row) for row in rows],
        "pagination": build_pagination(page, 20, total),
        "period": {"from": start.isoformat(), "to": end.isoformat()},
    }


def _expense_totals(start, end):
    rows = db.session.query(
        OperatingExpense.category, func.sum(OperatingExpense.amount),
    ).filter(
        OperatingExpense.voided_at.is_(None),
        OperatingExpense.occurred_on >= start, OperatingExpense.occurred_on <= end,
    ).group_by(OperatingExpense.category).all()
    by_category = {category: money(amount) for category, amount in rows}
    return by_category, sum(by_category.values(), Decimal("0"))


def _shipping_total(start, end):
    return money(db.session.query(func.sum(SalesInvoice.shipping_fee)).filter(
        SalesInvoice.delivery_method == "third_party",
        SalesInvoice.shipping_charged_at >= datetime.combine(start, datetime.min.time()),
        SalesInvoice.shipping_charged_at < datetime.combine(end + timedelta(days=1), datetime.min.time()),
    ).scalar())


def _monthly_pricing_pool():
    today = vietnam_payment_time().date()
    by_category, recent_total = _expense_totals(today - timedelta(days=29), today)
    annual_repair = money(db.session.query(func.sum(OperatingExpense.amount)).filter(
        OperatingExpense.voided_at.is_(None),
        OperatingExpense.category == "vehicle_repair",
        OperatingExpense.occurred_on >= today - timedelta(days=364),
        OperatingExpense.occurred_on <= today,
    ).scalar())
    repair_allowance = rounded(annual_repair / 12)
    shipping = _shipping_total(today - timedelta(days=29), today)
    pool = recent_total - by_category.get("vehicle_repair", Decimal("0")) + repair_allowance + shipping
    return pool, by_category, repair_allowance, shipping


def _purchase_costs(product_ids, start=None, end=None):
    if not product_ids:
        return {}
    query = db.session.query(
        ImportInvoiceItem.product_id,
        func.sum(ImportInvoiceItem.quantity),
        func.sum(ImportInvoiceItem.quantity * ImportInvoiceItem.unit_price),
    ).join(ImportInvoice, ImportInvoiceItem.import_invoice_id == ImportInvoice.id).filter(
        ImportInvoiceItem.product_id.in_(product_ids),
    )
    if start:
        query = query.filter(ImportInvoice.imported_at >= start)
    if end:
        query = query.filter(ImportInvoice.imported_at < end)
    return {pid: rounded(money(total) / money(qty)) for pid, qty, total in query.group_by(ImportInvoiceItem.product_id).all() if qty}


def _pricing_row(product, policy, unit_cost, monthly_pool, forecast_revenue):
    planned = policy.planned_quantity if policy else DEFAULT_QUANTITY
    margin = money(policy.target_margin) if policy else DEFAULT_MARGIN
    current_price = money(product.default_sale_price)
    # Revenue share at current prices apportions monthly shared selling costs.
    allocated_month = monthly_pool * current_price * planned / forecast_revenue if forecast_revenue else Decimal("0")
    overhead_per_unit = rounded(allocated_month / planned)
    suggested = None
    if unit_cost is not None:
        raw_price = (unit_cost + overhead_per_unit) / (Decimal("1") - margin / 100)
        suggested = int((raw_price / 1000).to_integral_value(rounding=ROUND_CEILING) * 1000)
    return {
        "product_id": product.id, "name": product.name, "unit": product.unit,
        "current_price": float(current_price), "estimated_unit_cost": float(unit_cost) if unit_cost is not None else None,
        "overhead_per_unit": float(overhead_per_unit), "planned_quantity": planned,
        "target_margin": float(margin), "suggested_price": suggested,
    }


def pricing_catalog(page_value=None, keyword=None):
    page = parse_page(page_value)
    keyword = str(keyword or "").strip()[:100]
    query = Product.query
    if keyword:
        query = query.filter(Product.name.ilike(f"%{keyword}%"))
    total = query.count()
    products = query.order_by(Product.name, Product.id).offset((page - 1) * 20).limit(20).all()
    ids = [product.id for product in products]
    policies = {row.product_id: row for row in PricingPolicy.query.filter(PricingPolicy.product_id.in_(ids)).all()} if ids else {}
    recent_start = datetime.combine(vietnam_payment_time().date() - timedelta(days=89), datetime.min.time())
    recent_costs = _purchase_costs(ids, start=recent_start)
    missing_ids = [pid for pid in ids if pid not in recent_costs]
    fallback_costs = _purchase_costs(missing_ids)
    forecast_revenue = money(db.session.query(func.sum(
        Product.default_sale_price * func.coalesce(PricingPolicy.planned_quantity, DEFAULT_QUANTITY)
    )).outerjoin(PricingPolicy, PricingPolicy.product_id == Product.id).scalar())
    pool, expense_by_category, repair_allowance, shipping = _monthly_pricing_pool()
    return {
        "products": [_pricing_row(product, policies.get(product.id), recent_costs.get(product.id, fallback_costs.get(product.id)), pool, forecast_revenue) for product in products],
        "pagination": build_pagination(page, 20, total),
        "monthly_expense_pool": float(pool),
        "monthly_expenses_by_category": {key: float(value) for key, value in expense_by_category.items()},
        "monthly_repair_allowance": float(repair_allowance),
        "monthly_external_shipping": float(shipping),
        "basis_days": 30,
    }


def save_pricing_policy(employee_id, product_id, payload):
    if not db.session.get(Product, product_id):
        raise NotFoundError("Sản phẩm không tồn tại")
    try:
        quantity_value = Decimal(str(payload.get("planned_quantity")))
        if not quantity_value.is_finite() or quantity_value != quantity_value.to_integral_value():
            raise ValueError
        quantity = int(quantity_value)
        margin = Decimal(str(payload.get("target_margin")))
    except (TypeError, ValueError, InvalidOperation):
        raise ValidationError("Sản lượng hoặc biên lợi nhuận không hợp lệ")
    if quantity < 1 or quantity > 10000000 or not margin.is_finite() or margin < 0 or margin > 90 or margin.as_tuple().exponent < -2:
        raise ValidationError("Sản lượng phải từ 1 đến 10 triệu; biên lợi nhuận từ 0% đến 90%")
    policy = db.session.get(PricingPolicy, product_id)
    if policy is None:
        policy = PricingPolicy(product_id=product_id, updated_by_id=employee_id)
        db.session.add(policy)
    policy.planned_quantity = quantity
    policy.target_margin = margin
    policy.updated_by_id = employee_id
    policy.updated_at = vietnam_payment_time()
    db.session.commit()
    return {"product_id": product_id, "planned_quantity": quantity, "target_margin": float(margin)}


def apply_suggested_price(product_id, expected_price, expected_suggested_price):
    product = db.session.get(Product, product_id)
    if not product:
        raise NotFoundError("Sản phẩm không tồn tại")
    try:
        expected = Decimal(str(expected_price))
    except (TypeError, ValueError, InvalidOperation):
        raise ValidationError("Giá hiện tại không hợp lệ")
    if expected != money(product.default_sale_price):
        raise ValidationError("Giá sản phẩm đã thay đổi; hãy tải lại đề xuất", status_code=409)
    recent_start = datetime.combine(vietnam_payment_time().date() - timedelta(days=89), datetime.min.time())
    costs = _purchase_costs([product_id], start=recent_start)
    unit_cost = costs.get(product_id) or _purchase_costs([product_id]).get(product_id)
    if unit_cost is None:
        raise ValidationError("Chưa có giá nhập để đề xuất giá bán")
    policy = db.session.get(PricingPolicy, product_id)
    forecast = money(db.session.query(func.sum(Product.default_sale_price * func.coalesce(PricingPolicy.planned_quantity, DEFAULT_QUANTITY))).outerjoin(PricingPolicy, PricingPolicy.product_id == Product.id).scalar())
    pool, _, _, _ = _monthly_pricing_pool()
    proposal = _pricing_row(product, policy, unit_cost, pool, forecast)
    try:
        expected_suggestion = int(expected_suggested_price)
    except (TypeError, ValueError):
        raise ValidationError("Giá đề xuất cần được tải lại")
    if expected_suggestion != proposal["suggested_price"]:
        raise ValidationError("Chi phí hoặc mục tiêu đã thay đổi; hãy tải lại giá đề xuất", status_code=409)
    if proposal["suggested_price"] < 500:
        raise ValidationError("Giá đề xuất thấp hơn mức tối thiểu 500 đồng")
    product.default_sale_price = Decimal(proposal["suggested_price"])
    db.session.commit()
    return {"product_id": product.id, "new_price": proposal["suggested_price"]}


def profitability_report(from_value=None, to_value=None, page_value=None):
    start, end = parse_period(from_value, to_value)
    page = parse_page(page_value)
    from_dt = datetime.combine(start, datetime.min.time())
    until_dt = datetime.combine(end + timedelta(days=1), datetime.min.time())
    by_category, expense_total = _expense_totals(start, end)
    # One grouped SQL query per data source. No per-invoice or per-product reads.
    invoice_totals = db.session.query(
        SalesInvoiceItem.sales_invoice_id.label("invoice_id"),
        func.sum(SalesInvoiceItem.quantity * SalesInvoiceItem.unit_price).label("gross"),
    ).join(SalesInvoice, SalesInvoiceItem.sales_invoice_id == SalesInvoice.id).filter(
        SalesInvoice.status == InvoiceStatus.COMPLETED,
        SalesInvoice.sold_at >= from_dt, SalesInvoice.sold_at < until_dt,
    ).group_by(SalesInvoiceItem.sales_invoice_id).subquery()
    line_gross = SalesInvoiceItem.quantity * SalesInvoiceItem.unit_price
    share = line_gross / func.nullif(invoice_totals.c.gross, 0)
    sales = db.session.query(
        SalesInvoiceItem.product_id,
        func.sum(SalesInvoiceItem.quantity),
        func.sum(line_gross - SalesInvoice.discount_amount * share),
        func.sum(case(
            (
                (SalesInvoice.shipping_charged_at >= from_dt) & (SalesInvoice.shipping_charged_at < until_dt),
                func.coalesce(SalesInvoice.shipping_fee, 0),
            ),
            else_=0,
        ) * share),
    ).join(SalesInvoice, SalesInvoiceItem.sales_invoice_id == SalesInvoice.id).join(
        invoice_totals, invoice_totals.c.invoice_id == SalesInvoice.id,
    ).filter(
        SalesInvoice.status == InvoiceStatus.COMPLETED,
        SalesInvoice.sold_at >= from_dt, SalesInvoice.sold_at < until_dt,
    ).group_by(SalesInvoiceItem.product_id).all()
    ids = [row[0] for row in sales]
    names = {p.id: p for p in Product.query.filter(Product.id.in_(ids)).all()} if ids else {}
    costs = _purchase_costs(ids, end=until_dt)
    direct = db.session.query(
        SalesInvoiceItem.product_id,
        func.sum(OperatingExpense.amount * share),
    ).join(SalesInvoice, OperatingExpense.invoice_id == SalesInvoice.id).join(
        SalesInvoiceItem, SalesInvoiceItem.sales_invoice_id == SalesInvoice.id,
    ).join(invoice_totals, invoice_totals.c.invoice_id == SalesInvoice.id).filter(
        OperatingExpense.voided_at.is_(None),
        OperatingExpense.invoice_id.isnot(None),
        OperatingExpense.occurred_on >= start, OperatingExpense.occurred_on <= end,
        SalesInvoice.status == InvoiceStatus.COMPLETED,
        SalesInvoice.sold_at >= from_dt, SalesInvoice.sold_at < until_dt,
    ).group_by(SalesInvoiceItem.product_id).all()
    direct_by_product = {pid: money(amount) for pid, amount in direct}
    direct_total = sum(direct_by_product.values(), Decimal("0"))
    shared_total = expense_total - direct_total
    net_revenues = {pid: money(revenue) for pid, _, revenue, _ in sales}
    revenue_total = sum(net_revenues.values(), Decimal("0"))
    all_shipping = _shipping_total(start, end)
    direct_shipping = sum((money(row[3]) for row in sales), Decimal("0"))
    remaining_shipping = all_shipping - direct_shipping
    rows = []
    remaining_shared = shared_total
    for index, (pid, quantity, revenue, shipping) in enumerate(sales):
        net = net_revenues[pid]
        shared = (
            remaining_shared if index == len(sales) - 1
            else rounded(shared_total * net / revenue_total)
        ) if revenue_total else Decimal("0")
        remaining_shared -= shared
        extra_shipping = (
            remaining_shipping if index == len(sales) - 1
            else rounded((all_shipping - direct_shipping) * net / revenue_total)
        ) if revenue_total else Decimal("0")
        remaining_shipping -= extra_shipping
        product_shipping = money(shipping) + extra_shipping
        allocated = direct_by_product.get(pid, Decimal("0")) + shared
        estimated_cogs = rounded(costs[pid] * quantity) if pid in costs else None
        profit = rounded(net - product_shipping - allocated - estimated_cogs) if estimated_cogs is not None else None
        rows.append({
            "product_id": pid, "name": names[pid].name, "unit": names[pid].unit,
            "quantity": int(quantity), "net_revenue": float(rounded(net)),
            "estimated_cogs": float(estimated_cogs) if estimated_cogs is not None else None,
            "shipping_cost": float(rounded(product_shipping)),
            "operating_expenses": float(rounded(allocated)),
            "estimated_operating_profit": float(profit) if profit is not None else None,
        })
    rows.sort(key=lambda row: -row["net_revenue"])
    known_profit = sum((money(row["estimated_operating_profit"]) for row in rows if row["estimated_operating_profit"] is not None), Decimal("0"))
    if not rows:
        known_profit = -expense_total - all_shipping
    return {
        "period": {"from": start.isoformat(), "to": end.isoformat()},
        "revenue": float(rounded(revenue_total)), "expenses": float(rounded(expense_total)),
        "expenses_by_category": {key: float(value) for key, value in by_category.items()},
        "external_shipping": float(all_shipping),
        "estimated_cogs": float(sum((money(row["estimated_cogs"]) for row in rows if row["estimated_cogs"] is not None), Decimal("0"))),
        "estimated_operating_profit": float(rounded(known_profit)) if all(row["estimated_cogs"] is not None for row in rows) else None,
        "missing_cost_products": sum(row["estimated_cogs"] is None for row in rows),
        "unallocated_expenses": float(rounded(shared_total + remaining_shipping)) if not revenue_total else 0,
        "products": rows[(page - 1) * 20:page * 20],
        "product_pagination": build_pagination(page, 20, len(rows)),
    }
