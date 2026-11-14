import math
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal, InvalidOperation, ROUND_CEILING, ROUND_FLOOR, ROUND_HALF_UP
from sqlalchemy import and_, case, func, or_
from sqlalchemy.orm import joinedload, selectinload
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from web import dao, db
from web.models import (
    Customer,
    CustomerPayment,
    DiscountStatus,
    Employee,
    EmployeeRole,
    FundEntryType,
    EmployeeStock,
    InvoiceStatus,
    PaymentMethod,
    PaymentStatus,
    PaymentType,
    Product,
    ProductCombo,
    SaleSource,
    SalesInvoice,
    SalesInvoiceItem,
    SalesInvoiceWorkflowEvent,
    Warehouse,
    vietnam_payment_time,
)
from web.services.exceptions import AppError, ForbiddenError, NotFoundError, ValidationError
from web.services.company_fund_service import record_fund_movement
from web.services.authorization import (
    ensure_bounded_items,
    ensure_warehouse_access,
    get_central_warehouse,
    require_accountant,
)
from web.services.validators import MIN_MONEY_AMOUNT, require_text, validate_money_amount, validate_phone, validate_positive_number
from web.services.payment_service import parse_payment_method
from web.services.unit_conversion import positive_quantity, to_base_quantity
from web.services.sales_area_service import resolve_sales_area_id
from web.services.promotion_service import (
    append_approval_note,
    approval_notes_from_note,
    build_promotion_note,
    get_promotion_for_invoice,
    promotion_snapshot_from_note,
)


ACTIVE_CANCEL_REQUEST_STATUSES = frozenset(
    {InvoiceStatus.PROCESSING, InvoiceStatus.DELIVERING}
)


def workflow_stage(invoice):
    if invoice.status == InvoiceStatus.DRAFT and invoice.warehouse_submitted_at:
        return "chờ kho"
    if invoice.status == InvoiceStatus.DELIVERING and invoice.accounting_handoff_at:
        return "chờ kế toán"
    return invoice.status.value


def _log_workflow_event(invoice, actor_id, action, detail=None, recipient_id=None):
    db.session.add(SalesInvoiceWorkflowEvent(
        sales_invoice_id=invoice.id, actor_id=actor_id,
        action=action, detail=detail, recipient_id=recipient_id,
        occurred_at=vietnam_payment_time(),
    ))


def _eligible_assignees(stage, warehouse_id):
    roles = {
        "warehouse": (EmployeeRole.THU_KHO, EmployeeRole.QUAN_LY),
        "accounting": (EmployeeRole.KE_TOAN,),
    }
    if stage not in roles:
        raise ValidationError("Công đoạn phân công không hợp lệ")
    query = Employee.query.filter(
        Employee.role.in_(roles[stage]),
        Employee.is_approved.is_(True),
        Employee.is_locked.is_(False),
    )
    if stage == "warehouse":
        query = query.filter(or_(
            Employee.warehouse_id == warehouse_id,
            Employee.warehouse_id.is_(None),
            Employee.role == EmployeeRole.QUAN_LY,
        ))
    return query.order_by(Employee.full_name.asc(), Employee.id.asc()).all()


def list_sales_invoice_assignees_service(stage, warehouse_id):
    staff = _eligible_assignees(stage, warehouse_id)
    active = dict(db.session.query(
        SalesInvoice.current_assignee_id, func.count(SalesInvoice.id),
    ).filter(
        SalesInvoice.current_assignee_id.in_([person.id for person in staff]),
        SalesInvoice.assignment_stage == stage,
        SalesInvoice.status.in_((InvoiceStatus.DRAFT, InvoiceStatus.PROCESSING, InvoiceStatus.DELIVERING)),
    ).group_by(SalesInvoice.current_assignee_id).all()) if staff else {}
    return [{"id": person.id, "full_name": person.full_name,
             "role": person.role.value, "active_count": int(active.get(person.id, 0))}
            for person in sorted(staff, key=lambda person: (
                person.role == EmployeeRole.QUAN_LY, active.get(person.id, 0), person.full_name, person.id,
            ))]


def _assign_invoice(invoice, actor_id, recipient_id, stage):
    if recipient_id is None:
        raise ValidationError("Vui lòng chọn người nhận xử lý")
    try:
        recipient_id = int(recipient_id)
    except (TypeError, ValueError):
        raise ValidationError("Người nhận xử lý không hợp lệ")
    eligible = {person.id: person for person in _eligible_assignees(stage, invoice.warehouse_id)}
    recipient = eligible.get(recipient_id)
    if not recipient:
        raise ValidationError("Người nhận không còn hoạt động hoặc không phụ trách kho này")
    previous_id = invoice.current_assignee_id
    invoice.current_assignee_id = recipient.id
    invoice.assignment_stage = stage
    invoice.assigned_at = vietnam_payment_time()
    invoice.accepted_at = None
    _log_workflow_event(invoice, actor_id, "assigned", f"{stage}: {previous_id or '-'} -> {recipient.id}", recipient.id)


def _require_assignee(invoice, employee_id, stage, accepted=False):
    if invoice.assignment_stage != stage or invoice.current_assignee_id != employee_id:
        raise ForbiddenError("Đơn chưa được phân công cho bạn ở công đoạn này")
    if accepted and not invoice.accepted_at:
        raise ValidationError("Bạn cần nhận đơn trước khi xử lý")


def _notify_invoice_changed(invoice_id):
    # The notification is sent only after commit; clients refetch from MySQL.
    from web.realtime import notify_invoice_changed
    notify_invoice_changed(invoice_id)


def get_sales_invoice_action_count_service(employee_id, employee_role):
    """Count actionable orders for one role without loading invoice rows."""
    role = EmployeeRole(employee_role)
    active_cancel = and_(
        SalesInvoice.cancel_requested.is_(True),
        SalesInvoice.status.in_(ACTIVE_CANCEL_REQUEST_STATUSES),
    )
    draft_to_send = and_(
        SalesInvoice.status == InvoiceStatus.DRAFT,
        SalesInvoice.warehouse_submitted_at.is_(None),
    )
    waiting_warehouse = and_(
        SalesInvoice.status == InvoiceStatus.DRAFT,
        SalesInvoice.warehouse_submitted_at.isnot(None),
    )
    processing = SalesInvoice.status == InvoiceStatus.PROCESSING
    delivering = SalesInvoice.status == InvoiceStatus.DELIVERING
    if role == EmployeeRole.NHAN_VIEN_BAN_HANG:
        condition = and_(
            SalesInvoice.employee_id == employee_id,
            SalesInvoice.cancel_requested.is_(False),
            draft_to_send,
        )
    elif role == EmployeeRole.THU_KHO:
        condition = and_(
            SalesInvoice.cancel_requested.is_(False),
            SalesInvoice.current_assignee_id == employee_id,
            SalesInvoice.assignment_stage == "warehouse",
            or_(
                waiting_warehouse,
                and_(processing, or_(
                    SalesInvoice.delivery_method.is_(None),
                    SalesInvoice.delivery_method != "third_party",
                )),
            ),
        )
    elif role == EmployeeRole.KE_TOAN:
        condition = or_(
            active_cancel,
            and_(
                SalesInvoice.cancel_requested.is_(False), delivering,
                SalesInvoice.accounting_handoff_at.isnot(None),
                SalesInvoice.current_assignee_id == employee_id,
                SalesInvoice.assignment_stage == "accounting",
                SalesInvoice.discount_status.notin_({
                    DiscountStatus.PENDING_APPROVAL, DiscountStatus.REJECTED,
                }),
            ),
        )
    else:
        condition = or_(
            active_cancel,
            SalesInvoice.status == InvoiceStatus.DRAFT,
            and_(SalesInvoice.cancel_requested.is_(False), processing),
            and_(
                SalesInvoice.cancel_requested.is_(False), delivering,
                SalesInvoice.current_assignee_id == employee_id,
                SalesInvoice.assignment_stage == "delivery",
            ),
            and_(
                SalesInvoice.discount_status == DiscountStatus.PENDING_APPROVAL,
                SalesInvoice.employee_id != employee_id,
            ),
        )
    return int(db.session.query(func.count(SalesInvoice.id)).filter(condition).scalar() or 0)


PAYMENT_DUE_SOON_DAYS = 7
SALE_PRICE_TOLERANCE = Decimal("0.10")
try:
    BUSINESS_TIMEZONE = ZoneInfo("Asia/Bangkok")
except ZoneInfoNotFoundError:
    # Windows may not provide an IANA timezone database in a fresh venv.
    # Bangkok uses UTC+7 without daylight saving time for business dates.
    BUSINESS_TIMEZONE = timezone(timedelta(hours=7))


def business_today():
    return datetime.now(BUSINESS_TIMEZONE).date()


def parse_payment_due_date(value, required=False, allow_past=False):
    if value in (None, ""):
        if required:
            raise ValidationError("Vui lòng chọn hạn thanh toán cho khoản công nợ")
        return None
    try:
        due_date = date.fromisoformat(str(value).strip())
    except (TypeError, ValueError):
        raise ValidationError("Hạn thanh toán không hợp lệ. Định dạng đúng: YYYY-MM-DD")
    if not allow_past and due_date < business_today():
        raise ValidationError("Hạn thanh toán không được nhỏ hơn ngày hiện tại")
    return due_date


def get_payment_due_info(invoice, remaining_amount):
    due_date = invoice.payment_due_date
    is_open_debt = (
        invoice.status == InvoiceStatus.COMPLETED
        and Decimal(str(remaining_amount or 0)) > 0
    )
    if not is_open_debt or not due_date:
        return {
            "status": "paid" if Decimal(str(remaining_amount or 0)) <= 0 else "not_set",
            "days_until_due": None,
            "days_overdue": 0,
        }

    delta = (due_date - business_today()).days
    if delta < 0:
        status = "overdue"
    elif delta == 0:
        status = "due_today"
    elif delta <= PAYMENT_DUE_SOON_DAYS:
        status = "due_soon"
    else:
        status = "not_due"
    return {
        "status": status,
        "days_until_due": max(0, delta),
        "days_overdue": max(0, -delta),
    }


def has_active_cancel_request(invoice):
    return bool(
        invoice.cancel_requested
        and invoice.status in ACTIVE_CANCEL_REQUEST_STATUSES
    )


def validate_positive_quantity(value, field_name):
    if isinstance(value, bool):
        raise ValidationError(f"{field_name} không hợp lệ")
    return positive_quantity(value, field_name)


def validate_positive_integer(value, field_name):
                                  
    try:
        num = int(value)
        if num <= 0:
            raise ValidationError(f"{field_name} phải lớn hơn 0")
        return num
    except (ValueError, TypeError):
        raise ValidationError(f"{field_name} không hợp lệ")


def validate_money(value, field_name, allow_zero=True):
    return validate_money_amount(value, field_name, allow_zero=allow_zero)


def resolve_sales_warehouse(warehouse_id):
    if warehouse_id in (None, ""):
        warehouse = get_central_warehouse()
    else:
        warehouse_id = validate_positive_integer(warehouse_id, "Mã kho")
        warehouse = Warehouse.query.get(warehouse_id)

    if not warehouse:
        raise NotFoundError("Kho không tồn tại")
    return warehouse.id, warehouse


