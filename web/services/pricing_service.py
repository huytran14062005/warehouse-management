"""Managerial pricing and operating profit estimates.

Expenses are booked once. Invoice-linked expenses are allocated to its items
for product analysis; other expenses remain period costs. Purchase cost is a
weighted import estimate, not a perpetual inventory valuation.
"""

from datetime import date, datetime, timedelta
from decimal import Decimal, InvalidOperation, ROUND_CEILING, ROUND_HALF_UP, localcontext
from uuid import uuid4

from sqlalchemy import case, func
from sqlalchemy.exc import IntegrityError

from web import db
from web.models import (
    CompanyFundEntry, ExpenseCategory, ExpenseType, FundEntryType, ImportInvoice,
    ImportInvoiceItem, InvoiceStatus, OperatingExpense, PaymentMethod, PricingCycle,
    PricingPolicy, Product, SalesInvoice, SalesInvoiceItem,
    vietnam_payment_time,
)
from web.services.company_fund_service import record_fund_movement
from web.services.exceptions import NotFoundError, ValidationError
from web.services.unit_conversion import positive_quantity
from web.utils.pagination import build_pagination


CATEGORIES = {
    "fuel": "Xăng xe",
    "utilities": "Điện nước",
    "vehicle_repair": "Sửa xe",
    "maintenance": "Bảo trì",
    "shrinkage": "Hao hụt",
    "lodging": "Nhà nghỉ",
    "sales_salary": "Lương nhân viên",
    "overtime": "Tiền tăng ca",
    "depreciation": "Khấu hao xe, thiết bị",
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


def expense_type_for(category):
    return ExpenseType.FIXED_SALARY if category == "sales_salary" else ExpenseType.INCIDENTAL


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


def _expense_details(payload, existing=None):
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
    trip_invoice_ids = payload.get("trip_invoice_ids", existing.trip_invoice_ids if existing else None)
    if trip_invoice_ids in (None, "", []):
        trip_invoice_ids = None
    else:
        if not isinstance(trip_invoice_ids, list) or not 1 <= len(trip_invoice_ids) <= 30:
            raise ValidationError("Chuyến xe phải có từ 1 đến 30 đơn hàng")
        raw_trip_ids = trip_invoice_ids
        try:
            trip_invoice_ids = [int(value) for value in trip_invoice_ids]
        except (TypeError, ValueError):
            raise ValidationError("Danh sách đơn trong chuyến không hợp lệ")
        if (any(isinstance(raw, bool) or str(raw).strip() != str(value)
                for raw, value in zip(raw_trip_ids, trip_invoice_ids)) or
                any(value <= 0 for value in trip_invoice_ids) or
                len(set(trip_invoice_ids)) != len(trip_invoice_ids)):
            raise ValidationError("Danh sách đơn trong chuyến bị trùng hoặc không hợp lệ")
        existing_ids = {value for (value,) in db.session.query(SalesInvoice.id).filter(
            SalesInvoice.id.in_(trip_invoice_ids)).all()}
        if existing_ids != set(trip_invoice_ids):
            raise ValidationError("Có đơn trong chuyến không tồn tại")
        if invoice_id is not None:
            raise ValidationError("Chọn một đơn hoặc một chuyến gồm nhiều đơn, không chọn cả hai")
    if invoice_id is not None:
        try:
            if str(invoice_id).strip() != str(int(invoice_id)):
                raise ValueError
            invoice_id = int(invoice_id)
        except (TypeError, ValueError):
            raise ValidationError("Mã đơn hàng không hợp lệ")
        if invoice_id <= 0 or not db.session.get(SalesInvoice, invoice_id):
            raise ValidationError("Đơn hàng liên quan không tồn tại")
    legacy_salary_link = (
        existing is not None and existing.category == "sales_salary"
        and existing.invoice_id == invoice_id
    )
    if expense_type_for(category) == ExpenseType.FIXED_SALARY and invoice_id is not None and not legacy_salary_link:
        raise ValidationError("Lương nhân viên là chi phí chung, không gắn với đơn bán")
    if expense_type_for(category) == ExpenseType.FIXED_SALARY and trip_invoice_ids:
        raise ValidationError("Lương nhân viên là chi phí chung, không gắn với chuyến xe")
    is_abnormal = payload.get("is_abnormal", existing.is_abnormal if existing else False)
    if not isinstance(is_abnormal, bool):
        raise ValidationError("Đánh dấu chi phí bất thường không hợp lệ")
    if category == "sales_salary" and is_abnormal:
        raise ValidationError("Lương thực tế không được đánh dấu là chi phí bất thường")
    allocation_basis = payload.get("allocation_basis", existing.allocation_basis if existing else "revenue")
    if allocation_basis not in ("revenue", "weight", "volume"):
        raise ValidationError("Cách phân bổ chi phí đơn/chuyến không hợp lệ")
    linked_invoice_ids = trip_invoice_ids or ([invoice_id] if invoice_id is not None else [])
    if linked_invoice_ids:
        invoice_gross_rows = db.session.query(
            SalesInvoiceItem.sales_invoice_id,
            func.sum(SalesInvoiceItem.quantity * SalesInvoiceItem.unit_price),
        ).filter(SalesInvoiceItem.sales_invoice_id.in_(linked_invoice_ids)).group_by(
            SalesInvoiceItem.sales_invoice_id,
        ).all()
        if {row[0] for row in invoice_gross_rows} != set(linked_invoice_ids):
            raise ValidationError("Mọi đơn trong chuyến phải có sản phẩm")
        if allocation_basis == "revenue" and sum((money(row[1]) for row in invoice_gross_rows), Decimal("0")) <= 0:
            raise ValidationError("Không thể phân bổ chi phí khi doanh thu đơn/chuyến bằng 0")
    if allocation_basis != "revenue":
        if invoice_id is None and not trip_invoice_ids:
            raise ValidationError("Chỉ chi phí gắn đơn/chuyến mới phân bổ theo trọng lượng hoặc thể tích")
        measure = Product.weight_per_unit if allocation_basis == "weight" else Product.volume_per_unit
        invoice_ids = linked_invoice_ids
        line_count, missing_count = db.session.query(
            func.count(SalesInvoiceItem.id),
            func.sum(case((measure.is_(None) | (measure <= 0), 1), else_=0)),
        ).join(Product, Product.id == SalesInvoiceItem.product_id).filter(
            SalesInvoiceItem.sales_invoice_id.in_(invoice_ids),
        ).one()
        if not line_count or missing_count:
            raise ValidationError("Mọi sản phẩm trong đơn phải có trọng lượng/thể tích mỗi đơn vị trước khi phân bổ")
    return {
        "category": category, "category_label": category_label, "amount": amount,
        "occurred_on": occurred_on, "description": description, "invoice_id": invoice_id,
        "is_abnormal": is_abnormal,
        "allocation_basis": allocation_basis,
        "trip_invoice_ids": trip_invoice_ids,
    }


def create_expense(employee_id, payload):
    details = _expense_details(payload)
    payment_method = payload.get("payment_method") or None
    if payment_method not in (None, PaymentMethod.CASH.value, PaymentMethod.BANK_TRANSFER.value):
        raise ValidationError("Phương thức thanh toán không hợp lệ")
    expense = OperatingExpense(
        category=details["category"], amount=details["amount"],
        occurred_on=details["occurred_on"], invoice_id=details["invoice_id"],
        description=details["description"],
        is_abnormal=details["is_abnormal"],
        allocation_basis=details["allocation_basis"],
        trip_invoice_ids=details["trip_invoice_ids"],
        payment_method=payment_method, created_by_id=employee_id,
    )
    try:
        db.session.add(expense)
        db.session.flush()
        if payment_method:
            record_fund_movement(
                payment_method, "out", details["amount"], "operating_expense", expense.id,
                employee_id, f"{details['category_label']} #{expense.id}", details["description"],
                occurred_at=vietnam_payment_time(),
            )
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise
    return serialize_expense(expense)


def update_expense(employee_id, expense_id, payload):
    try:
        expense = OperatingExpense.query.filter_by(id=expense_id).with_for_update().first()
        if expense is None:
            raise NotFoundError("Khoản chi không tồn tại")
        if expense.voided_at:
            raise ValidationError("Không thể sửa khoản chi đã hủy", status_code=409)
        if "payment_method" in payload and payload["payment_method"] != expense.payment_method:
            raise ValidationError("Trạng thái ghi quỹ được thay đổi bằng thao tác Ghi đã chi hoặc Hủy khoản chi")
        details = _expense_details(payload, expense)
        old_amount = money(expense.amount)
        difference = details["amount"] - old_amount
        if difference and expense.payment_method:
            reason = str(payload.get("reason") or "").strip()
            if not reason or len(reason) > 500:
                raise ValidationError("Cần nhập lý do sửa số tiền đã chi, tối đa 500 ký tự")
            previous_revisions = db.session.query(CompanyFundEntry.source_type).filter(
                CompanyFundEntry.source_id == expense.id,
                CompanyFundEntry.source_type.like("expense_edit_%"),
            ).all()
            prefix = "expense_edit_"
            revision = max(
                (int(source[len(prefix):]) for (source,) in previous_revisions
                 if source.startswith(prefix) and source[len(prefix):].isdecimal()),
                default=0,
            ) + 1
            record_fund_movement(
                expense.payment_method, "out" if difference > 0 else "in", abs(difference),
                f"{prefix}{revision}", expense.id, employee_id,
                f"Điều chỉnh khoản chi #{expense.id}", reason,
                occurred_at=vietnam_payment_time(),
                entry_type=FundEntryType.OPERATING_EXPENSE_ADJUSTMENT.value,
            )
        expense.category = details["category"]
        expense.amount = details["amount"]
        expense.occurred_on = details["occurred_on"]
        expense.invoice_id = details["invoice_id"]
        expense.description = details["description"]
        expense.is_abnormal = details["is_abnormal"]
        expense.allocation_basis = details["allocation_basis"]
        expense.trip_invoice_ids = details["trip_invoice_ids"]
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise
    return serialize_expense(expense)


def serialize_expense(row, category_labels=None):
    return {
        "id": row.id, "category": row.category,
        "expense_type": expense_type_for(row.category).value,
        "category_label": _category_label(row.category, category_labels) or row.category,
        "amount": float(row.amount), "occurred_on": row.occurred_on.isoformat(),
        "invoice_id": row.invoice_id, "description": row.description,
        "is_abnormal": bool(row.is_abnormal),
        "allocation_basis": row.allocation_basis or "revenue",
        "trip_invoice_ids": row.trip_invoice_ids or [],
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


def list_expenses(from_value=None, to_value=None, page_value=None, expense_type=None):
    start, end = parse_period(from_value, to_value)
    page = parse_page(page_value)
    if expense_type not in (None, ExpenseType.INCIDENTAL.value, ExpenseType.FIXED_SALARY.value):
        raise ValidationError("Nhóm chi phí không hợp lệ")
    query = OperatingExpense.query.filter(
        OperatingExpense.occurred_on >= start, OperatingExpense.occurred_on <= end,
    )
    if expense_type == ExpenseType.FIXED_SALARY.value:
        query = query.filter(OperatingExpense.category == "sales_salary")
    elif expense_type == ExpenseType.INCIDENTAL.value:
        query = query.filter(OperatingExpense.category != "sales_salary")
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


def _pricing_expense_totals(start, end):
    """Accrual costs: direct and abnormal costs never enter the shared pool."""
    shared_flag = OperatingExpense.invoice_id.is_(None) & OperatingExpense.trip_invoice_ids.is_(None)
    rows = db.session.query(
        OperatingExpense.category, shared_flag.label("is_shared"),
        OperatingExpense.is_abnormal,
        func.sum(OperatingExpense.amount),
    ).filter(
        OperatingExpense.voided_at.is_(None),
        OperatingExpense.occurred_on >= start, OperatingExpense.occurred_on <= end,
    ).group_by(OperatingExpense.category, shared_flag, OperatingExpense.is_abnormal).all()
    shared_by_category = {}
    shared_total = Decimal("0")
    direct_total = Decimal("0")
    abnormal_total = Decimal("0")
    for category, is_shared, is_abnormal, amount in rows:
        amount = money(amount)
        if is_abnormal:
            abnormal_total += amount
        elif is_shared:
            shared_by_category[category] = shared_by_category.get(category, Decimal("0")) + amount
            shared_total += amount
        else:
            direct_total += amount
    return shared_by_category, shared_total, direct_total, abnormal_total


def _shipping_total(start, end):
    return money(db.session.query(func.sum(SalesInvoice.shipping_fee)).filter(
        SalesInvoice.delivery_method == "third_party",
        SalesInvoice.shipping_charged_at >= datetime.combine(start, datetime.min.time()),
        SalesInvoice.shipping_charged_at < datetime.combine(end + timedelta(days=1), datetime.min.time()),
    ).scalar())


def _month_start(day):
    return day.replace(day=1)


def _shift_months(month_start, count):
    month_index = month_start.year * 12 + month_start.month - 1 + count
    return date(month_index // 12, month_index % 12 + 1, 1)


def _pricing_cycle_start():
    """Pricing uses the current calendar month; old cumulative cycles stay archived."""
    return _month_start(vietnam_payment_time().date())


def save_pricing_cycle(employee_id, payload):
    start_date = _pricing_cycle_start()
    if "start_date" in payload and str(payload["start_date"]) != start_date.isoformat():
        raise ValidationError("Kỳ tính giá hiện tự động bắt đầu từ đầu tháng hiện tại")
    cycle = db.session.get(PricingCycle, 1)
    planned_salary = cycle.planned_salary_amount if cycle and cycle.start_date == start_date else None
    planned_revenue = cycle.planned_revenue_amount if cycle and cycle.start_date == start_date else None
    if "planned_salary_amount" in payload:
        value = payload["planned_salary_amount"]
        if value in (None, ""):
            planned_salary = None
        else:
            try:
                planned_salary = Decimal(str(value))
            except (TypeError, ValueError, InvalidOperation):
                raise ValidationError("Mức lương kế hoạch không hợp lệ")
            if (not planned_salary.is_finite() or planned_salary < 0
                    or planned_salary > Decimal("999999999999.99")
                    or planned_salary.as_tuple().exponent < -2):
                raise ValidationError("Mức lương kế hoạch phải từ 0 đồng và có tối đa 2 chữ số thập phân")
    if "planned_revenue_amount" in payload:
        value = payload["planned_revenue_amount"]
        if value in (None, ""):
            planned_revenue = None
        else:
            planned_revenue = positive_amount(value)
    if cycle is None:
        cycle = PricingCycle(id=1, updated_by_id=employee_id)
        db.session.add(cycle)
    cycle.start_date = start_date
    cycle.planned_salary_amount = planned_salary
    cycle.planned_revenue_amount = planned_revenue
    cycle.updated_at = vietnam_payment_time()
    cycle.updated_by_id = employee_id
    db.session.commit()
    return {"start_date": start_date.isoformat(),
            "planned_salary_amount": float(planned_salary) if planned_salary is not None else None,
            "planned_revenue_amount": float(planned_revenue) if planned_revenue is not None else None}


def _purchase_costs(product_ids, start=None, end=None):
    """Weighted landed cost; split each import's inbound fee by line value."""
    if not product_ids:
        return {}
    invoice_totals = db.session.query(
        ImportInvoiceItem.import_invoice_id.label("invoice_id"),
        func.sum(func.coalesce(ImportInvoiceItem.line_total, ImportInvoiceItem.quantity * ImportInvoiceItem.unit_price)).label("amount"),
    ).group_by(ImportInvoiceItem.import_invoice_id).subquery()
    line_amount = func.coalesce(ImportInvoiceItem.line_total, ImportInvoiceItem.quantity * ImportInvoiceItem.unit_price)
    landed_amount = line_amount + line_amount * (
        func.coalesce(ImportInvoice.inbound_fee, 0) - func.coalesce(ImportInvoice.deductible_input_vat, 0)
    ) / func.nullif(invoice_totals.c.amount, 0)
    query = db.session.query(
        ImportInvoiceItem.product_id,
        func.sum(ImportInvoiceItem.quantity),
        func.sum(landed_amount),
    ).join(ImportInvoice, ImportInvoiceItem.import_invoice_id == ImportInvoice.id).join(
        invoice_totals, invoice_totals.c.invoice_id == ImportInvoice.id,
    ).filter(
        ImportInvoiceItem.product_id.in_(product_ids),
    )
    if start:
        query = query.filter(ImportInvoice.imported_at >= start)
    if end:
        query = query.filter(ImportInvoice.imported_at < end)
    return {pid: rounded(money(total) / money(qty)) for pid, qty, total in query.group_by(ImportInvoiceItem.product_id).all() if qty}


def _pricing_row(product, policy, unit_cost, expense_total, planned_revenue, direct_per_unit=None):
    planned_quantity = policy.planned_quantity if policy else None
    markup = money(policy.markup_percent) if policy else DEFAULT_MARKUP
    legacy_fixed_profit = bool(policy and policy.desired_profit_per_unit is not None)
    current_price = money(product.default_sale_price)
    reference_price = money(policy.reference_price) if policy and policy.reference_price is not None else current_price
    planned_product_revenue = reference_price * planned_quantity if planned_quantity else None
    rounding_step = policy.rounding_step if policy and policy.rounding_step else 1000
    suggested = None
    expense_per_unit = None
    full_cost = None
    desired_profit = None
    actual_profit = None
    actual_markup = None
    current_price_profit = None
    current_price_markup = None
    if (unit_cost is not None and planned_quantity and planned_revenue and planned_revenue > 0
            and reference_price > 0 and policy.reference_price is not None):
        with localcontext() as context:
            context.prec = 60
            expense_per_unit = expense_total * reference_price / planned_revenue
    if unit_cost is not None and expense_per_unit is not None:
        with localcontext() as context:
            context.prec = 60
            full_cost = unit_cost + expense_per_unit + (direct_per_unit or Decimal("0"))
            if legacy_fixed_profit:
                # Show the old fixed-profit plan until a manager explicitly saves a %.
                desired_profit = money(policy.desired_profit_per_unit)
                raw_price = full_cost + desired_profit
                if full_cost > 0:
                    markup = (desired_profit * 100 / full_cost).quantize(CENT, rounding=ROUND_HALF_UP)
            else:
                desired_profit = full_cost * markup / 100
                raw_price = full_cost * (Decimal("1") + markup / 100)
            suggested = int((raw_price / rounding_step).to_integral_value(rounding=ROUND_CEILING) * rounding_step)
            actual_profit = Decimal(suggested) - full_cost
            actual_markup = rounded(actual_profit * 100 / full_cost) if full_cost > 0 else None
            current_price_profit = current_price - full_cost
            current_price_markup = rounded(current_price_profit * 100 / full_cost) if full_cost > 0 else None
    return {
        "product_id": product.id, "name": product.name, "unit": product.unit,
        "current_price": float(current_price), "estimated_unit_cost": float(unit_cost) if unit_cost is not None else None,
        "expense_per_unit": float(expense_per_unit) if expense_per_unit is not None else None,
        "shared_expense_per_unit": float(expense_per_unit) if expense_per_unit is not None else None,
        "direct_expense_per_unit": float(direct_per_unit or 0),
        "planned_revenue": float(planned_product_revenue) if planned_product_revenue is not None else None,
        "reference_price": float(reference_price), "rounding_step": rounding_step,
        "reference_confirmed": bool(policy and policy.reference_price is not None),
        "full_cost_per_unit": float(full_cost) if full_cost is not None else None,
        "markup_percent": float(markup), "planned_quantity": str(planned_quantity) if planned_quantity else "",
        "desired_profit_per_unit": float(desired_profit) if desired_profit is not None else None,
        "actual_profit_per_unit": float(actual_profit) if actual_profit is not None else None,
        "actual_markup_percent": float(actual_markup) if actual_markup is not None else None,
        "profit_at_current_price_per_unit": float(current_price_profit) if current_price_profit is not None else None,
        "markup_at_current_price_percent": float(current_price_markup) if current_price_markup is not None else None,
        "legacy_fixed_profit": legacy_fixed_profit,
        "suggested_price": suggested,
    }


def _trip_allocations(start, end, product_ids=None, period_sales_only=False):
    """One batched read of multi-order trips and their completed sale lines."""
    if product_ids is not None and not product_ids:
        return []
    expenses = OperatingExpense.query.filter(
        OperatingExpense.trip_invoice_ids.isnot(None), OperatingExpense.voided_at.is_(None),
        OperatingExpense.is_abnormal.is_(False),
        OperatingExpense.occurred_on >= start, OperatingExpense.occurred_on <= end,
    ).all()
    invoice_ids = {invoice_id for expense in expenses for invoice_id in (expense.trip_invoice_ids or [])}
    if not invoice_ids:
        return []
    query = db.session.query(
        SalesInvoice.id, SalesInvoice.discount_amount,
        SalesInvoiceItem.product_id, SalesInvoiceItem.quantity, SalesInvoiceItem.unit_price,
        Product.weight_per_unit, Product.volume_per_unit,
    ).join(SalesInvoiceItem, SalesInvoiceItem.sales_invoice_id == SalesInvoice.id).join(
        Product, Product.id == SalesInvoiceItem.product_id,
    ).filter(SalesInvoice.id.in_(invoice_ids), SalesInvoice.status == InvoiceStatus.COMPLETED)
    if period_sales_only:
        query = query.filter(
            SalesInvoice.sold_at >= datetime.combine(start, datetime.min.time()),
            SalesInvoice.sold_at < datetime.combine(end + timedelta(days=1), datetime.min.time()),
        )
    rows = query.all()
    gross_by_invoice = {}
    for invoice_id, _, _, quantity, price, _, _ in rows:
        gross_by_invoice[invoice_id] = gross_by_invoice.get(invoice_id, Decimal("0")) + money(quantity) * money(price)
    lines_by_invoice = {}
    for invoice_id, discount, pid, quantity, price, weight, volume in rows:
        gross = money(quantity) * money(price)
        invoice_gross = gross_by_invoice[invoice_id]
        net = gross - money(discount) * gross / invoice_gross if invoice_gross else Decimal("0")
        lines_by_invoice.setdefault(invoice_id, []).append({
            "pid": pid, "invoice_id": invoice_id, "quantity": money(quantity), "revenue": net,
            "weight": money(quantity) * money(weight),
            "volume": money(quantity) * money(volume),
        })
    selected = set(product_ids) if product_ids is not None else None
    allocations = []
    for expense in expenses:
        lines = [line for invoice_id in expense.trip_invoice_ids or []
                 for line in lines_by_invoice.get(invoice_id, [])]
        basis = expense.allocation_basis or "revenue"
        total_basis = sum((line[basis] for line in lines), Decimal("0"))
        if total_basis <= 0:
            continue
        quantity_by_product = {}
        amount_by_product = {}
        invoice_quantities = {}
        for line in lines:
            pid = line["pid"]
            quantity_by_product[pid] = quantity_by_product.get(pid, Decimal("0")) + line["quantity"]
            key = (line["invoice_id"], pid)
            invoice_quantities[key] = invoice_quantities.get(key, Decimal("0")) + line["quantity"]
            amount_by_product[pid] = amount_by_product.get(pid, Decimal("0")) + money(expense.amount) * line[basis] / total_basis
        for pid, amount in amount_by_product.items():
            if selected is None or pid in selected:
                allocations.append((expense, pid, amount, quantity_by_product[pid],
                                    {key: value for key, value in invoice_quantities.items() if key[1] == pid}))
    return allocations


def _direct_costs(start, end, product_ids=None, trip_allocations=None):
    """Allocate order costs by their chosen basis, then average per sold base unit."""
    if product_ids is not None and not product_ids:
        return {}
    start_dt = datetime.combine(start, datetime.min.time())
    end_dt = datetime.combine(end + timedelta(days=1), datetime.min.time())
    invoice_bases = db.session.query(
        SalesInvoiceItem.sales_invoice_id.label("invoice_id"),
        func.sum(SalesInvoiceItem.quantity * SalesInvoiceItem.unit_price).label("gross"),
        func.sum(SalesInvoiceItem.quantity * Product.weight_per_unit).label("weight"),
        func.sum(SalesInvoiceItem.quantity * Product.volume_per_unit).label("volume"),
    ).join(SalesInvoice, SalesInvoice.id == SalesInvoiceItem.sales_invoice_id).join(
        Product, Product.id == SalesInvoiceItem.product_id,
    ).filter(
        SalesInvoice.status == InvoiceStatus.COMPLETED,
        SalesInvoice.sold_at >= start_dt, SalesInvoice.sold_at < end_dt,
    ).group_by(SalesInvoiceItem.sales_invoice_id).subquery()
    expense_by_invoice = db.session.query(
        OperatingExpense.invoice_id.label("invoice_id"),
        func.sum(case((OperatingExpense.allocation_basis == "revenue", OperatingExpense.amount), else_=0)).label("revenue_amount"),
        func.sum(case((OperatingExpense.allocation_basis == "weight", OperatingExpense.amount), else_=0)).label("weight_amount"),
        func.sum(case((OperatingExpense.allocation_basis == "volume", OperatingExpense.amount), else_=0)).label("volume_amount"),
    ).filter(
        OperatingExpense.invoice_id.isnot(None), OperatingExpense.voided_at.is_(None),
        OperatingExpense.trip_invoice_ids.is_(None),
        OperatingExpense.is_abnormal.is_(False),
        OperatingExpense.occurred_on >= start, OperatingExpense.occurred_on <= end,
    ).group_by(OperatingExpense.invoice_id).subquery()
    freight = case((
        (SalesInvoice.delivery_method == "third_party") &
        (SalesInvoice.shipping_charged_at >= start_dt) &
        (SalesInvoice.shipping_charged_at < end_dt),
        func.coalesce(SalesInvoice.shipping_fee, 0),
    ), else_=0)
    line_revenue = SalesInvoiceItem.quantity * SalesInvoiceItem.unit_price
    line_weight = SalesInvoiceItem.quantity * Product.weight_per_unit
    line_volume = SalesInvoiceItem.quantity * Product.volume_per_unit
    allocated_cost = (
        func.coalesce((func.coalesce(expense_by_invoice.c.revenue_amount, 0) + freight) *
                      line_revenue / func.nullif(invoice_bases.c.gross, 0), 0) +
        func.coalesce(expense_by_invoice.c.weight_amount * line_weight /
                      func.nullif(invoice_bases.c.weight, 0), 0) +
        func.coalesce(expense_by_invoice.c.volume_amount * line_volume /
                      func.nullif(invoice_bases.c.volume, 0), 0)
    )
    invoice_cost = (func.coalesce(expense_by_invoice.c.revenue_amount, 0) +
                    func.coalesce(expense_by_invoice.c.weight_amount, 0) +
                    func.coalesce(expense_by_invoice.c.volume_amount, 0) + freight)
    allocated_query = db.session.query(
        SalesInvoice.id,
        SalesInvoiceItem.product_id,
        allocated_cost,
        SalesInvoiceItem.quantity,
    ).join(SalesInvoice, SalesInvoice.id == SalesInvoiceItem.sales_invoice_id).join(
        invoice_bases, invoice_bases.c.invoice_id == SalesInvoice.id,
    ).join(Product, Product.id == SalesInvoiceItem.product_id).outerjoin(
        expense_by_invoice, expense_by_invoice.c.invoice_id == SalesInvoice.id,
    ).filter(
        SalesInvoice.status == InvoiceStatus.COMPLETED,
        SalesInvoice.sold_at >= start_dt, SalesInvoice.sold_at < end_dt,
        invoice_cost > 0,
    )
    if product_ids is not None:
        allocated_query = allocated_query.filter(SalesInvoiceItem.product_id.in_(product_ids))
    amounts = {}
    quantities = {}
    seen_lines = set()
    for invoice_id, pid, amount, qty in allocated_query.all():
        amounts[pid] = amounts.get(pid, Decimal("0")) + money(amount)
        quantities[pid] = quantities.get(pid, Decimal("0")) + money(qty)
        seen_lines.add((invoice_id, pid))
    if trip_allocations is None:
        trip_allocations = _trip_allocations(start, end, product_ids)
    for expense, pid, amount, quantity, invoice_quantities in trip_allocations:
        amounts[pid] = amounts.get(pid, Decimal("0")) + amount
        for key, qty in invoice_quantities.items():
            if key not in seen_lines:
                quantities[pid] = quantities.get(pid, Decimal("0")) + qty
                seen_lines.add(key)
    return {pid: amount / quantities[pid] for pid, amount in amounts.items()
            if quantities.get(pid)}


def _pricing_inputs(cost_mode="actual", product_ids=None):
    if cost_mode not in ("actual", "average_3m"):
        raise ValidationError("Nguồn chi phí tính giá không hợp lệ")
    product_policies = db.session.query(
        Product.id.label("id"),
        Product.default_sale_price.label("current_price"),
        PricingPolicy.product_id.label("policy_product_id"),
        PricingPolicy.planned_quantity,
        PricingPolicy.markup_percent.label("markup_percent"),
        PricingPolicy.desired_profit_per_unit,
        PricingPolicy.reference_price,
        PricingPolicy.rounding_step,
    ).join(PricingPolicy, PricingPolicy.product_id == Product.id).all()
    ids = list(product_ids) if product_ids is not None else [row.id for row in product_policies]
    policies = {
        row.id: row for row in product_policies
    }
    recent_start = datetime.combine(vietnam_payment_time().date() - timedelta(days=89), datetime.min.time())
    recent_costs = _purchase_costs(ids, start=recent_start)
    fallback_costs = _purchase_costs([pid for pid in ids if pid not in recent_costs])
    costs = {pid: recent_costs.get(pid, fallback_costs.get(pid)) for pid in ids}
    start = _pricing_cycle_start()
    end = vietnam_payment_time().date()
    expenses_by_category, actual_shared, direct_expenses, abnormal_expenses = _pricing_expense_totals(start, end)
    actual_salary = expenses_by_category.get("sales_salary", Decimal("0"))
    cycle = db.session.get(PricingCycle, 1)
    current_cycle = cycle and cycle.start_date == start
    planned_salary = money(cycle.planned_salary_amount) if current_cycle and cycle.planned_salary_amount is not None else None
    planned_revenue = money(cycle.planned_revenue_amount) if current_cycle and cycle.planned_revenue_amount is not None else None
    confirmed_revenue = planned_revenue
    shipping = _shipping_total(start, end)
    current_estimate = actual_shared
    previous_start = _shift_months(start, -3)
    historical_end = start - timedelta(days=1)
    _, historical_eligible, _, _ = _pricing_expense_totals(previous_start, historical_end)
    average_available = historical_eligible > 0
    average_shared = historical_eligible / Decimal("3")
    if cost_mode == "average_3m" and not average_available:
        raise ValidationError("Chưa có chi phí của 3 tháng trước để tính bình quân")
    estimated_salary = planned_salary if actual_salary == 0 and planned_salary is not None and cost_mode == "actual" else Decimal("0")
    shared_expenses = (average_shared if cost_mode == "average_3m" else current_estimate + estimated_salary)
    if direct_expenses or shipping:
        trip_allocations = _trip_allocations(start, end, ids)
        direct_per_unit = _direct_costs(start, end, ids, trip_allocations)
    else:
        trip_allocations = []
        direct_per_unit = {}
    planned_products_revenue = sum((money(row.reference_price) if row.reference_price is not None
                                    else money(row.current_price)) * row.planned_quantity
                                   for row in product_policies)
    warnings = []
    if planned_revenue is None or planned_revenue <= 0:
        warnings.append("Chưa có tổng doanh thu kế hoạch toàn công ty được quản lý xác nhận; chưa tính COST và giá đề xuất.")
    elif planned_products_revenue > planned_revenue:
        warnings.append("Tổng doanh thu kế hoạch của các sản phẩm vượt doanh thu kế hoạch toàn công ty; chưa tính COST và giá đề xuất.")
        planned_revenue = None
    if any(policy.reference_price is None for policy in policies.values()):
        warnings.append("Một số kế hoạch sản phẩm cũ chưa xác nhận giá tham chiếu; hãy lưu lại kế hoạch từng sản phẩm trước khi áp dụng giá.")
    if actual_salary == 0:
        if cost_mode == "average_3m":
            warnings.append("Chưa ghi nhận lương phát sinh tháng này; giá đề xuất dùng chi phí bình quân 3 tháng trước.")
        elif planned_salary is not None and planned_salary > 0:
            warnings.append("Chưa ghi nhận lương phát sinh tháng này; COST dự kiến đang dùng lương kế hoạch đã xác nhận. Báo cáo lợi nhuận chỉ tính chi phí thực tế đã ghi.")
        else:
            warnings.append("Chưa ghi nhận lương phát sinh tháng này; COST có thể chưa đủ chi phí.")
    if abnormal_expenses:
        warnings.append("Có chi phí bất thường được ghi nhận nhưng không phân bổ vào giá đề xuất.")
    if average_available and current_estimate > average_shared:
        warnings.append("Tổng chi phí tính giá tháng này cao hơn bình quân 3 tháng trước; hãy xem xét trước khi áp dụng giá mới.")
    return {
        "policies": policies, "costs": costs, "planned_value": planned_products_revenue,
        "planned_revenue": planned_revenue, "confirmed_revenue": confirmed_revenue,
        "direct_per_unit": direct_per_unit,
        "trip_allocations": trip_allocations,
        "start": start, "end": end, "by_category": expenses_by_category,
        "actual_shared": actual_shared, "shared_expenses": shared_expenses,
        "eligible_expenses": shared_expenses,
        "direct_expenses": direct_expenses, "abnormal_expenses": abnormal_expenses,
        "shipping": shipping, "planned_salary": planned_salary,
        "estimated_salary": estimated_salary,
        "actual_salary": actual_salary,
        "average_shared": average_shared, "average_available": average_available,
        "cost_mode": cost_mode, "warnings": warnings,
    }


def pricing_catalog(page_value=None, keyword=None, cost_mode="actual"):
    page = parse_page(page_value)
    keyword = str(keyword or "").strip()[:100]
    query = Product.query
    if keyword:
        query = query.filter(Product.name.ilike(f"%{keyword}%"))
    total = query.count()
    products = query.order_by(Product.name, Product.id).offset((page - 1) * 20).limit(20).all()
    inputs = _pricing_inputs(cost_mode or "actual", [product.id for product in products])
    salary_expenses = inputs["actual_salary"]
    return {
        "products": [_pricing_row(product, inputs["policies"].get(product.id), inputs["costs"].get(product.id), inputs["shared_expenses"], inputs["planned_revenue"], inputs["direct_per_unit"].get(product.id)) for product in products],
        "pagination": build_pagination(page, 20, total),
        "pricing_operating_expenses": float(inputs["actual_shared"] + inputs["direct_expenses"] + inputs["abnormal_expenses"]),
        "pricing_shared_expenses": float(inputs["shared_expenses"]),
        "pricing_allocated_expenses": float(inputs["eligible_expenses"]),
        "pricing_actual_shared_expenses": float(inputs["actual_shared"]),
        "pricing_direct_expenses": float(inputs["direct_expenses"]),
        "pricing_abnormal_expenses": float(inputs["abnormal_expenses"]),
        "pricing_salary_expenses": float(salary_expenses),
        "pricing_planned_salary_amount": float(inputs["planned_salary"]) if inputs["planned_salary"] is not None else None,
        "pricing_planned_revenue_amount": float(inputs["confirmed_revenue"]) if inputs["confirmed_revenue"] is not None else None,
        "pricing_estimated_salary": float(inputs["estimated_salary"]),
        "pricing_salary_confirmed": bool(salary_expenses),
        "pricing_incidental_expenses": float(inputs["actual_shared"] - salary_expenses),
        "pricing_shipping": float(inputs["shipping"]),
        "pricing_period_start": inputs["start"].isoformat(),
        "pricing_period_end": inputs["end"].isoformat(),
        "pricing_average_3m_expenses": float(inputs["average_shared"]),
        "pricing_average_3m_available": inputs["average_available"],
        "pricing_cost_mode": inputs["cost_mode"],
        "pricing_cost_warnings": inputs["warnings"],
        "pricing_planned_value": str(inputs["planned_value"]),
    }


def pricing_breakdown(product_id, cost_mode="actual"):
    product = db.session.get(Product, product_id)
    if product is None:
        raise NotFoundError("Sản phẩm không tồn tại")
    inputs = _pricing_inputs(cost_mode, [product_id])
    policy = inputs["policies"].get(product_id)
    row = _pricing_row(product, policy, inputs["costs"].get(product_id),
                       inputs["shared_expenses"], inputs["planned_revenue"],
                       inputs["direct_per_unit"].get(product_id))
    start, end = inputs["start"], inputs["end"]
    shared_start, shared_end = (start, end) if cost_mode == "actual" else (
        _shift_months(start, -3), start - timedelta(days=1))
    shared_rows = db.session.query(OperatingExpense).filter(
        OperatingExpense.invoice_id.is_(None), OperatingExpense.voided_at.is_(None),
        OperatingExpense.trip_invoice_ids.is_(None),
        OperatingExpense.is_abnormal.is_(False),
        OperatingExpense.occurred_on >= shared_start,
        OperatingExpense.occurred_on <= shared_end,
    ).order_by(OperatingExpense.occurred_on, OperatingExpense.id).all()
    shared_factor = Decimal("1") if cost_mode == "actual" else Decimal("3")
    shared = []
    if inputs["planned_revenue"] and policy and row["planned_revenue"]:
        share = money(row["planned_revenue"]) / inputs["planned_revenue"]
        for expense in shared_rows:
            allocated = money(expense.amount) * share / shared_factor
            shared.append({
                "id": expense.id, "invoice_id": None, "category": expense.category,
                "description": expense.description, "occurred_on": expense.occurred_on.isoformat(),
                "allocated_amount": float(allocated),
                "per_unit": float(allocated / policy.planned_quantity),
            })
        if inputs["estimated_salary"]:
            allocated = inputs["estimated_salary"] * share
            shared.append({"id": None, "invoice_id": None, "category": "sales_salary",
                           "description": "Lương kế hoạch đã xác nhận (chưa ghi chi phí thực tế)",
                           "occurred_on": start.isoformat(),
                           "allocated_amount": float(allocated),
                           "per_unit": float(allocated / policy.planned_quantity)})
    start_dt = datetime.combine(start, datetime.min.time())
    end_dt = datetime.combine(end + timedelta(days=1), datetime.min.time())
    gross = db.session.query(
        SalesInvoiceItem.sales_invoice_id.label("invoice_id"),
        func.sum(SalesInvoiceItem.quantity * SalesInvoiceItem.unit_price).label("amount"),
        func.sum(SalesInvoiceItem.quantity * Product.weight_per_unit).label("weight"),
        func.sum(SalesInvoiceItem.quantity * Product.volume_per_unit).label("volume"),
    ).join(SalesInvoice, SalesInvoice.id == SalesInvoiceItem.sales_invoice_id).join(
        Product, Product.id == SalesInvoiceItem.product_id,
    ).filter(
        SalesInvoice.status == InvoiceStatus.COMPLETED,
        SalesInvoice.sold_at >= start_dt, SalesInvoice.sold_at < end_dt,
    ).group_by(SalesInvoiceItem.sales_invoice_id).subquery()
    direct_rows = db.session.query(
        OperatingExpense, SalesInvoiceItem.quantity, SalesInvoiceItem.unit_price,
        gross.c.amount, gross.c.weight, gross.c.volume,
    ).join(SalesInvoice, SalesInvoice.id == OperatingExpense.invoice_id).join(
        SalesInvoiceItem, (SalesInvoiceItem.sales_invoice_id == SalesInvoice.id) &
        (SalesInvoiceItem.product_id == product_id),
    ).join(gross, gross.c.invoice_id == SalesInvoice.id).filter(
        OperatingExpense.invoice_id.isnot(None), OperatingExpense.voided_at.is_(None),
        OperatingExpense.trip_invoice_ids.is_(None),
        OperatingExpense.is_abnormal.is_(False),
        OperatingExpense.occurred_on >= start, OperatingExpense.occurred_on <= end,
        SalesInvoice.status == InvoiceStatus.COMPLETED,
        SalesInvoice.sold_at >= start_dt, SalesInvoice.sold_at < end_dt,
    ).all()
    sold_quantity = money(db.session.query(func.sum(SalesInvoiceItem.quantity)).join(
        SalesInvoice, SalesInvoice.id == SalesInvoiceItem.sales_invoice_id,
    ).filter(SalesInvoiceItem.product_id == product_id,
             SalesInvoice.status == InvoiceStatus.COMPLETED,
             SalesInvoice.sold_at >= start_dt, SalesInvoice.sold_at < end_dt).scalar())
    direct = []
    for expense, quantity, price, invoice_total, total_weight, total_volume in direct_rows:
        if not sold_quantity:
            continue
        if expense.allocation_basis == "weight":
            denominator, numerator = money(total_weight), money(quantity) * money(product.weight_per_unit)
        elif expense.allocation_basis == "volume":
            denominator, numerator = money(total_volume), money(quantity) * money(product.volume_per_unit)
        else:
            denominator, numerator = money(invoice_total), money(quantity) * money(price)
        if not denominator:
            continue
        allocated = money(expense.amount) * numerator / denominator
        direct.append({
            "id": expense.id, "invoice_id": expense.invoice_id, "category": expense.category,
            "allocation_basis": expense.allocation_basis,
            "description": expense.description, "occurred_on": expense.occurred_on.isoformat(),
            "allocated_amount": float(allocated), "per_unit": float(allocated / money(quantity)),
        })
    shipping_rows = db.session.query(
        SalesInvoice.id, SalesInvoice.shipping_fee, SalesInvoiceItem.quantity,
        SalesInvoiceItem.unit_price, gross.c.amount,
    ).join(SalesInvoiceItem, (SalesInvoiceItem.sales_invoice_id == SalesInvoice.id) &
           (SalesInvoiceItem.product_id == product_id)).join(
        gross, gross.c.invoice_id == SalesInvoice.id,
    ).filter(SalesInvoice.status == InvoiceStatus.COMPLETED,
             SalesInvoice.sold_at >= start_dt, SalesInvoice.sold_at < end_dt,
             SalesInvoice.delivery_method == "third_party",
             SalesInvoice.shipping_charged_at >= start_dt,
             SalesInvoice.shipping_charged_at < end_dt).all()
    for invoice_id, amount, quantity, price, invoice_total in shipping_rows:
        if not invoice_total or not sold_quantity:
            continue
        allocated = money(amount) * money(quantity) * money(price) / money(invoice_total)
        direct.append({"id": None, "invoice_id": invoice_id, "category": "shipping",
                       "description": "Phí giao hàng bên thứ ba", "occurred_on": None,
                       "allocated_amount": float(allocated), "per_unit": float(allocated / money(quantity))})
    for expense, pid, amount, quantity, _ in inputs["trip_allocations"]:
        direct.append({"id": expense.id, "invoice_id": None,
                       "trip_invoice_ids": expense.trip_invoice_ids,
                       "category": expense.category, "allocation_basis": expense.allocation_basis,
                       "description": expense.description, "occurred_on": expense.occurred_on.isoformat(),
                       "allocated_amount": float(amount), "per_unit": float(amount / quantity)})
    direct_per_unit = money(row["direct_expense_per_unit"])
    direct_total = sum((money(item["allocated_amount"]) for item in direct), Decimal("0"))
    if direct_per_unit > 0 and direct_total > 0:
        cost_bearing_quantity = direct_total / direct_per_unit
        for item in direct:
            item["per_unit"] = float(money(item["allocated_amount"]) / cost_bearing_quantity)
    return {"product": row, "shared": shared, "direct": direct}


def save_pricing_policy(employee_id, product_id, payload):
    product = db.session.get(Product, product_id)
    if not product:
        raise NotFoundError("Sản phẩm không tồn tại")
    policy = db.session.get(PricingPolicy, product_id)
    try:
        markup = Decimal(str(payload["markup_percent"]))
    except (KeyError, TypeError, ValueError, InvalidOperation):
        raise ValidationError("Tỷ lệ lãi trên COST không hợp lệ")
    planned_quantity = positive_quantity(
        payload.get("planned_quantity", policy.planned_quantity if policy else None),
        "Sản lượng dự kiến",
    )
    if not markup.is_finite() or markup < 0 or markup >= 100 or markup.as_tuple().exponent < -2:
        raise ValidationError("Tỷ lệ lãi trên COST phải từ 0% đến dưới 100%, tối đa 2 chữ số thập phân")
    try:
        reference_price = Decimal(str(payload.get(
            "reference_price", policy.reference_price if policy and policy.reference_price is not None
            else product.default_sale_price,
        )))
        rounding_step = int(payload.get("rounding_step", policy.rounding_step if policy else 1000))
    except (TypeError, ValueError, InvalidOperation):
        raise ValidationError("Giá tham chiếu hoặc bước làm tròn không hợp lệ")
    if not reference_price.is_finite() or reference_price <= 0 or reference_price > Decimal("999999999999.99") or reference_price.as_tuple().exponent < -2:
        raise ValidationError("Giá tham chiếu phải lớn hơn 0 và có tối đa 2 chữ số thập phân")
    if rounding_step not in (1, 10, 100, 1000, 10000):
        raise ValidationError("Bước làm tròn không hợp lệ")
    if policy is None:
        policy = PricingPolicy(product_id=product_id, updated_by_id=employee_id)
        db.session.add(policy)
    policy.markup_percent = markup
    policy.desired_profit_per_unit = None
    policy.planned_quantity = planned_quantity
    policy.reference_price = reference_price
    policy.rounding_step = rounding_step
    policy.updated_by_id = employee_id
    policy.updated_at = vietnam_payment_time()
    db.session.commit()
    return {"product_id": product_id, "markup_percent": float(policy.markup_percent),
            "planned_quantity": str(policy.planned_quantity),
            "reference_price": float(reference_price), "rounding_step": rounding_step,
            "desired_profit_per_unit": float(policy.desired_profit_per_unit) if policy.desired_profit_per_unit is not None else None}


def apply_suggested_price(product_id, expected_price, expected_suggested_price, cost_mode="actual"):
    product = db.session.get(Product, product_id)
    if not product:
        raise NotFoundError("Sản phẩm không tồn tại")
    try:
        expected = Decimal(str(expected_price))
    except (TypeError, ValueError, InvalidOperation):
        raise ValidationError("Giá hiện tại không hợp lệ")
    if expected != money(product.default_sale_price):
        raise ValidationError("Giá sản phẩm đã thay đổi; hãy tải lại đề xuất", status_code=409)
    inputs = _pricing_inputs(cost_mode or "actual", [product_id])
    unit_cost = inputs["costs"].get(product_id)
    if unit_cost is None:
        raise ValidationError("Chưa có giá nhập để đề xuất giá bán")
    proposal = _pricing_row(product, inputs["policies"].get(product_id), unit_cost, inputs["shared_expenses"], inputs["planned_revenue"], inputs["direct_per_unit"].get(product_id))
    if proposal["suggested_price"] is None:
        raise ValidationError("Chưa đủ kế hoạch doanh thu, sản lượng hoặc giá tham chiếu để áp dụng giá")
    if proposal["legacy_fixed_profit"]:
        raise ValidationError("Hãy lưu tỷ lệ lãi trên COST cho kế hoạch giá cũ trước khi áp dụng", status_code=409)
    try:
        expected_suggestion = int(expected_suggested_price)
    except (TypeError, ValueError):
        raise ValidationError("Giá đề xuất cần được tải lại")
    if expected_suggestion != proposal["suggested_price"]:
        raise ValidationError("Giá nhập, chi phí hoặc kế hoạch giá đã thay đổi; hãy tải lại giá đề xuất", status_code=409)
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
    shared_scope = OperatingExpense.invoice_id.is_(None) & OperatingExpense.trip_invoice_ids.is_(None)
    scope_rows = db.session.query(shared_scope, func.sum(OperatingExpense.amount)).filter(
        OperatingExpense.voided_at.is_(None),
        OperatingExpense.occurred_on >= start, OperatingExpense.occurred_on <= end,
    ).group_by(shared_scope).all()
    shared_pool = sum((money(amount) for is_shared, amount in scope_rows if is_shared), Decimal("0"))
    direct_pool = expense_total - shared_pool
    invoice_totals = db.session.query(
        SalesInvoiceItem.sales_invoice_id.label("invoice_id"),
        func.sum(SalesInvoiceItem.quantity * SalesInvoiceItem.unit_price).label("gross"),
        func.sum(SalesInvoiceItem.quantity * Product.weight_per_unit).label("weight"),
        func.sum(SalesInvoiceItem.quantity * Product.volume_per_unit).label("volume"),
    ).join(SalesInvoice, SalesInvoiceItem.sales_invoice_id == SalesInvoice.id).filter(
        SalesInvoice.status == InvoiceStatus.COMPLETED,
        SalesInvoice.sold_at >= from_dt, SalesInvoice.sold_at < until_dt,
    ).join(Product, Product.id == SalesInvoiceItem.product_id).group_by(SalesInvoiceItem.sales_invoice_id).subquery()
    line_gross = SalesInvoiceItem.quantity * SalesInvoiceItem.unit_price
    share = line_gross / func.nullif(invoice_totals.c.gross, 0)
    sales = db.session.query(
        SalesInvoiceItem.product_id,
        func.sum(SalesInvoiceItem.quantity),
        func.sum(line_gross - SalesInvoice.discount_amount * share),
        func.sum(case(
            (
                (SalesInvoice.delivery_method == "third_party") &
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
    snapshot_rows = db.session.query(
        SalesInvoiceItem.product_id,
        func.sum(case((SalesInvoiceItem.landed_unit_cost.isnot(None),
                       SalesInvoiceItem.quantity * SalesInvoiceItem.landed_unit_cost), else_=0)),
        func.sum(case((SalesInvoiceItem.landed_unit_cost.is_(None),
                       SalesInvoiceItem.quantity), else_=0)),
    ).join(SalesInvoice, SalesInvoice.id == SalesInvoiceItem.sales_invoice_id).filter(
        SalesInvoice.status == InvoiceStatus.COMPLETED,
        SalesInvoice.sold_at >= from_dt, SalesInvoice.sold_at < until_dt,
    ).group_by(SalesInvoiceItem.product_id).all()
    snapshots = {pid: (money(amount), money(missing_qty))
                 for pid, amount, missing_qty in snapshot_rows}
    fallback_ids = [pid for pid, (_, missing_qty) in snapshots.items() if missing_qty]
    fallback_costs = _purchase_costs(fallback_ids, end=until_dt)
    direct_share = case(
        (OperatingExpense.allocation_basis == "weight",
         SalesInvoiceItem.quantity * Product.weight_per_unit / func.nullif(invoice_totals.c.weight, 0)),
        (OperatingExpense.allocation_basis == "volume",
         SalesInvoiceItem.quantity * Product.volume_per_unit / func.nullif(invoice_totals.c.volume, 0)),
        else_=share,
    )
    direct = db.session.query(
        SalesInvoiceItem.product_id,
        func.sum(OperatingExpense.amount * direct_share),
    ).join(SalesInvoice, OperatingExpense.invoice_id == SalesInvoice.id).join(
        SalesInvoiceItem, SalesInvoiceItem.sales_invoice_id == SalesInvoice.id,
    ).join(Product, Product.id == SalesInvoiceItem.product_id,
    ).join(invoice_totals, invoice_totals.c.invoice_id == SalesInvoice.id).filter(
        OperatingExpense.voided_at.is_(None),
        OperatingExpense.invoice_id.isnot(None),
        OperatingExpense.trip_invoice_ids.is_(None),
        OperatingExpense.occurred_on >= start, OperatingExpense.occurred_on <= end,
        SalesInvoice.status == InvoiceStatus.COMPLETED,
        SalesInvoice.sold_at >= from_dt, SalesInvoice.sold_at < until_dt,
    ).group_by(SalesInvoiceItem.product_id).all()
    direct_by_product = {pid: money(amount) for pid, amount in direct}
    for _, pid, amount, _, _ in _trip_allocations(start, end, period_sales_only=True):
        direct_by_product[pid] = direct_by_product.get(pid, Decimal("0")) + amount
    direct_total = sum(direct_by_product.values(), Decimal("0"))
    unallocated_direct = direct_pool - direct_total
    shared_total = shared_pool
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
        product_shipping = money(shipping)
        allocated = direct_by_product.get(pid, Decimal("0")) + shared
        recorded_amount, missing_qty = snapshots.get(pid, (Decimal("0"), money(quantity)))
        estimated_cogs = (
            rounded(recorded_amount + fallback_costs[pid] * missing_qty)
            if missing_qty and pid in fallback_costs else
            rounded(recorded_amount) if not missing_qty else None
        )
        cogs_status = "estimated" if missing_qty and estimated_cogs is not None else (
            "missing" if estimated_cogs is None else "recorded")
        profit = rounded(net - product_shipping - allocated - estimated_cogs) if estimated_cogs is not None else None
        rows.append({
            "product_id": pid, "name": names[pid].name, "unit": names[pid].unit,
            "quantity": float(quantity), "net_revenue": float(rounded(net)),
            "estimated_cogs": float(estimated_cogs) if estimated_cogs is not None else None,
            "cogs_status": cogs_status,
            "shipping_cost": float(rounded(product_shipping)),
            "operating_expenses": float(rounded(allocated)),
            "estimated_operating_profit": float(profit) if profit is not None else None,
        })
    rows.sort(key=lambda row: -row["net_revenue"])
    known_cogs = sum((money(row["estimated_cogs"]) for row in rows if row["estimated_cogs"] is not None), Decimal("0"))
    known_profit = revenue_total - known_cogs - expense_total - all_shipping
    all_recorded = all(row["cogs_status"] == "recorded" for row in rows)
    return {
        "period": {"from": start.isoformat(), "to": end.isoformat()},
        "revenue": float(rounded(revenue_total)), "expenses": float(rounded(expense_total)),
        "expenses_by_category": {key: float(value) for key, value in by_category.items()},
        "external_shipping": float(all_shipping),
        "estimated_cogs": float(sum((money(row["estimated_cogs"]) for row in rows if row["estimated_cogs"] is not None), Decimal("0"))),
        "estimated_operating_profit": float(rounded(known_profit)) if all(row["estimated_cogs"] is not None for row in rows) else None,
        "operating_profit": float(rounded(known_profit)) if all_recorded else None,
        "cogs_status": "recorded" if all_recorded else (
            "missing" if any(row["cogs_status"] == "missing" for row in rows) else "estimated"),
        "missing_cost_products": sum(row["estimated_cogs"] is None for row in rows),
        "unallocated_expenses": float(rounded((shared_total if not revenue_total else Decimal("0")) +
                                               unallocated_direct + remaining_shipping)),
        "products": rows[(page - 1) * 20:page * 20],
        "product_pagination": build_pagination(page, 20, len(rows)),
    }
