"""Managerial pricing and operating profit estimates.

Expenses are booked once. Invoice-linked expenses are allocated to its items
for product analysis; other expenses remain period costs. Purchase cost is a
weighted import estimate, not a perpetual inventory valuation.
"""

from datetime import datetime, timedelta
from decimal import Decimal, InvalidOperation, ROUND_CEILING, ROUND_HALF_UP
from uuid import uuid4

from sqlalchemy import case, func
from sqlalchemy.exc import IntegrityError

from web import db
from web.models import (
    ExpenseCategory, ImportInvoice, ImportInvoiceItem, InvoiceStatus, OperatingExpense,
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


def list_expense_categories():
    custom = ExpenseCategory.query.order_by(ExpenseCategory.name.asc()).all()
    return [
        {"value": code, "label": label} for code, label in CATEGORIES.items()
    ] + [{"value": row.code, "label": row.name} for row in custom]


def create_expense_category(employee_id, payload):
    name = str(payload.get("name") or "").strip()
    if not name or len(name) > 120:
        raise ValidationError("Tên loại chi phí cần từ 1 đến 120 ký tự")
    if name.casefold() in {label.casefold() for label in CATEGORIES.values()}:
        raise ValidationError("Loại chi phí đã tồn tại", status_code=409)
    if ExpenseCategory.query.filter(func.lower(ExpenseCategory.name) == name.lower()).first():
        raise ValidationError("Loại chi phí đã tồn tại", status_code=409)
    category = ExpenseCategory(code=f"custom_{uuid4().hex[:17]}", name=name, created_by_id=employee_id)
    try:
        db.session.add(category)
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        raise ValidationError("Loại chi phí đã tồn tại", status_code=409)
    return {"value": category.code, "label": category.name}


def _category_label(code, custom_labels=None):
    if code in CATEGORIES:
        return CATEGORIES[code]
    if custom_labels is not None:
        return custom_labels.get(code)
    category = db.session.get(ExpenseCategory, code)
    return category.name if category else None


CENT = Decimal("0.01")
DEFAULT_MARKUP = Decimal("20")


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
    category_label = _category_label(category)
    if category_label is None:
        raise ValidationError("Loại chi phí không hợp lệ")
    amount = positive_amount(payload.get("amount"))
    try:
        occurred_on = datetime.strptime(str(payload.get("occurred_on")), "%Y-%m-%d").date()
    except (TypeError, ValueError):
        raise ValidationError("Ngày phát sinh không hợp lệ")
    description = str(payload.get("description") or "").strip()
    if not description or len(description) > 500:
        raise ValidationError("Nội dung chi phí cần từ 1 đến 500 ký tự")
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
                employee_id, f"{category_label} #{expense.id}", description,
                occurred_at=vietnam_payment_time(),
            )
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise
    return serialize_expense(expense)


def serialize_expense(row, category_labels=None):
    return {
        "id": row.id, "category": row.category,
        "category_label": _category_label(row.category, category_labels) or row.category,
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
            expense.id, employee_id, f"{_category_label(expense.category) or expense.category} #{expense.id}",
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
    custom_codes = {row.category for row in rows if row.category not in CATEGORIES}
    custom_labels = {
        row.code: row.name for row in ExpenseCategory.query.filter(ExpenseCategory.code.in_(custom_codes)).all()
    } if custom_codes else {}
    return {
        "expenses": [serialize_expense(row, custom_labels) for row in rows],
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


def _recent_expense_per_unit():
    end = vietnam_payment_time().date()
    start = end - timedelta(days=29)
    _, operating_expenses = _expense_totals(start, end)
    shipping = _shipping_total(start, end)
    units_sold = int(db.session.query(func.sum(SalesInvoiceItem.quantity)).join(
        SalesInvoice, SalesInvoiceItem.sales_invoice_id == SalesInvoice.id,
    ).filter(
        SalesInvoice.status == InvoiceStatus.COMPLETED,
        SalesInvoice.sold_at >= datetime.combine(start, datetime.min.time()),
        SalesInvoice.sold_at < datetime.combine(end + timedelta(days=1), datetime.min.time()),
    ).scalar() or 0)
    total_expenses = operating_expenses + shipping
    per_unit = (
        (total_expenses / units_sold).quantize(CENT, rounding=ROUND_CEILING)
        if units_sold else (Decimal("0") if total_expenses == 0 else None)
    )
    return operating_expenses, shipping, units_sold, per_unit


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


def _pricing_row(product, policy, unit_cost, expense_per_unit):
    markup = money(policy.markup_percent) if policy else DEFAULT_MARKUP
    current_price = money(product.default_sale_price)
    suggested = None
    if unit_cost is not None and expense_per_unit is not None:
        raw_price = unit_cost * (Decimal("1") + markup / 100) + expense_per_unit
        suggested = int((raw_price / 1000).to_integral_value(rounding=ROUND_CEILING) * 1000)
    return {
        "product_id": product.id, "name": product.name, "unit": product.unit,
        "current_price": float(current_price), "estimated_unit_cost": float(unit_cost) if unit_cost is not None else None,
        "expense_per_unit": float(expense_per_unit) if expense_per_unit is not None else None,
        "markup_percent": float(markup), "suggested_price": suggested,
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
    operating_expenses, shipping, units_sold, expense_per_unit = _recent_expense_per_unit()
    return {
        "products": [_pricing_row(product, policies.get(product.id), recent_costs.get(product.id, fallback_costs.get(product.id)), expense_per_unit) for product in products],
        "pagination": build_pagination(page, 20, total),
        "pricing_operating_expenses": float(operating_expenses),
        "pricing_shipping": float(shipping),
        "pricing_units_sold": units_sold,
        "pricing_expense_per_unit": float(expense_per_unit) if expense_per_unit is not None else None,
    }


def save_pricing_policy(employee_id, product_id, payload):
    if not db.session.get(Product, product_id):
        raise NotFoundError("Sản phẩm không tồn tại")
    try:
        markup = Decimal(str(payload.get("markup_percent")))
    except (TypeError, ValueError, InvalidOperation):
        raise ValidationError("Tỷ lệ lãi trên giá nhập không hợp lệ")
    if not markup.is_finite() or markup < 0 or markup > 90 or markup.as_tuple().exponent < -2:
        raise ValidationError("Tỷ lệ lãi trên giá nhập phải từ 0% đến 90%")
    policy = db.session.get(PricingPolicy, product_id)
    if policy is None:
        policy = PricingPolicy(product_id=product_id, updated_by_id=employee_id)
        db.session.add(policy)
    policy.markup_percent = markup
    policy.updated_by_id = employee_id
    policy.updated_at = vietnam_payment_time()
    db.session.commit()
    return {"product_id": product_id, "markup_percent": float(markup)}


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
    _, _, _, expense_per_unit = _recent_expense_per_unit()
    if expense_per_unit is None:
        raise ValidationError("Chưa có sản phẩm bán trong 30 ngày để phân bổ chi phí")
    proposal = _pricing_row(product, policy, unit_cost, expense_per_unit)
    try:
        expected_suggestion = int(expected_suggested_price)
    except (TypeError, ValueError):
        raise ValidationError("Giá đề xuất cần được tải lại")
    if expected_suggestion != proposal["suggested_price"]:
        raise ValidationError("Giá nhập, chi phí hoặc tỷ lệ lãi đã thay đổi; hãy tải lại giá đề xuất", status_code=409)
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