def calculate_total_amount(items):
                                          
    total = Decimal("0.00")
    for item in items:
        total += Decimal(str(item.get("quantity", 0))) * Decimal(str(item.get("unit_price", 0)))
    return total


def _snapshot_sale_costs(invoice):
    """Freeze the landed purchase estimate used when this sale is completed."""
    from web.services.pricing_service import _purchase_costs
    product_ids = [item.product_id for item in invoice.items]
    costs = _purchase_costs(product_ids, end=invoice.sold_at + timedelta(microseconds=1))
    for item in invoice.items:
        item.landed_unit_cost = costs.get(item.product_id)


def _validate_sales_items(items):
    ensure_bounded_items(items, "Sản phẩm trong đơn hàng")
    if not isinstance(items, list) or not items:
        raise ValidationError("Đơn hàng phải có ít nhất 1 sản phẩm")

    normalized = []
    product_ids = []
    seen_product_ids = set()
    for index, item in enumerate(items, start=1):
        if not isinstance(item, dict):
            raise ValidationError(f"Sản phẩm (item {index}) không hợp lệ")
        product_id = validate_positive_integer(
            item.get("product_id"),
            f"Mã sản phẩm (item {index})",
        )
        if product_id in seen_product_ids:
            raise ValidationError(f"Sản phẩm ID {product_id} bị lặp trong đơn hàng")
        seen_product_ids.add(product_id)
        product_ids.append(product_id)
        combo_id = item.get("combo_id")
        if combo_id not in (None, ""):
            combo_id = validate_positive_integer(combo_id, f"Mã combo (item {index})")
        else:
            combo_id = None
        normalized.append({
            "product_id": product_id,
            "quantity": item.get("quantity"),
            "entered_unit": item.get("unit"),
            "unit_price": validate_money_amount(
                item.get("unit_price"),
                f"Đơn giá (item {index})",
                allow_zero=combo_id is not None,
                minimum=None if combo_id is not None else MIN_MONEY_AMOUNT,
            ),
            "combo_id": combo_id,
        })

    products = Product.query.filter(Product.id.in_(product_ids)).all()
    products_by_id = {product.id: product for product in products}
    missing_product_ids = [product_id for product_id in product_ids if product_id not in products_by_id]
    if missing_product_ids:
        raise NotFoundError(f"Sản phẩm ID {missing_product_ids[0]} không tồn tại")
    for item in normalized:
        product = products_by_id[item["product_id"]]
        base_quantity, entered_unit, entered_quantity = to_base_quantity(
            product, item["quantity"], item["entered_unit"],
        )
        if item["combo_id"] is not None and entered_unit != product.unit:
            raise ValidationError("Thành phần combo phải nhập theo đơn vị cơ sở")
        item["quantity"] = base_quantity
        item["entered_unit"] = entered_unit
        item["entered_quantity"] = entered_quantity

    combo_groups = {}
    for item in normalized:
        if item["combo_id"] is not None:
            combo_groups.setdefault(item["combo_id"], []).append(item)
    if combo_groups:
        combos = ProductCombo.query.options(selectinload(ProductCombo.items)).filter(
            ProductCombo.id.in_(combo_groups)
        ).all()
        combos_by_id = {combo.id: combo for combo in combos}
        for combo_id, group in combo_groups.items():
            combo = combos_by_id.get(combo_id)
            if combo is None:
                raise ValidationError(f"Combo ID {combo_id} không còn tồn tại")
            configured = {part.product_id: part.quantity for part in combo.items}
            submitted = {part["product_id"]: part["quantity"] for part in group}
            if configured.keys() != submitted.keys():
                raise ValidationError(f"Thành phần combo '{combo.name}' không hợp lệ")
            if any(submitted[product_id] % quantity for product_id, quantity in configured.items()):
                raise ValidationError(f"Số lượng combo '{combo.name}' không hợp lệ")
            set_counts = {
                submitted[product_id] // quantity for product_id, quantity in configured.items()
            }
            if len(set_counts) != 1 or 0 in set_counts:
                raise ValidationError(f"Số lượng combo '{combo.name}' không hợp lệ")
            if sum(part["unit_price"] * part["quantity"] for part in group) <= 0:
                raise ValidationError(f"Giá combo '{combo.name}' phải lớn hơn 0")
            if any(part["unit_price"] > Decimal("999999999999.99") for part in group):
                raise ValidationError(f"Giá combo '{combo.name}' vượt quá giới hạn lưu trữ")

    for item in normalized:
        product = products_by_id[item["product_id"]]
        default_price = Decimal(str(product.default_sale_price or 0))
        if default_price < MIN_MONEY_AMOUNT:
            raise ValidationError(
                f"Sản phẩm '{product.name}' chưa có giá bán mặc định hợp lệ (từ 500 đ). "
                "Vui lòng cập nhật giá sản phẩm trước khi bán."
            )
        if item["combo_id"] is not None:
            continue
        minimum = max(MIN_MONEY_AMOUNT, default_price * (1 - SALE_PRICE_TOLERANCE))
        maximum = default_price * (1 + SALE_PRICE_TOLERANCE)
        if not minimum <= item["unit_price"] <= maximum:
            minimum_display = int(minimum.to_integral_value(rounding=ROUND_CEILING))
            maximum_display = int(maximum.to_integral_value(rounding=ROUND_FLOOR))
            minimum_text = f"{minimum_display:,}".replace(",", ".")
            maximum_text = f"{maximum_display:,}".replace(",", ".")
            raise ValidationError(
                f"Giá bán '{product.name}' phải từ "
                f"{minimum_text} đến {maximum_text} đ "
                "(±10% giá bán mặc định)."
            )

    return normalized


def _validate_saved_sales_items(items):
    """Validate saved amounts without re-pricing an agreed order at completion."""
    combo_totals = {}
    for index, item in enumerate(items, start=1):
        quantity = validate_positive_quantity(item.quantity, f"Số lượng (item {index})")
        price = validate_money_amount(
            item.unit_price,
            f"Đơn giá (item {index})",
            allow_zero=item.combo_id is not None,
            minimum=None if item.combo_id is not None else MIN_MONEY_AMOUNT,
        )
        if item.combo_id is not None:
            combo_totals[item.combo_id] = combo_totals.get(item.combo_id, Decimal("0")) + price * quantity
    if any(total <= 0 for total in combo_totals.values()):
        raise ValidationError("Giá combo đã lưu phải lớn hơn 0")


def _validate_items_available_in_warehouse(items, warehouse_id, exclude_invoice_id=None):
    """Ensure a draft order can be fulfilled with the warehouse's current stock.

    Draft sales invoices do not deduct inventory, but editing one should not
    allow a quantity that is already greater than the stock available for the
    selected warehouse.  The final completion step still validates again to
    protect against stock changes after this check.
    """
    product_ids = [item["product_id"] for item in items]
    stock_by_product = dao.calculate_available_stock_for_items_at_warehouse(
        product_ids,
        warehouse_id,
        exclude_invoice_id=exclude_invoice_id,
    )
    products_by_id = {
        product.id: product
        for product in Product.query.filter(Product.id.in_(product_ids)).all()
    }

    for item in items:
        available_stock = max(
            0,
            float(stock_by_product.get(item["product_id"], {}).get("available_stock", 0)),
        )
        if available_stock < item["quantity"]:
            product = products_by_id.get(item["product_id"])
            product_name = product.name if product else f"ID {item['product_id']}"
            raise ValidationError(
                f"Sản phẩm '{product_name}' chỉ còn {available_stock} trong kho, "
                f"không thể lưu {item['quantity']}."
            )


def determine_discount_status(total_amount, discount_amount, is_promotion=False):
       
    MIN_ORDER_AMOUNT = 5_000_000           
    AUTO_APPROVE_THRESHOLD = 20_000       
    MIN_DISCOUNT = 1_000      
    
    if discount_amount == 0:
        return DiscountStatus.NO_DISCOUNT

    if discount_amount > total_amount:
        raise ValidationError("Số tiền giảm giá không được vượt quá tổng tiền đơn")

    # Promotions are configured and authorized by a manager in advance, so
    # applying an eligible program must not create a second approval step.
    if is_promotion:
        return DiscountStatus.AUTO_APPROVED
    
                                       
    if not is_promotion and total_amount < MIN_ORDER_AMOUNT:
        raise ValidationError(
            f"Đơn hàng phải từ {MIN_ORDER_AMOUNT:,.0f} VNĐ trở lên mới được giảm giá. "
            f"Tổng tiền hiện tại: {total_amount:,.0f} VNĐ"
        )
    
                                 
    if not is_promotion and discount_amount < MIN_DISCOUNT:
        raise ValidationError(f"Giảm giá tối thiểu là {MIN_DISCOUNT:,.0f} VNĐ")
    
                         
    if discount_amount <= AUTO_APPROVE_THRESHOLD:
        return DiscountStatus.AUTO_APPROVED
    else:
        return DiscountStatus.PENDING_APPROVAL


def parse_sale_source(value):
    if value in (None, ""):
        return SaleSource.CENTRAL_WAREHOUSE
    text = str(value).strip().lower()
    source_map = {
        "kho trung tâm": SaleSource.CENTRAL_WAREHOUSE,
        "central_warehouse": SaleSource.CENTRAL_WAREHOUSE,
        "warehouse": SaleSource.CENTRAL_WAREHOUSE,
        "hàng nhân viên": SaleSource.EMPLOYEE_STOCK,
        "employee_stock": SaleSource.EMPLOYEE_STOCK,
        "field_stock": SaleSource.EMPLOYEE_STOCK,
    }
    source = source_map.get(text)
    if not source:
        raise ValidationError("Nguồn hàng không hợp lệ")
    return source


def get_payment_status(paid_amount, final_amount):
    if final_amount <= 0:
        return PaymentStatus.PAID
    if paid_amount <= 0:
        return PaymentStatus.UNPAID
    if paid_amount >= final_amount:
        return PaymentStatus.PAID
    return PaymentStatus.PARTIAL


def _consume_employee_stock(employee_id, items):
    product_ids = [item["product_id"] for item in items]
    stocks = dao.get_employee_stock_map(employee_id, product_ids=product_ids, for_update=True)
    product_names = {
        product.id: product.name
        for product in Product.query.filter(Product.id.in_(product_ids)).all()
    }
    for item in items:
        stock = stocks.get(item["product_id"])
        available = float(stock.quantity) if stock else 0
        if available < item["quantity"]:
            raise ValidationError(
                f"Sản phẩm '{product_names[item['product_id']]}' trong tồn của nhân viên không đủ."
            )
    for item in items:
        stocks[item["product_id"]].quantity = (
            Decimal(str(stocks[item["product_id"]].quantity)) - item["quantity"]
        )


def _normalize_invoice_tender(tendered_amount, payment_method, amount_due):
    """Return the amount credited to the invoice and any cash change."""
    tendered = validate_money(tendered_amount, "Số tiền khách đưa")
    amount_due = Decimal(str(amount_due))
    method = parse_payment_method(payment_method, required=tendered > 0)
    if tendered > amount_due:
        if amount_due <= 0:
            raise ValidationError("Đơn hàng đã thanh toán đủ")
        if method != PaymentMethod.CASH:
            raise ValidationError("Số tiền chuyển khoản không được vượt quá số tiền còn phải thu")
        return amount_due, tendered - amount_due, method
    return tendered, Decimal("0"), method


def _format_vnd(amount):
    whole, cents = f"{amount:.2f}".split(".")
    formatted = f"{int(whole):,}".replace(",", ".")
    return f"{formatted}{',' + cents if cents != '00' else ''} đ"


def _apply_invoice_payment(invoice, employee_id, payment_amount, final_amount, payment_method=None, cash_received=None):
    is_cash_change = cash_received is not None and cash_received > payment_amount
    payment_amount = validate_money_amount(
        payment_amount, "Số tiền khách thanh toán",
        minimum=None if is_cash_change else MIN_MONEY_AMOUNT,
    )
    if payment_amount > 0:
        require_accountant(employee_id)
    already_paid = Decimal(str(invoice.paid_amount or 0))
    if already_paid > 0:
        raise ValidationError(
            "Đơn đã có thanh toán trước đó; hãy ghi nhận phần còn lại qua công nợ khách hàng"
        )
    remaining_before_payment = final_amount - already_paid
    if payment_amount > remaining_before_payment:
        raise ValidationError("Số tiền thanh toán vượt quá số tiền còn lại của đơn")

    payment_method = parse_payment_method(payment_method, required=payment_amount > 0)
    customer = (
        Customer.query
        .filter(Customer.id == invoice.customer_id)
        .with_for_update()
        .first()
    )
    if not customer:
        raise NotFoundError("Khách hàng không tồn tại")

    total_paid = already_paid + payment_amount
    remaining_amount = final_amount - total_paid
    if remaining_amount > 0:
        customer.debt_amount = Decimal(str(customer.debt_amount)) + remaining_amount

    invoice.paid_amount = total_paid
    invoice.payment_status = get_payment_status(total_paid, final_amount)
    if payment_amount > 0:
        payment_note = "Thanh toán khi hoàn thành đơn hàng"
        if cash_received is not None and cash_received > payment_amount:
            change_amount = cash_received - payment_amount
            payment_note = (
                f"Khách đưa {_format_vnd(cash_received)}; "
                f"tiền thối lại {_format_vnd(change_amount)}"
            )
        payment = CustomerPayment(
                customer_id=customer.id,
                sales_invoice_id=invoice.id,
                employee_id=employee_id,
                amount=payment_amount,
                payment_type=PaymentType.INVOICE,
                payment_method=payment_method,
                note=payment_note,
        )
        db.session.add(payment)
        db.session.flush()
        record_fund_movement(
            payment.payment_method, "in", payment.amount,
            "customer_receipt", payment.id, employee_id,
            f"Thu tiền đơn bán #{invoice.id}", payment.note,
        )
    return remaining_amount


def serialize_sales_invoice_payment(payment):
    return {
        "id": payment.id,
        "amount": float(payment.amount),
        "payment_type": payment.payment_type.value,
        "payment_method": payment.payment_method.value if payment.payment_method else None,
        "paid_at": payment.paid_at.isoformat() if payment.paid_at else None,
        "note": payment.note,
        "confirmed_by": {
            "id": payment.collected_by_employee.id,
            "full_name": payment.collected_by_employee.full_name,
        } if payment.collected_by_employee else None,
    }


def serialize_sales_invoice(invoice):
                                                      
    items_data = []
    total_amount = 0

    combo_ids = {item.combo_id for item in invoice.items if item.combo_id is not None}
    combos_by_id = {
        combo.id: combo for combo in ProductCombo.query.options(selectinload(ProductCombo.items)).filter(
            ProductCombo.id.in_(combo_ids)
        ).all()
    } if combo_ids else {}

    for item in invoice.items:
        item_total = float(item.quantity) * float(item.unit_price)
        total_amount += item_total

        items_data.append({
            "id": item.id,
            "product_id": item.product_id,
            "combo_id": item.combo_id,
            "combo_name": combos_by_id[item.combo_id].name if item.combo_id in combos_by_id else None,
            "combo_item_quantity": next(
                (part.quantity for part in combos_by_id[item.combo_id].items if part.product_id == item.product_id),
                None,
            ) if item.combo_id in combos_by_id else None,
            "product_name": item.product.name,
            "unit": item.product.unit,
            "default_sale_price": float(item.product.default_sale_price),
            "quantity": float(item.quantity),
            "entered_unit": item.entered_unit or item.product.unit,
            "entered_quantity": float(item.entered_quantity) if item.entered_quantity is not None else float(item.quantity),
            "unit_conversions": item.product.unit_conversions or {},
            "unit_price": float(item.unit_price),
            "total": item_total
        })
    
                            
    discount = float(invoice.discount_amount)
    final_amount = total_amount - discount
    remaining_amount = max(0, final_amount - float(invoice.paid_amount))
    payment_due = get_payment_due_info(invoice, remaining_amount)
    promotion_snapshot = promotion_snapshot_from_note(invoice.discount_note)
    payments, payments_total = dao.get_sales_invoice_payments_page(invoice.id)

    return {
        "id": invoice.id,
        "sold_at": invoice.sold_at.isoformat() if invoice.sold_at else None,
        "warehouse_id": invoice.warehouse_id,
        "warehouse": {
            "id": invoice.warehouse.id,
            "name": invoice.warehouse.name,
        },
        "status": invoice.status.value,
        "workflow_stage": workflow_stage(invoice),
        "warehouse_submitted_at": invoice.warehouse_submitted_at.isoformat() if invoice.warehouse_submitted_at else None,
        "current_assignee": {"id": invoice.current_assignee.id, "full_name": invoice.current_assignee.full_name} if invoice.current_assignee else None,
        "assignment_stage": invoice.assignment_stage,
        "assigned_at": invoice.assigned_at.isoformat() if invoice.assigned_at else None,
        "accepted_at": invoice.accepted_at.isoformat() if invoice.accepted_at else None,
        "accounting_handoff_at": invoice.accounting_handoff_at.isoformat() if invoice.accounting_handoff_at else None,
        "delivered_at": invoice.delivered_at.isoformat() if invoice.delivered_at else None,
        "delivery_recipient": invoice.delivery_recipient,
        "delivery_note": invoice.delivery_note,
        "delivery_method": invoice.delivery_method,
        "delivery_employee": {
            "id": invoice.delivery_employee.id,
            "full_name": invoice.delivery_employee.full_name,
        } if invoice.delivery_employee else None,
        "delivery_service": invoice.delivery_service,
        "tracking_number": invoice.tracking_number,
        "shipping_fee": float(invoice.shipping_fee) if invoice.shipping_fee is not None else None,
        "shipping_fund_method": invoice.shipping_fund_method,
        "shipping_charged_at": invoice.shipping_charged_at.isoformat() if invoice.shipping_charged_at else None,
        "sale_source": invoice.sale_source.value,
        "payment_status": invoice.payment_status.value,
        "paid_amount": float(invoice.paid_amount),
        "remaining_amount": remaining_amount,
        "payment_due_date": invoice.payment_due_date.isoformat() if invoice.payment_due_date else None,
        "payment_due_status": payment_due["status"],
        "days_until_due": payment_due["days_until_due"],
        "days_overdue": payment_due["days_overdue"],
        "cancel_requested": has_active_cancel_request(invoice),
        "cancel_note": invoice.cancel_note,
        "return_pending": bool(invoice.return_pending),
        "note": invoice.note,
        "customer": {
            "id": invoice.customer.id,
            "full_name": invoice.customer.full_name,
            "phone": invoice.customer.phone,
            "address": invoice.customer.address,
            "sales_area": {
                "id": invoice.sales_area_ref.id,
                "code": invoice.sales_area_ref.code,
                "name": invoice.sales_area_ref.name,
            } if invoice.sales_area_ref else None,
            "sales_area_id": invoice.sales_area_id
        },
        "employee": {
            "id": invoice.created_by_employee.id,
            "full_name": invoice.created_by_employee.full_name,
            "role": invoice.created_by_employee.role.value
        },
        "discount": {
            "amount": discount,
            "status": invoice.discount_status.value,
            "note": None if promotion_snapshot else invoice.discount_note,
            "promotion": promotion_snapshot,
            "approval_notes": approval_notes_from_note(invoice.discount_note),
            "approved_by": {
                "id": invoice.discount_approved_by_employee.id,
                "full_name": invoice.discount_approved_by_employee.full_name
            } if invoice.discount_approved_by_employee else None
        },
        "items": items_data,
        "total_amount": total_amount,
        "final_amount": final_amount,
        "payments": [serialize_sales_invoice_payment(payment) for payment in payments],
        "payments_total": payments_total,
        "payments_page": 1,
        "workflow_events": [
            {
                "id": event.id,
                "action": event.action,
                "detail": event.detail,
                "occurred_at": event.occurred_at.isoformat() if event.occurred_at else None,
                "actor": event.actor.full_name if event.actor else None,
                "recipient_id": event.recipient_id,
                "recipient": event.recipient.full_name if event.recipient else None,
            }
            for event in reversed(dao.get_recent_sales_invoice_workflow_events(invoice.id))
        ],
    }


def create_sales_invoice_service(
    employee_id,
    warehouse_id,
    customer_id,
    customer_data=None,
    note="",
    items=None,
    discount_amount=0,
    discount_note="",
    promotion_id=None,
    sale_source=None,
    payment_amount=0,
    payment_method=None,
    payment_due_date=None,
    stock_employee_id=None,
    sales_area_id=None,
):
       
                    
    if not items or len(items) == 0:
        raise ValidationError("Đơn hàng phải có ít nhất 1 sản phẩm")

    discount_amount = validate_money(discount_amount, "Số tiền giảm giá")

                               
    employee = Employee.query.get(employee_id)
    if not employee:
        raise NotFoundError("Nhân viên không tồn tại")

                                
    sale_source = parse_sale_source(sale_source)
    warehouse_id, warehouse = resolve_sales_warehouse(warehouse_id)
    ensure_warehouse_access(employee_id, warehouse_id)

                               
    customer = None
    if customer_id not in (None, ""):
        customer_id = validate_positive_integer(customer_id, "Mã khách hàng")
        customer = Customer.query.get(customer_id)
        if not customer:
            raise NotFoundError("Khách hàng không tồn tại")
    else:
        if not isinstance(customer_data, dict):
            raise ValidationError("Vui lòng nhập thông tin khách hàng")
        customer_phone = validate_phone(customer_data.get("phone"))
        customer_name = require_text(customer_data.get("full_name"), "Họ tên", max_length=150)
        customer_address = require_text(customer_data.get("address"), "Địa chỉ")
        if Customer.query.filter(Customer.phone == customer_phone).first():
            raise ValidationError("Số điện thoại khách hàng đã tồn tại")
        customer = Customer(
            full_name=customer_name,
            phone=customer_phone,
            address=customer_address,
            sales_area_id=resolve_sales_area_id(customer_data.get("sales_area_id"), required=True),
        )

    invoice_sales_area_id = (
        resolve_sales_area_id(sales_area_id)
        if sales_area_id not in (None, "") else customer.sales_area_id
    )

                                
    validated_items = _validate_sales_items(items)
    if sale_source == SaleSource.CENTRAL_WAREHOUSE:
        _validate_items_available_in_warehouse(validated_items, warehouse_id)

    total_amount = calculate_total_amount(validated_items)
    total_quantity = sum(item["quantity"] for item in validated_items)
    if promotion_id not in (None, ""):
        promotion, discount_amount = get_promotion_for_invoice(
            promotion_id,
            total_amount,
            total_quantity,
        )
        discount_note = build_promotion_note(promotion, discount_amount)
    else:
        if discount_amount > 0:
            raise ValidationError(
                "Vui lòng chọn chương trình khuyến mãi thay vì nhập giảm giá thủ công"
            )
        discount_amount = Decimal("0")
        discount_note = None
    discount_status = determine_discount_status(
        total_amount,
        discount_amount,
        is_promotion=promotion_id not in (None, ""),
    )
    final_amount = total_amount - discount_amount
    if validate_money(payment_amount, "Số tiền khách đưa") > 0 or payment_method not in (None, ""):
        raise ValidationError("Kế toán ghi nhận thanh toán sau khi đơn hoàn thành")
    clean_payment_due_date = (
        parse_payment_due_date(payment_due_date)
        if sale_source == SaleSource.CENTRAL_WAREHOUSE else None
    )

    if sale_source == SaleSource.EMPLOYEE_STOCK:
        if employee.role != EmployeeRole.NHAN_VIEN_BAN_HANG:
            raise ValidationError("Chỉ nhân viên bán hàng mới được tạo đơn từ hàng đi tỉnh của mình")
        stock_employee_id = employee_id
        if discount_status in {DiscountStatus.PENDING_APPROVAL, DiscountStatus.REJECTED}:
            raise ValidationError("Đơn bán từ hàng nhân viên không thể hoàn thành khi khuyến mãi chưa được duyệt")
        clean_payment_due_date = parse_payment_due_date(payment_due_date)

    if customer_id in (None, ""):
        db.session.add(customer)
        db.session.flush()
        customer_id = customer.id

                                    
    if sale_source == SaleSource.EMPLOYEE_STOCK:
        try:
            _consume_employee_stock(stock_employee_id, validated_items)
            invoice = dao.create_sales_invoice(
                warehouse_id=warehouse_id,
                customer_id=customer_id,
                employee_id=employee_id,
                note=note.strip() if note else None,
                items=validated_items,
                discount_amount=discount_amount,
                discount_status=discount_status,
                discount_note=discount_note,
                sale_source=sale_source,
                status=InvoiceStatus.COMPLETED,
                sales_area_id=invoice_sales_area_id,
                payment_due_date=clean_payment_due_date,
                commit=False,
            )
            _snapshot_sale_costs(invoice)
            _apply_invoice_payment(invoice, employee_id, 0, final_amount)
            db.session.commit()
            return dao.get_sales_invoice_by_id(invoice.id)
        except Exception:
            db.session.rollback()
            raise

    return dao.create_sales_invoice(
        warehouse_id=warehouse_id,
        customer_id=customer_id,
        employee_id=employee_id,
        note=note.strip() if note else None,
        items=validated_items,
        discount_amount=discount_amount,
        discount_status=discount_status,
        discount_note=discount_note,
        sale_source=sale_source,
        payment_status=PaymentStatus.UNPAID,
        paid_amount=0,
        sales_area_id=invoice_sales_area_id,
        payment_due_date=clean_payment_due_date,
    )



def update_sales_invoice_service(invoice_id, employee_id, warehouse_id, customer_id, note, items, discount_amount=0, discount_note="", promotion_id=None, payment_due_date=None):
       
                              
    invoice = SalesInvoice.query.filter_by(id=invoice_id).with_for_update().first()
    if not invoice:
        raise NotFoundError("Đơn hàng không tồn tại")

                         
    from web.services.authorization import ensure_invoice_owner
    ensure_invoice_owner(invoice, employee_id)
    # Validate access to the document's current warehouse before allowing the
    # requested warehouse to be changed.
    ensure_warehouse_access(employee_id, invoice.warehouse_id)

    if invoice.status != InvoiceStatus.DRAFT or invoice.warehouse_submitted_at:
        raise ValidationError("Chỉ có thể sửa đơn nháp chưa gửi kho")

    # Customer, warehouse, creator and sale source identify the original
    # transaction. They must not be transferred to another party while editing.
    if customer_id not in (None, ""):
        requested_customer_id = validate_positive_integer(
            customer_id,
            "Mã khách hàng",
        )
        if requested_customer_id != invoice.customer_id:
            raise ValidationError(
                "Không thể thay đổi khách hàng của đơn. "
                "Vui lòng hủy đơn cũ và tạo đơn mới."
            )

    if warehouse_id not in (None, ""):
        requested_warehouse_id = validate_positive_integer(warehouse_id, "Mã kho")
        if requested_warehouse_id != invoice.warehouse_id:
            raise ValidationError("Không thể thay đổi kho của đơn hàng")

    customer_id = invoice.customer_id
    warehouse_id = invoice.warehouse_id

                    
    if not items or len(items) == 0:
        raise ValidationError("Đơn hàng phải có ít nhất 1 sản phẩm")

    discount_amount = validate_money(discount_amount, "Số tiền giảm giá")

                               
    employee = Employee.query.get(employee_id)
    if not employee:
        raise NotFoundError("Nhân viên không tồn tại")

                                
    ensure_warehouse_access(employee_id, warehouse_id)

                               
    customer = Customer.query.get(customer_id)
    if not customer:
        raise NotFoundError("Khách hàng không tồn tại")

                                
    validated_items = _validate_sales_items(items)
    if invoice.sale_source == SaleSource.CENTRAL_WAREHOUSE:
        _validate_items_available_in_warehouse(validated_items, warehouse_id)

    total_amount = calculate_total_amount(validated_items)
    total_quantity = sum(item["quantity"] for item in validated_items)
    current_promotion = promotion_snapshot_from_note(invoice.discount_note)
    current_promotion_id = None
    if current_promotion:
        try:
            current_promotion_id = int(current_promotion.get("id"))
        except (TypeError, ValueError):
            current_promotion_id = None
    if promotion_id not in (None, ""):
        promotion, discount_amount = get_promotion_for_invoice(
            promotion_id,
            total_amount,
            total_quantity,
            existing_promotion_id=current_promotion_id,
        )
        discount_note = build_promotion_note(promotion, discount_amount)
    else:
        if discount_amount > 0:
            raise ValidationError(
                "Vui lòng chọn chương trình khuyến mãi thay vì nhập giảm giá thủ công"
            )
        discount_amount = Decimal("0")
        discount_note = None
    discount_status = determine_discount_status(
        total_amount,
        discount_amount,
        is_promotion=promotion_id not in (None, ""),
    )

                      
    updated_invoice = dao.update_sales_invoice(
        invoice_id=invoice_id,
        warehouse_id=warehouse_id,
        customer_id=customer_id,
        note=note.strip() if note else None,
        items=validated_items,
        discount_amount=discount_amount,
        discount_status=discount_status,
        discount_note=discount_note,
        sales_area_id=customer.sales_area_id,
        payment_due_date=parse_payment_due_date(payment_due_date),
    )

    return updated_invoice


def complete_sales_invoice_service(invoice_id, employee_id, payment_amount=0, payment_method=None, payment_due_date=None):
    require_accountant(employee_id)
    invoice_ref = SalesInvoice.query.get(invoice_id)
    if not invoice_ref:
        raise NotFoundError("Đơn hàng không tồn tại")
    ensure_warehouse_access(employee_id, invoice_ref.warehouse_id)
    # Payment and debt updates use the same lock order as later debt payments.
    Customer.query.filter(Customer.id == invoice_ref.customer_id).with_for_update().one()
    invoice = SalesInvoice.query.filter_by(id=invoice_id).with_for_update().first()

    if invoice.status == InvoiceStatus.COMPLETED:
        raise ValidationError("Đơn hàng đã được xuất kho trước đó")
    
                                                   
    if invoice.status != InvoiceStatus.DELIVERING:
        raise ValidationError("Chỉ có thể hoàn thành đơn đang giao")
    if not invoice.accounting_handoff_at or not invoice.delivered_at:
        raise ValidationError("Đơn chưa được xác nhận đã giao và bàn giao kế toán")
    _require_assignee(invoice, employee_id, "accounting", accepted=True)

    if invoice.discount_status == DiscountStatus.PENDING_APPROVAL:
        raise ValidationError(
            "Không thể xuất kho khi khuyến mãi chưa được duyệt. "
            "Vui lòng chờ quản lý duyệt khuyến mãi."
        )
    
    if invoice.discount_status == DiscountStatus.REJECTED:
        raise ValidationError(
            "Không thể xuất kho khi khuyến mãi đã bị từ chối. "
            "Vui lòng cập nhật lại đơn hàng."
        )

    if invoice.cancel_requested:
        raise ValidationError(
            "Không thể hoàn thành đơn đang có yêu cầu hủy chờ duyệt. "
            "Vui lòng xử lý yêu cầu hủy trước."
        )

    # Draft creation/editing already checks the then-current catalog and combo.
    # Completion must honor the saved prices, even if default prices or combo
    # definitions changed while the order was being delivered.
    _validate_saved_sales_items(invoice.items)

                                            
    try:
        Warehouse.query.filter(Warehouse.id == invoice.warehouse_id).with_for_update().one()
        if invoice.sale_source == SaleSource.CENTRAL_WAREHOUSE:
            _validate_items_available_in_warehouse(
                [
                    {"product_id": item.product_id, "quantity": float(item.quantity)}
                    for item in invoice.items
                ],
                invoice.warehouse_id,
                exclude_invoice_id=invoice.id,
            )
        else:
            stock_by_product = dao.calculate_stock_for_items_at_warehouse(
                [item.product_id for item in invoice.items],
                invoice.warehouse_id,
            )
            for item in invoice.items:
                stock_info = stock_by_product[item.product_id]
                if stock_info["available_stock"] < float(item.quantity):
                    raise ValidationError(
                        f"Sản phẩm '{item.product.name}' không đủ tồn kho."
                    )

        total_amount = sum(
            Decimal(str(item.quantity)) * Decimal(str(item.unit_price))
            for item in invoice.items
        )
        final_amount = total_amount - Decimal(str(invoice.discount_amount))
        amount_due = final_amount - Decimal(str(invoice.paid_amount or 0))
        tendered = validate_money(payment_amount, "Số tiền khách đưa")
        credited, _, method = _normalize_invoice_tender(tendered, payment_method, amount_due)
        remaining_amount = amount_due - credited
        requested_due_date = payment_due_date or (
            invoice.payment_due_date.isoformat() if invoice.payment_due_date else None
        )
        clean_payment_due_date = (
            parse_payment_due_date(requested_due_date, required=True)
            if remaining_amount > 0 else None
        )
        invoice.status = InvoiceStatus.COMPLETED
        _snapshot_sale_costs(invoice)
        invoice.current_assignee_id = None
        invoice.assignment_stage = None
        invoice.accepted_at = None
        invoice.payment_due_date = clean_payment_due_date if remaining_amount > 0 else None
        _apply_invoice_payment(
            invoice, employee_id, credited, final_amount,
            payment_method=method, cash_received=tendered,
        )
        _log_workflow_event(invoice, employee_id, "completed")
        db.session.commit()
        _notify_invoice_changed(invoice.id)
        return dao.get_sales_invoice_by_id(invoice.id)
    except AppError:
        db.session.rollback()
        raise
    except Exception as ex:
        db.session.rollback()
        raise Exception(f"Lỗi cập nhật trạng thái đơn hàng: {str(ex)}")



def record_sales_invoice_payment_service(invoice_id, employee_id, amount, payment_method, payment_due_date=None):
    accountant = require_accountant(employee_id)
    invoice_ref = SalesInvoice.query.get(invoice_id)
    if not invoice_ref:
        raise NotFoundError("Đơn hàng không tồn tại")
    ensure_warehouse_access(employee_id, invoice_ref.warehouse_id)

    # Match the lock order used by customer debt payments: customer, then invoice.
    customer = Customer.query.filter_by(id=invoice_ref.customer_id).with_for_update().first()
    invoice = SalesInvoice.query.filter_by(id=invoice_id).with_for_update().first()
    if not customer or not invoice:
        raise NotFoundError("Đơn hàng hoặc khách hàng không tồn tại")
    if invoice.status != InvoiceStatus.COMPLETED:
        raise ValidationError("Chỉ ghi nhận thanh toán cho đơn đã hoàn thành")

    total = sum(
        Decimal(str(item.quantity)) * Decimal(str(item.unit_price))
        for item in invoice.items
    ) - Decimal(str(invoice.discount_amount or 0))
    remaining = total - Decimal(str(invoice.paid_amount or 0))
    if remaining <= 0:
        raise ValidationError("Đơn hàng đã thanh toán đủ")
    tendered = validate_money(amount, "Số tiền khách đưa")
    credited, change, method = _normalize_invoice_tender(tendered, payment_method, remaining)
    if credited <= 0:
        raise ValidationError("Số tiền thanh toán phải lớn hơn 0")
    if Decimal(str(customer.debt_amount or 0)) < credited:
        raise ValidationError("Công nợ khách hàng không đủ để ghi nhận khoản thanh toán này")
    updated_due_date = (
        parse_payment_due_date(payment_due_date, allow_past=True)
        if payment_due_date and credited < remaining else None
    )

    try:
        customer.debt_amount = Decimal(str(customer.debt_amount)) - credited
        invoice.paid_amount = Decimal(str(invoice.paid_amount or 0)) + credited
        invoice.payment_status = get_payment_status(invoice.paid_amount, total)
        if invoice.payment_status == PaymentStatus.PAID:
            invoice.payment_due_date = None
        elif updated_due_date is not None:
            invoice.payment_due_date = updated_due_date
        note = (
            f"Khách đưa {_format_vnd(tendered)}; tiền thối lại {_format_vnd(change)}"
            if change > 0 else None
        )
        payment = CustomerPayment(
            customer_id=customer.id,
            sales_invoice_id=invoice.id,
            employee_id=accountant.id,
            amount=credited,
            payment_type=PaymentType.INVOICE,
            payment_method=method,
            note=note,
        )
        db.session.add(payment)
        db.session.flush()
        record_fund_movement(
            payment.payment_method, "in", payment.amount,
            "customer_receipt", payment.id, accountant.id,
            f"Thu tiền đơn bán #{invoice.id}", payment.note,
        )
        db.session.commit()
        return dao.get_sales_invoice_by_id(invoice.id), payment
    except Exception:
        db.session.rollback()
        raise


def parse_invoice_status_filter(status_value):
                                         
    if not status_value:
        return None
    
    text = str(status_value).strip()
    
                            
    status_map = {
        "nháp": InvoiceStatus.DRAFT,
        "draft": InvoiceStatus.DRAFT,
        "đang xử lý": InvoiceStatus.PROCESSING,
        "processing": InvoiceStatus.PROCESSING,
        "đang giao": InvoiceStatus.DELIVERING,
        "delivering": InvoiceStatus.DELIVERING,
        "hoàn thành": InvoiceStatus.COMPLETED,
        "completed": InvoiceStatus.COMPLETED,
        "đã hủy": InvoiceStatus.CANCELLED,
        "cancelled": InvoiceStatus.CANCELLED,
    }
    
    return status_map.get(text.lower())


def parse_invoice_date(value, field_name):
    if not value:
        return None
    try:
        return datetime.strptime(str(value).strip(), "%Y-%m-%d")
    except (ValueError, TypeError):
        raise ValidationError(
            f"{field_name} không hợp lệ. Định dạng đúng: YYYY-MM-DD"
        )


def parse_invoice_date_range(from_date_value, to_date_value):
    from_date = parse_invoice_date(from_date_value, "Ngày bắt đầu")
    to_date = parse_invoice_date(to_date_value, "Ngày kết thúc")

    if from_date and to_date and from_date > to_date:
        raise ValidationError("Ngày bắt đầu không được lớn hơn ngày kết thúc")

    if to_date:
        to_date = datetime.combine(to_date.date(), time.max)

    return from_date, to_date


def serialize_invoice_summary(invoice):
                                                 
                    
    total_amount = sum(
        float(item.quantity) * float(item.unit_price) 
        for item in invoice.items
    )
    
    discount = float(invoice.discount_amount)
    final_amount = total_amount - discount
    remaining_amount = max(0, final_amount - float(invoice.paid_amount))
    payment_due = get_payment_due_info(invoice, remaining_amount)
    promotion_snapshot = promotion_snapshot_from_note(invoice.discount_note)
    
    return {
        "id": invoice.id,
        "warehouse": {"id": invoice.warehouse.id, "name": invoice.warehouse.name},
        "sold_at": invoice.sold_at.isoformat() if invoice.sold_at else None,
        "status": invoice.status.value,
        "workflow_stage": workflow_stage(invoice),
        "warehouse_submitted_at": invoice.warehouse_submitted_at.isoformat() if invoice.warehouse_submitted_at else None,
        "current_assignee": {"id": invoice.current_assignee.id, "full_name": invoice.current_assignee.full_name} if invoice.current_assignee else None,
        "assignment_stage": invoice.assignment_stage,
        "accepted_at": invoice.accepted_at.isoformat() if invoice.accepted_at else None,
        "accounting_handoff_at": invoice.accounting_handoff_at.isoformat() if invoice.accounting_handoff_at else None,
        "delivery_method": invoice.delivery_method,
        "delivered_at": invoice.delivered_at.isoformat() if invoice.delivered_at else None,
        "cancel_requested": has_active_cancel_request(invoice),
        "return_pending": bool(invoice.return_pending),
        "sale_source": invoice.sale_source.value,
        "payment_status": invoice.payment_status.value,
        "paid_amount": float(invoice.paid_amount),
        "remaining_amount": remaining_amount,
        "payment_due_date": invoice.payment_due_date.isoformat() if invoice.payment_due_date else None,
        "payment_due_status": payment_due["status"],
        "days_until_due": payment_due["days_until_due"],
        "days_overdue": payment_due["days_overdue"],
        "customer": {
            "id": invoice.customer.id,
            "full_name": invoice.customer.full_name,
            "phone": invoice.customer.phone
        },
        "employee": {
            "id": invoice.created_by_employee.id,
            "full_name": invoice.created_by_employee.full_name
        },
        "discount": {
            "amount": discount,
            "status": invoice.discount_status.value,
            "promotion": promotion_snapshot,
        },
        "items_count": len(invoice.items),
        "total_amount": total_amount,
        "final_amount": final_amount,
        "note": invoice.note,
        "sales_area": {
            "id": invoice.sales_area_ref.id,
            "code": invoice.sales_area_ref.code,
            "name": invoice.sales_area_ref.name,
        } if invoice.sales_area_ref else None,
        "sales_area_id": invoice.sales_area_id
    }


def get_sales_invoices_list_service(
    page_value,
    per_page_value,
    status_value,
    keyword,
    from_date_value=None,
    to_date_value=None,
    cancel_requested=None,
    warehouse_id=None,
    debt_status=None,
    assignee_id=None,
):
       
    from web.utils.pagination import parse_page, parse_per_page
    from web import app
    import math
    
    default_size = app.config.get("APPLICATION_SIZE", 10)
    page = parse_page(page_value)
    per_page = parse_per_page(per_page_value, default_size)
    status = parse_invoice_status_filter(status_value)
    stage = str(status_value or "").strip().lower()
    if stage not in {"", "chờ kho", "chờ kế toán"} and status is None:
        raise ValidationError("Trạng thái đơn hàng không hợp lệ")
    from_date, to_date = parse_invoice_date_range(from_date_value, to_date_value)
    keyword = str(keyword or '').strip()
    debt_status = str(debt_status or "").strip().lower() or None
    if debt_status not in {None, "overdue", "due_today", "due_soon"}:
        raise ValidationError("Trạng thái hạn thanh toán không hợp lệ")
    
    invoices, total = dao.get_sales_invoices_list(
        page=page,
        per_page=per_page,
        status=status,
        keyword=keyword or None,
        warehouse_id=warehouse_id,
        from_date=from_date,
        to_date=to_date,
        cancel_requested=cancel_requested,
        debt_status=debt_status,
        today=business_today(),
        due_soon_days=PAYMENT_DUE_SOON_DAYS,
        workflow_stage_filter=stage if stage in {"chờ kho", "chờ kế toán"} else None,
        assignee_id=assignee_id,
    )
    
    pages = math.ceil(total / per_page) if per_page > 0 else 0
    
    return invoices, total, page, pages


def get_status_tracking_board_service():
    # The status board renders counts only. Do not load every invoice and all
    # line items just to calculate those counts; aggregate in the database.
    tracking_statuses = (
        InvoiceStatus.DRAFT,
        InvoiceStatus.PROCESSING,
        InvoiceStatus.DELIVERING,
        InvoiceStatus.COMPLETED,
        InvoiceStatus.CANCELLED,
    )
    groups = {
        status.value: {
            "status": status.value,
            "total": 0,
            "invoices": [],
        }
        for status in tracking_statuses
    }

    rows = (
        db.session.query(
            SalesInvoice.status,
            func.count(SalesInvoice.id).label("total"),
            func.sum(case((and_(
                SalesInvoice.status == InvoiceStatus.DRAFT,
                SalesInvoice.warehouse_submitted_at.isnot(None),
            ), 1), else_=0)).label("submitted"),
            func.sum(case((and_(
                SalesInvoice.status == InvoiceStatus.DELIVERING,
                SalesInvoice.accounting_handoff_at.isnot(None),
            ), 1), else_=0)).label("waiting_accounting"),
        )
        .filter(SalesInvoice.status.in_(tracking_statuses))
        .group_by(SalesInvoice.status)
        .all()
    )
    submitted = 0
    waiting_accounting = 0
    for row in rows:
        groups[row.status.value]["total"] = int(row.total or 0)
        submitted += int(row.submitted or 0)
        waiting_accounting += int(row.waiting_accounting or 0)
    groups[InvoiceStatus.DRAFT.value]["total"] -= int(submitted)
    groups[InvoiceStatus.DELIVERING.value]["total"] -= int(waiting_accounting)
    return [
        groups[InvoiceStatus.DRAFT.value],
        {"status": "chờ kho", "total": int(submitted), "invoices": []},
        groups[InvoiceStatus.PROCESSING.value],
        groups[InvoiceStatus.DELIVERING.value],
        {"status": "chờ kế toán", "total": int(waiting_accounting), "invoices": []},
        groups[InvoiceStatus.COMPLETED.value],
        groups[InvoiceStatus.CANCELLED.value],
    ]



def get_sales_invoice_detail_service(invoice_id):
    invoice = dao.get_sales_invoice_by_id(invoice_id)
    
    if not invoice:
        raise NotFoundError("Đơn hàng không tồn tại")
    
    return invoice


def submit_sales_invoice_to_warehouse_service(invoice_id, employee_id, recipient_id):
    invoice = SalesInvoice.query.filter_by(id=invoice_id).with_for_update().first()
    if not invoice:
        raise NotFoundError("Đơn hàng không tồn tại")
    employee = Employee.query.get(employee_id)
    if not employee or employee.role not in {EmployeeRole.NHAN_VIEN_BAN_HANG, EmployeeRole.QUAN_LY}:
        raise ForbiddenError("Bạn không có quyền gửi đơn cho kho")
    if employee.role == EmployeeRole.NHAN_VIEN_BAN_HANG and invoice.employee_id != employee_id:
        raise ForbiddenError("Chỉ được gửi đơn do mình tạo")
    ensure_warehouse_access(employee_id, invoice.warehouse_id)
    if invoice.status != InvoiceStatus.DRAFT or invoice.warehouse_submitted_at:
        raise ValidationError("Đơn không còn là bản nháp chưa gửi kho")
    if invoice.sale_source != SaleSource.CENTRAL_WAREHOUSE:
        raise ValidationError("Chỉ gửi kho các đơn bán từ kho trung tâm")
    if not invoice.items:
        raise ValidationError("Đơn hàng chưa có sản phẩm")
    if invoice.cancel_requested:
        raise ValidationError("Đơn đang chờ xử lý yêu cầu hủy")
    _assign_invoice(invoice, employee_id, recipient_id, "warehouse")
    invoice.warehouse_submitted_at = datetime.now()
    _log_workflow_event(invoice, employee_id, "submitted_to_warehouse", recipient_id=int(recipient_id))
    db.session.commit()
    _notify_invoice_changed(invoice.id)
    return dao.get_sales_invoice_by_id(invoice.id)


def accept_sales_invoice_assignment_service(invoice_id, employee_id):
    invoice = SalesInvoice.query.filter_by(id=invoice_id).with_for_update().first()
    if not invoice:
        raise NotFoundError("Đơn hàng không tồn tại")
    if invoice.cancel_requested:
        raise ValidationError("Đơn đang chờ xử lý yêu cầu hủy")
    stage = invoice.assignment_stage
    if stage not in {"warehouse", "delivery", "accounting"}:
        raise ValidationError("Đơn chưa ở công đoạn có thể nhận")
    _require_assignee(invoice, employee_id, stage)
    if stage == "warehouse" and not invoice.warehouse_submitted_at:
        raise ValidationError("Đơn chưa gửi kho")
    if stage == "accounting" and not invoice.accounting_handoff_at:
        raise ValidationError("Đơn chưa bàn giao kế toán")
    if stage == "delivery" and invoice.status not in {InvoiceStatus.PROCESSING, InvoiceStatus.DELIVERING}:
        raise ValidationError("Đơn chưa đến công đoạn giao hàng")
    if invoice.accepted_at:
        return dao.get_sales_invoice_by_id(invoice.id)
    invoice.accepted_at = vietnam_payment_time()
    _log_workflow_event(invoice, employee_id, "accepted", stage)
    db.session.commit()
    _notify_invoice_changed(invoice.id)
    return dao.get_sales_invoice_by_id(invoice.id)


def reassign_sales_invoice_service(invoice_id, manager_id, recipient_id):
    manager = db.session.get(Employee, manager_id)
    if not manager or manager.role != EmployeeRole.QUAN_LY:
        raise ForbiddenError("Chỉ quản lý được đổi người phụ trách")
    invoice = SalesInvoice.query.filter_by(id=invoice_id).with_for_update().first()
    if not invoice:
        raise NotFoundError("Đơn hàng không tồn tại")
    stage = invoice.assignment_stage
    if stage is None:
        if invoice.status == InvoiceStatus.DRAFT and invoice.warehouse_submitted_at:
            stage = "warehouse"
        elif invoice.status == InvoiceStatus.PROCESSING:
            stage = "delivery" if invoice.delivery_method else "warehouse"
        elif invoice.status == InvoiceStatus.DELIVERING and invoice.accounting_handoff_at:
            stage = "accounting"
        elif invoice.status == InvoiceStatus.DELIVERING:
            stage = "delivery"
    if stage == "warehouse" and invoice.status not in {InvoiceStatus.DRAFT, InvoiceStatus.PROCESSING}:
        raise ValidationError("Đơn đã qua công đoạn kho")
    if stage == "accounting" and (invoice.status != InvoiceStatus.DELIVERING or not invoice.accounting_handoff_at):
        raise ValidationError("Đơn chưa ở công đoạn kế toán")
    if stage == "delivery" and invoice.status not in {InvoiceStatus.PROCESSING, InvoiceStatus.DELIVERING}:
        raise ValidationError("Đơn không còn ở công đoạn giao hàng")
    if stage not in {"warehouse", "delivery", "accounting"}:
        raise ValidationError("Không thể đổi người phụ trách ở công đoạn này")
    if invoice.cancel_requested:
        raise ValidationError("Cần xử lý yêu cầu hủy trước")
    if invoice.assignment_stage == stage and str(invoice.current_assignee_id) == str(recipient_id):
        raise ValidationError("Người phụ trách mới phải khác người hiện tại")
    if stage == "delivery":
        try:
            recipient = db.session.get(Employee, int(recipient_id))
        except (TypeError, ValueError):
            recipient = None
        required_role = EmployeeRole.NHAN_VIEN_GIAO_HANG if invoice.delivery_method == "internal" else EmployeeRole.QUAN_LY
        if not recipient or recipient.role != required_role or not recipient.is_approved or recipient.is_locked:
            raise ValidationError("Người nhận giao hàng không hợp lệ hoặc đã bị khóa")
        previous_id = invoice.current_assignee_id
        invoice.current_assignee_id = recipient.id
        invoice.assignment_stage = "delivery"
        invoice.assigned_at = vietnam_payment_time()
        invoice.accepted_at = None
        if invoice.delivery_method == "internal":
            invoice.delivery_employee_id = recipient.id
        _log_workflow_event(invoice, manager_id, "assigned", f"delivery: {previous_id or '-'} -> {recipient.id}", recipient.id)
    else:
        _assign_invoice(invoice, manager_id, recipient_id, stage)
    db.session.commit()
    _notify_invoice_changed(invoice.id)
    return dao.get_sales_invoice_by_id(invoice.id)


def handoff_sales_invoice_accounting_service(invoice_id, employee_id, recipient_id, recipient_name, note=None):
    invoice = SalesInvoice.query.filter_by(id=invoice_id).with_for_update().first()
    if not invoice:
        raise NotFoundError("Đơn hàng không tồn tại")
    actor = db.session.get(Employee, employee_id)
    if invoice.status != InvoiceStatus.DELIVERING or invoice.accounting_handoff_at:
        raise ValidationError("Chỉ được xác nhận giao đơn đang giao chưa bàn giao kế toán")
    if invoice.cancel_requested:
        raise ValidationError("Cần xử lý yêu cầu hủy trước")
    if invoice.delivery_method == "internal":
        if not actor or actor.role != EmployeeRole.NHAN_VIEN_GIAO_HANG:
            raise ForbiddenError("Chỉ nhân viên được giao mới được xác nhận đã giao")
    elif invoice.delivery_method == "third_party":
        if not actor or actor.role != EmployeeRole.QUAN_LY:
            raise ForbiddenError("Chỉ quản lý phụ trách được xác nhận giao qua đối tác")
    else:
        raise ValidationError("Đơn chưa có phương án giao hàng")
    _require_assignee(invoice, employee_id, "delivery", accepted=True)
    recipient_name = require_text(recipient_name, "Người nhận hàng", max_length=120)
    _assign_invoice(invoice, employee_id, recipient_id, "accounting")
    invoice.delivery_recipient = recipient_name
    invoice.delivery_note = str(note or "").strip()[:1000] or None
    invoice.delivered_at = vietnam_payment_time()
    invoice.accounting_handoff_at = invoice.delivered_at
    _log_workflow_event(invoice, employee_id, "delivered_to_accounting", invoice.delivery_recipient, int(recipient_id))
    db.session.commit()
    _notify_invoice_changed(invoice.id)
    return dao.get_sales_invoice_by_id(invoice.id)


def list_delivery_staff_service():
    return Employee.query.filter(
        Employee.role == EmployeeRole.NHAN_VIEN_GIAO_HANG,
        Employee.is_approved.is_(True),
        Employee.is_locked.is_(False),
    ).order_by(Employee.full_name.asc(), Employee.id.asc()).all()


def serialize_courier_assignment(invoice):
    return {
        "id": invoice.id,
        "status": invoice.status.value,
        "warehouse_id": invoice.warehouse_id,
        "accounting_handoff_at": invoice.accounting_handoff_at.isoformat() if invoice.accounting_handoff_at else None,
        "delivered_at": invoice.delivered_at.isoformat() if invoice.delivered_at else None,
        "delivery_recipient": invoice.delivery_recipient,
        "accepted_at": invoice.accepted_at.isoformat() if invoice.accepted_at else None,
        "sold_at": invoice.sold_at.isoformat() if invoice.sold_at else None,
        "warehouse": invoice.warehouse.name,
        "customer": {
            "full_name": invoice.customer.full_name,
            "phone": invoice.customer.phone,
            "address": invoice.customer.address,
        },
        "items": [
            {"product_name": item.product.name, "unit": item.product.unit, "quantity": item.quantity}
            for item in invoice.items
        ],
        "cancel_requested": bool(invoice.cancel_requested),
    }


def list_courier_assignments_service(employee_id, page, per_page):
    query = SalesInvoice.query.filter(
        SalesInvoice.delivery_method == "internal",
        SalesInvoice.delivery_employee_id == employee_id,
    )
    total = query.count()
    invoices = query.options(
        joinedload(SalesInvoice.customer),
        joinedload(SalesInvoice.warehouse),
        selectinload(SalesInvoice.items).joinedload(SalesInvoiceItem.product),
    ).order_by(SalesInvoice.sold_at.desc(), SalesInvoice.id.desc()).offset((page - 1) * per_page).limit(per_page).all()
    return invoices, total


def get_courier_assignment_service(invoice_id, employee_id):
    invoice = SalesInvoice.query.filter(
        SalesInvoice.id == invoice_id,
        SalesInvoice.delivery_method == "internal",
        SalesInvoice.delivery_employee_id == employee_id,
    ).first()
    if not invoice:
        raise NotFoundError("Đơn giao hàng không tồn tại")
    return invoice


def prepare_sales_invoice_delivery_service(invoice_id, employee_id, data):
    invoice = SalesInvoice.query.filter_by(id=invoice_id).with_for_update().first()
    if not invoice:
        raise NotFoundError("Đơn hàng không tồn tại")
    actor = Employee.query.get(employee_id)
    if not actor or actor.role not in {EmployeeRole.THU_KHO, EmployeeRole.QUAN_LY}:
        raise ForbiddenError("Chỉ thủ kho hoặc quản lý được chuẩn bị giao hàng")
    ensure_warehouse_access(employee_id, invoice.warehouse_id)
    repairing_legacy = (
        invoice.status == InvoiceStatus.DELIVERING
        and invoice.delivery_method is None
        and actor.role == EmployeeRole.QUAN_LY
    )
    if (invoice.status != InvoiceStatus.PROCESSING and not repairing_legacy) or invoice.cancel_requested:
        raise ValidationError("Chỉ được chọn phương án giao cho đơn đang xử lý hoặc đơn cũ chưa có phương án")
    if repairing_legacy and invoice.shipping_charged_at:
        raise ValidationError("Đơn cũ đã có ghi nhận phí giao; cần đối chiếu quỹ trước khi khôi phục")
    if not repairing_legacy and not (actor.role == EmployeeRole.QUAN_LY and invoice.assignment_stage == "delivery"):
        _require_assignee(invoice, employee_id, "warehouse", accepted=True)
    method = str(data.get("delivery_method") or "").strip()
    if method not in {"internal", "third_party"}:
        raise ValidationError("Vui lòng chọn nhân viên công ty hoặc dịch vụ giao hàng")

    if method == "internal":
        courier_id = validate_positive_integer(data.get("delivery_employee_id"), "Nhân viên giao hàng")
        courier = Employee.query.get(courier_id)
        if not courier or courier.role != EmployeeRole.NHAN_VIEN_GIAO_HANG or not courier.is_approved or courier.is_locked:
            raise ValidationError("Nhân viên giao hàng không còn hoạt động")
        invoice.delivery_employee_id = courier.id
        invoice.delivery_service = None
        invoice.tracking_number = None
        invoice.shipping_fee = None
        invoice.shipping_fund_method = None
        detail = f"Nhân viên công ty: {courier.full_name}"
    else:
        service = require_text(data.get("delivery_service"), "Dịch vụ giao hàng", max_length=120)
        tracking = require_text(data.get("tracking_number"), "Mã vận đơn", max_length=120)
        fee = validate_money_amount(data.get("shipping_fee"), "Phí vận chuyển", allow_zero=False)
        fund_method = parse_payment_method(data.get("shipping_fund_method"), required=True)
        manager_id = data.get("delivery_manager_id") or (employee_id if actor.role == EmployeeRole.QUAN_LY else None)
        try:
            delivery_manager = db.session.get(Employee, int(manager_id))
        except (TypeError, ValueError):
            delivery_manager = None
        if not delivery_manager or delivery_manager.role != EmployeeRole.QUAN_LY or not delivery_manager.is_approved or delivery_manager.is_locked:
            raise ValidationError("Vui lòng chọn quản lý đang hoạt động để theo dõi đơn giao ngoài")
        invoice.delivery_employee_id = None
        invoice.delivery_service = service
        invoice.tracking_number = tracking
        invoice.shipping_fee = fee
        invoice.shipping_fund_method = fund_method.value
        detail = f"{service}: {tracking}"
    try:
        invoice.delivery_method = method
        if repairing_legacy and method == "third_party":
            charge_time = vietnam_payment_time()
            record_fund_movement(
                invoice.shipping_fund_method, "out", invoice.shipping_fee,
                FundEntryType.DELIVERY_SHIPPING.value, invoice.id, employee_id,
                f"Phí giao hàng đơn bán #{invoice.id}",
                f"{invoice.delivery_service} · {invoice.tracking_number}",
                occurred_at=charge_time,
            )
            invoice.shipping_charged_at = charge_time
        previous_id = invoice.current_assignee_id
        invoice.current_assignee_id = courier.id if method == "internal" else delivery_manager.id
        invoice.assignment_stage = "delivery"
        invoice.assigned_at = vietnam_payment_time()
        invoice.accepted_at = invoice.assigned_at if method == "third_party" and employee_id == delivery_manager.id else None
        _log_workflow_event(invoice, employee_id, "assigned", f"delivery: {previous_id or '-'} -> {invoice.current_assignee_id}", invoice.current_assignee_id)
        _log_workflow_event(invoice, employee_id, "delivery_prepared", detail)
        if repairing_legacy:
            _log_workflow_event(invoice, employee_id, "legacy_delivery_repaired")
        db.session.commit()
        _notify_invoice_changed(invoice.id)
        return dao.get_sales_invoice_by_id(invoice.id)
    except Exception:
        db.session.rollback()
        raise


def update_payment_due_date_service(invoice_id, employee_id, payment_due_date):
    invoice = dao.get_sales_invoice_by_id(invoice_id)
    if not invoice:
        raise NotFoundError("Đơn hàng không tồn tại")
    ensure_warehouse_access(employee_id, invoice.warehouse_id)
    if invoice.status != InvoiceStatus.COMPLETED:
        raise ValidationError("Chỉ đặt hạn thanh toán cho đơn đã hoàn thành")

    total_amount = sum(
        Decimal(str(item.quantity)) * Decimal(str(item.unit_price))
        for item in invoice.items
    )
    final_amount = total_amount - Decimal(str(invoice.discount_amount or 0))
    remaining_amount = max(
        Decimal("0"),
        final_amount - Decimal(str(invoice.paid_amount or 0)),
    )
    if remaining_amount <= 0:
        raise ValidationError("Đơn hàng đã thanh toán đủ nên không cần hạn thanh toán")

    invoice.payment_due_date = parse_payment_due_date(
        payment_due_date,
        required=True,
        allow_past=True,
    )
    db.session.commit()
    return dao.get_sales_invoice_by_id(invoice.id)



def update_invoice_status_service(invoice_id, employee_id, status_value):
       
    invoice = SalesInvoice.query.filter_by(id=invoice_id).with_for_update().first()
    if not invoice:
        raise NotFoundError("Đơn hàng không tồn tại")

    ensure_warehouse_access(employee_id, invoice.warehouse_id)
    employee = Employee.query.get(employee_id)
    if not employee or employee.role not in {
        EmployeeRole.THU_KHO, EmployeeRole.QUAN_LY, EmployeeRole.NHAN_VIEN_GIAO_HANG,
    }:
        raise ForbiddenError("Bạn không có quyền chuyển trạng thái đơn")
    
                  
    text = str(status_value).strip().lower()
    status_map = {
        "nháp": InvoiceStatus.DRAFT,
        "draft": InvoiceStatus.DRAFT,
        "đang xử lý": InvoiceStatus.PROCESSING,
        "processing": InvoiceStatus.PROCESSING,
        "đang giao": InvoiceStatus.DELIVERING,
        "delivering": InvoiceStatus.DELIVERING,
        "hoàn thành": InvoiceStatus.COMPLETED,
        "completed": InvoiceStatus.COMPLETED,
        "đã hủy": InvoiceStatus.CANCELLED,
        "cancelled": InvoiceStatus.CANCELLED,
    }
    
    new_status = status_map.get(text)
    if not new_status:
        raise ValidationError("Trạng thái không hợp lệ")

    if invoice.cancel_requested:
        raise ValidationError(
            "Không thể chuyển trạng thái đơn đang có yêu cầu hủy chờ duyệt. "
            "Vui lòng xử lý yêu cầu hủy trước."
        )

    if new_status == InvoiceStatus.COMPLETED:
        raise ValidationError("Dùng chức năng hoàn thành đơn để kiểm tra tồn kho và ghi nhận thanh toán")
    
                                
    allowed_transitions = {
        InvoiceStatus.DRAFT: {InvoiceStatus.PROCESSING},
        InvoiceStatus.PROCESSING: {InvoiceStatus.DELIVERING},
        InvoiceStatus.DELIVERING: set(),
        InvoiceStatus.COMPLETED: set(),
        InvoiceStatus.CANCELLED: set(),
    }
    if new_status not in allowed_transitions[invoice.status]:
        raise ValidationError("Chuyển trạng thái đơn hàng không hợp lệ")

    if new_status == InvoiceStatus.PROCESSING and employee.role not in {
        EmployeeRole.THU_KHO, EmployeeRole.QUAN_LY,
    }:
        raise ForbiddenError("Chỉ thủ kho hoặc quản lý được xác nhận xử lý đơn")
    if new_status == InvoiceStatus.PROCESSING:
        _require_assignee(invoice, employee_id, "warehouse", accepted=True)
    if new_status == InvoiceStatus.DELIVERING:
        _require_assignee(invoice, employee_id, "delivery")
        if invoice.delivery_method == "internal":
            if employee.role != EmployeeRole.NHAN_VIEN_GIAO_HANG or invoice.delivery_employee_id != employee_id:
                raise ForbiddenError("Chỉ nhân viên giao hàng được phân công mới được bắt đầu giao đơn này")
        elif invoice.delivery_method == "third_party":
            if employee.role != EmployeeRole.QUAN_LY:
                raise ForbiddenError("Chỉ quản lý được bàn giao đơn cho dịch vụ vận chuyển")
            if not invoice.accepted_at:
                raise ValidationError("Quản lý được phân công cần nhận đơn trước khi bàn giao đối tác")
            if not all((invoice.delivery_service, invoice.tracking_number, invoice.shipping_fee, invoice.shipping_fund_method)):
                raise ValidationError("Thiếu thông tin dịch vụ vận chuyển hoặc phí ship")
        else:
            raise ValidationError("Vui lòng chọn phương án giao hàng trước khi chuyển trạng thái")

    if invoice.status == InvoiceStatus.DRAFT and not invoice.warehouse_submitted_at:
        raise ValidationError("Nhân viên bán hàng chưa gửi đơn cho kho")
    if new_status == InvoiceStatus.DELIVERING and invoice.discount_status in {
        DiscountStatus.PENDING_APPROVAL, DiscountStatus.REJECTED,
    }:
        raise ValidationError("Chưa thể giao đơn khi khuyến mãi chưa được duyệt")

    if invoice.status == InvoiceStatus.CANCELLED:
        raise ValidationError("Không thể thay đổi trạng thái đơn đã hủy")
    
    if invoice.status == InvoiceStatus.COMPLETED and new_status != InvoiceStatus.CANCELLED:
        raise ValidationError("Đơn đã hoàn thành, chỉ có thể hủy")
    
            
    try:
        if (
            new_status in {InvoiceStatus.PROCESSING, InvoiceStatus.DELIVERING}
            and invoice.sale_source == SaleSource.CENTRAL_WAREHOUSE
        ):
            Warehouse.query.filter(Warehouse.id == invoice.warehouse_id).with_for_update().one()
            _validate_items_available_in_warehouse(
                [
                    {"product_id": item.product_id, "quantity": float(item.quantity)}
                    for item in invoice.items
                ],
                invoice.warehouse_id,
                exclude_invoice_id=invoice.id,
            )
        if new_status == InvoiceStatus.DELIVERING and invoice.delivery_method == "third_party":
            charge_time = vietnam_payment_time()
            record_fund_movement(
                invoice.shipping_fund_method, "out", invoice.shipping_fee,
                FundEntryType.DELIVERY_SHIPPING.value, invoice.id, employee_id,
                f"Phí giao hàng đơn bán #{invoice.id}",
                f"{invoice.delivery_service} · {invoice.tracking_number}",
                occurred_at=charge_time,
            )
            invoice.shipping_charged_at = charge_time
        invoice.status = new_status
        if new_status == InvoiceStatus.DELIVERING and invoice.delivery_method == "internal":
            invoice.accepted_at = vietnam_payment_time()
            _log_workflow_event(invoice, employee_id, "accepted", "delivery")
        _log_workflow_event(invoice, employee_id,
                            "warehouse_processing" if new_status == InvoiceStatus.PROCESSING else "dispatched")
        db.session.commit()
        _notify_invoice_changed(invoice.id)
        db.session.refresh(invoice)
        return invoice
    except AppError:
        db.session.rollback()
        raise
    except Exception as ex:
        db.session.rollback()
        raise Exception(f"Lỗi cập nhật trạng thái: {str(ex)}")


def cancel_invoice_service(invoice_id, employee_id):
       
    invoice = SalesInvoice.query.filter_by(id=invoice_id).with_for_update().first()
    if not invoice:
        raise NotFoundError("Đơn hàng không tồn tại")

    ensure_warehouse_access(employee_id, invoice.warehouse_id)

    employee = Employee.query.get(employee_id)
    if not employee:
        raise NotFoundError("Người thực hiện không tồn tại")

    if employee.role == EmployeeRole.NHAN_VIEN_BAN_HANG and invoice.employee_id != employee_id:
        raise ValidationError("Nhân viên bán hàng chỉ được thao tác trên đơn do mình tạo")

    if employee.role == EmployeeRole.QUAN_LY:
        if invoice.status == InvoiceStatus.COMPLETED:
            raise ValidationError(
                "Không thể hủy đơn đã hoàn thành trực tiếp. "
                "Cần lập quy trình trả hàng và hoàn tiền riêng."
            )
        if invoice.status not in {
            InvoiceStatus.DRAFT,
            InvoiceStatus.PROCESSING,
            InvoiceStatus.DELIVERING,
        }:
            raise ValidationError("Đơn hàng không ở trạng thái có thể hủy")
    elif invoice.status != InvoiceStatus.DRAFT:
        raise ValidationError("Nhân viên chỉ có thể hủy đơn ở trạng thái 'nháp'")
    
                             
    try:
        invoice.return_pending = (
            invoice.status == InvoiceStatus.DELIVERING
            and invoice.sale_source == SaleSource.CENTRAL_WAREHOUSE
        )
        invoice.status = InvoiceStatus.CANCELLED
        invoice.cancel_requested = False
        invoice.current_assignee_id = None
        invoice.assignment_stage = None
        invoice.accepted_at = None
        _log_workflow_event(invoice, employee_id, "cancelled")
        if employee.role == EmployeeRole.QUAN_LY:
            current_note = invoice.cancel_note or ""
            invoice.cancel_note = (
                f"{current_note}\n[Quản lý hủy trực tiếp]: Hủy đơn theo quyền quản lý"
            ).strip()
        db.session.commit()
        _notify_invoice_changed(invoice.id)
        db.session.refresh(invoice)
        return invoice
    except AppError:
        db.session.rollback()
        raise
    except Exception as ex:
        db.session.rollback()
        raise Exception(f"Lỗi hủy đơn hàng: {str(ex)}")


def confirm_sales_invoice_return_service(invoice_id, employee_id):
    """Restock a cancelled dispatched order only after the full return arrives."""
    employee = db.session.get(Employee, employee_id)
    if not employee or employee.role not in {EmployeeRole.THU_KHO, EmployeeRole.QUAN_LY}:
        raise ForbiddenError("Chỉ thủ kho hoặc quản lý được xác nhận hàng hoàn")
    try:
        invoice = SalesInvoice.query.filter_by(id=invoice_id).with_for_update().first()
        if not invoice:
            raise NotFoundError("Đơn hàng không tồn tại")
        ensure_warehouse_access(employee_id, invoice.warehouse_id)
        if invoice.status != InvoiceStatus.CANCELLED or not invoice.return_pending:
            raise ValidationError("Đơn không có hàng hoàn đang chờ xác nhận", status_code=409)
        invoice.return_pending = False
        _log_workflow_event(invoice, employee_id, "return_received", "Đã nhận đủ hàng hoàn về kho")
        db.session.commit()
        _notify_invoice_changed(invoice.id)
        return dao.get_sales_invoice_by_id(invoice.id)
    except Exception:
        db.session.rollback()
        raise


def request_cancel_invoice_service(invoice_id, employee_id, cancel_note):
       
    invoice = SalesInvoice.query.filter_by(id=invoice_id).with_for_update().first()
    if not invoice:
        raise NotFoundError("Đơn hàng không tồn tại")
    
                                                                    
    ensure_warehouse_access(employee_id, invoice.warehouse_id)

    if invoice.employee_id != employee_id:
        raise ValidationError("Chỉ người tạo đơn mới được gửi yêu cầu hủy")

    allowed_statuses = [InvoiceStatus.PROCESSING, InvoiceStatus.DELIVERING]
    if invoice.status not in allowed_statuses:
        raise ValidationError(
            f"Không thể gửi yêu cầu hủy đơn ở trạng thái '{invoice.status.value}'. "
            f"Chỉ có thể hủy đơn đang xử lý hoặc đang giao. Đơn hoàn thành cần quy trình trả hàng và hoàn tiền riêng."
        )
    
    if invoice.cancel_requested:
        raise ValidationError("Yêu cầu hủy đã được gửi trước đó")
    
                          
    try:
        invoice.cancel_requested = True
        invoice.cancel_note = cancel_note.strip() if cancel_note else None
        db.session.commit()
        _notify_invoice_changed(invoice.id)
        db.session.refresh(invoice)
        return invoice
    except Exception as ex:
        db.session.rollback()
        raise Exception(f"Lỗi gửi yêu cầu hủy: {str(ex)}")


def approve_discount_service(invoice_id, manager_id, approved, note=""):
       
                              
    invoice = SalesInvoice.query.get(invoice_id)
    if not invoice:
        raise NotFoundError("Đơn hàng không tồn tại")
    
                              
    manager = Employee.query.get(manager_id)
    if not manager:
        raise NotFoundError("Quản lý không tồn tại")
    
                                                              
    if manager.role != EmployeeRole.QUAN_LY:
        raise ValidationError("Chỉ quản lý mới được duyệt khuyến mãi")
    if invoice.employee_id == manager_id:
        raise ValidationError("Người tạo đơn không được tự duyệt khuyến mãi")

    if invoice.discount_status != DiscountStatus.PENDING_APPROVAL:
        raise ValidationError(
            f"Đơn hàng không cần duyệt khuyến mãi. "
            f"Trạng thái hiện tại: {invoice.discount_status.value}"
        )
    
    try:
        if approved:
                            
            invoice.discount_status = DiscountStatus.APPROVED
            invoice.discount_approved_by = manager_id
            
                                  
            if note:
                invoice.discount_note = append_approval_note(
                    invoice.discount_note,
                    "Quản lý duyệt",
                    note.strip(),
                )
            
            message = "Đã duyệt khuyến mãi"
        else:
                              
            invoice.discount_status = DiscountStatus.REJECTED
            invoice.discount_approved_by = manager_id
            
                                        
            invoice.discount_amount = 0
            
                           
            reject_note = note.strip() if note else "Từ chối khuyến mãi"
            invoice.discount_note = append_approval_note(
                invoice.discount_note,
                "Quản lý từ chối",
                reject_note,
            )
            
            message = "Đã từ chối khuyến mãi"
        
        db.session.commit()
        
        return dao.get_sales_invoice_by_id(invoice.id), message
    
    except Exception as ex:
        db.session.rollback()
        raise Exception(f"Lỗi duyệt khuyến mãi: {str(ex)}")


def get_pending_discount_invoices_service(page_value, per_page_value, keyword):
       
    from web.utils.pagination import parse_page, parse_per_page
    from web import app
    import math
    
    default_size = app.config.get("APPLICATION_SIZE", 10)
    page = parse_page(page_value)
    per_page = parse_per_page(per_page_value, default_size)
    keyword = str(keyword or '').strip()
    
                                          
    invoices, total = dao.get_sales_invoices_list(
        page=page,
        per_page=per_page,
        status=None,
        keyword=keyword or None,
        discount_status=DiscountStatus.PENDING_APPROVAL
    )
    
    pages = math.ceil(total / per_page) if per_page > 0 else 0
    
    return invoices, total, page, pages


def approve_cancel_request_service(invoice_id, manager_id, approved, note=""):
       
                              
    invoice = SalesInvoice.query.filter_by(id=invoice_id).with_for_update().first()
    if not invoice:
        raise NotFoundError("Đơn hàng không tồn tại")
    
                                  
    manager = Employee.query.get(manager_id)
    if not manager:
        raise NotFoundError("Người duyệt không tồn tại")
    
                                      
    if manager.role == EmployeeRole.QUAN_LY and invoice.employee_id == manager_id:
        raise ValidationError("Người tạo đơn không được tự duyệt hủy đơn")

    if not invoice.cancel_requested:
        raise ValidationError("Đơn hàng này không có yêu cầu hủy")

    if invoice.status == InvoiceStatus.COMPLETED and approved:
        raise ValidationError(
            "Không thể hủy đơn đã hoàn thành trực tiếp. "
            "Cần lập quy trình trả hàng và hoàn tiền riêng."
        )
    
                                                  
    if invoice.status in [InvoiceStatus.PROCESSING, InvoiceStatus.DELIVERING]:
                                                          
        if manager.role not in [EmployeeRole.KE_TOAN, EmployeeRole.QUAN_LY]:
            raise ValidationError("Chỉ Kế toán hoặc Quản lý mới có quyền duyệt hủy đơn")
    elif invoice.status == InvoiceStatus.COMPLETED and not approved:
        if manager.role not in [EmployeeRole.KE_TOAN, EmployeeRole.QUAN_LY]:
            raise ValidationError("Chỉ Kế toán hoặc Quản lý mới có quyền từ chối yêu cầu hủy đơn")
    else:
        raise ValidationError(f"Không thể duyệt hủy đơn ở trạng thái '{invoice.status.value}'")
    
    try:
        if approved:
            invoice.return_pending = (
                invoice.status == InvoiceStatus.DELIVERING
                and invoice.sale_source == SaleSource.CENTRAL_WAREHOUSE
            )
            invoice.status = InvoiceStatus.CANCELLED
            invoice.cancel_requested = False
            invoice.current_assignee_id = None
            invoice.assignment_stage = None
            invoice.accepted_at = None
            _log_workflow_event(invoice, manager_id, "cancelled")
            
                           
            approve_note = note.strip() if note else "Đã duyệt hủy đơn"
            current_note = invoice.cancel_note or ""
            invoice.cancel_note = f"{current_note}\n[Duyệt hủy bởi {manager.full_name}]: {approve_note}".strip()
            
            message = "Đã duyệt hủy đơn hàng"
        else:
                             
            invoice.cancel_requested = False
            
                           
            reject_note = note.strip() if note else "Từ chối hủy đơn"
            current_note = invoice.cancel_note or ""
            invoice.cancel_note = f"{current_note}\n[Từ chối bởi {manager.full_name}]: {reject_note}".strip()
            
            message = "Đã từ chối yêu cầu hủy đơn"
        
        db.session.commit()
        _notify_invoice_changed(invoice.id)
        
        return dao.get_sales_invoice_by_id(invoice.id), message
    
    except Exception as ex:
        db.session.rollback()
        raise Exception(f"Lỗi duyệt yêu cầu hủy: {str(ex)}")
