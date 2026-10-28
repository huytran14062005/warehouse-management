import math
from datetime import date, datetime, time
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from sqlalchemy import func
from zoneinfo import ZoneInfo

from web import dao, db
from web.models import (
    Customer,
    CustomerPayment,
    DiscountStatus,
    Employee,
    EmployeeRole,
    EmployeeStock,
    InvoiceStatus,
    PaymentStatus,
    PaymentType,
    Product,
    SaleSource,
    SalesInvoice,
    Warehouse,
)
from web.services.exceptions import AppError, NotFoundError, ValidationError
from web.services.authorization import (
    ensure_bounded_items,
    ensure_warehouse_access,
    get_central_warehouse,
)
from web.services.validators import require_text, validate_money_amount, validate_phone
from web.services.payment_service import parse_payment_method
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

PAYMENT_DUE_SOON_DAYS = 7
BUSINESS_TIMEZONE = ZoneInfo("Asia/Bangkok")


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


def validate_positive_number(value, field_name):
                           
    try:
        num = float(value)
        if not math.isfinite(num) or num <= 0:
            raise ValidationError(f"{field_name} phải lớn hơn 0")
        return num
    except (ValueError, TypeError):
        raise ValidationError(f"{field_name} không hợp lệ")


def validate_positive_quantity(value, field_name):
    try:
        if isinstance(value, bool):
            raise ValueError
        quantity = int(value)
        if float(value) != quantity or quantity <= 0:
            raise ValidationError(f"{field_name} must be a positive integer")
        return quantity
    except (ValueError, TypeError):
        raise ValidationError(f"{field_name} must be a positive integer")


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
        warehouse = Warehouse.query.order_by(Warehouse.id.asc()).first()
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


def _validate_sales_items(items):
    ensure_bounded_items(items, "Sản phẩm trong đơn hàng")
    if not isinstance(items, list) or not items:
        raise ValidationError("ÄÆ¡n hÃ ng pháº£i cÃ³ Ã­t nháº¥t 1 sáº£n pháº©m")

    normalized = []
    product_ids = []
    seen_product_ids = set()
    for index, item in enumerate(items, start=1):
        if not isinstance(item, dict):
            raise ValidationError(f"Sáº£n pháº©m (item {index}) khÃ´ng há»£p lá»‡")
        product_id = validate_positive_integer(
            item.get("product_id"),
            f"MÃ£ sáº£n pháº©m (item {index})",
        )
        if product_id in seen_product_ids:
            raise ValidationError(f"Sáº£n pháº©m ID {product_id} bá»‹ lặp trong đơn hàng")
        seen_product_ids.add(product_id)
        product_ids.append(product_id)
        normalized.append({
            "product_id": product_id,
            "quantity": validate_positive_quantity(
                item.get("quantity"),
                f"Sá»‘ lÆ°á»£ng (item {index})",
            ),
            "unit_price": validate_money(
                item.get("unit_price"),
                f"ÄÆ¡n giÃ¡ (item {index})",
                allow_zero=False,
            ),
        })

    products = Product.query.filter(Product.id.in_(product_ids)).all()
    products_by_id = {product.id: product for product in products}
    missing_product_ids = [product_id for product_id in product_ids if product_id not in products_by_id]
    if missing_product_ids:
        raise NotFoundError(f"Sáº£n pháº©m ID {missing_product_ids[0]} khÃ´ng tá»“n táº¡i")

    return normalized


def _validate_items_available_in_warehouse(items, warehouse_id, exclude_invoice_id=None):
    """Ensure a draft order can be fulfilled with the warehouse's current stock.

    Draft sales invoices do not deduct inventory, but editing one should not
    allow a quantity that is already greater than the stock available for the
    selected warehouse.  The final completion step still validates again to
    protect against stock changes after this check.
    """
    product_ids = [item["product_id"] for item in items]
    stock_by_product = dao.calculate_stock_for_items_at_warehouse(
        product_ids,
        warehouse_id,
    )
    reserved_by_product = dao.calculate_reserved_stock_for_items_at_warehouse(
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
            int(stock_by_product.get(item["product_id"], {}).get("available_stock", 0))
            - reserved_by_product.get(item["product_id"], 0),
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
        raise ValidationError("Sá»‘ tiá»n giáº£m giÃ¡ khÃ´ng Ä‘Æ°á»£c vÆ°á»£t quá» tÃ´ng tiá»n Ä‘Æ¡n")

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
        available = int(stock.quantity) if stock else 0
        if available < item["quantity"]:
            raise ValidationError(
                f"Sản phẩm '{product_names[item['product_id']]}' trong tồn của nhân viên không đủ."
            )
    for item in items:
        stocks[item["product_id"]].quantity = (
            int(stocks[item["product_id"]].quantity) - item["quantity"]
        )


def _apply_invoice_payment(invoice, employee_id, payment_amount, final_amount, payment_method=None):
    payment_amount = validate_money(payment_amount, "Số tiền khách thanh toán")
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
        db.session.add(
            CustomerPayment(
                customer_id=customer.id,
                sales_invoice_id=invoice.id,
                employee_id=employee_id,
                amount=payment_amount,
                payment_type=PaymentType.INVOICE,
                payment_method=payment_method,
                note="Thanh toán khi hoàn thành đơn hàng",
            )
        )
    return remaining_amount


def serialize_sales_invoice(invoice):
                                                      
    items_data = []
    total_amount = 0

    for item in invoice.items:
        item_total = float(item.quantity) * float(item.unit_price)
        total_amount += item_total

        items_data.append({
            "id": item.id,
            "product_id": item.product_id,
            "product_name": item.product.name,
            "unit": item.product.unit,
            "quantity": int(item.quantity),
            "unit_price": float(item.unit_price),
            "total": item_total
        })
    
                            
    discount = float(invoice.discount_amount)
    final_amount = total_amount - discount
    remaining_amount = max(0, final_amount - float(invoice.paid_amount))
    payment_due = get_payment_due_info(invoice, remaining_amount)
    promotion_snapshot = promotion_snapshot_from_note(invoice.discount_note)

    return {
        "id": invoice.id,
        "sold_at": invoice.sold_at.isoformat() if invoice.sold_at else None,
        "warehouse_id": invoice.warehouse_id,
        "status": invoice.status.value,
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
        "payments": [
            {
                "id": payment.id,
                "amount": float(payment.amount),
                "payment_type": payment.payment_type.value,
                "payment_method": payment.payment_method.value if payment.payment_method else None,
                "paid_at": payment.paid_at.isoformat() if payment.paid_at else None,
                "note": payment.note,
            }
            for payment in invoice.payments
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
):
       
                    
    if not items or len(items) == 0:
        raise ValidationError("Đơn hàng phải có ít nhất 1 sản phẩm")

    discount_amount = validate_money(discount_amount, "Số tiền giảm giá")

                               
    employee = Employee.query.get(employee_id)
    if not employee:
        raise NotFoundError("Nhân viên không tồn tại")

                                
    sale_source = parse_sale_source(sale_source)
    if sale_source == SaleSource.CENTRAL_WAREHOUSE:
        warehouse = get_central_warehouse()
        warehouse_id = warehouse.id
    else:
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
    clean_payment_due_date = parse_payment_due_date(payment_due_date)

    if sale_source == SaleSource.EMPLOYEE_STOCK:
        if employee.role != EmployeeRole.NHAN_VIEN_BAN_HANG:
            raise ValidationError("Chỉ nhân viên bán hàng mới được tạo đơn từ hàng đi tỉnh của mình")
        stock_employee_id = employee_id
        if discount_status in {DiscountStatus.PENDING_APPROVAL, DiscountStatus.REJECTED}:
            raise ValidationError("Đơn bán từ hàng nhân viên không thể hoàn thành khi khuyến mãi chưa được duyệt")
        payment_amount = validate_money(payment_amount, "Số tiền khách thanh toán")
        if payment_amount > final_amount:
            raise ValidationError("Số tiền khách thanh toán không được lớn hơn tổng tiền đơn")

        if payment_amount < final_amount and clean_payment_due_date is None:
            raise ValidationError("Vui lòng chọn hạn thanh toán cho phần tiền còn nợ")

    if customer_id in (None, ""):
        db.session.add(customer)
        db.session.flush()
        customer_id = customer.id

                                    
    if sale_source == SaleSource.CENTRAL_WAREHOUSE and validate_money(payment_amount, "Số tiền khách thanh toán") > 0:
        raise ValidationError("Chỉ ghi nhận thanh toán khi đơn được hoàn thành")

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
                sales_area_id=customer.sales_area_id,
                payment_due_date=clean_payment_due_date if payment_amount < final_amount else None,
                commit=False,
            )
            _apply_invoice_payment(invoice, employee_id, payment_amount, final_amount, payment_method)
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
        sales_area_id=customer.sales_area_id,
        payment_due_date=clean_payment_due_date,
    )



def update_sales_invoice_service(invoice_id, employee_id, warehouse_id, customer_id, note, items, discount_amount=0, discount_note="", promotion_id=None, payment_due_date=None):
       
                              
    invoice = SalesInvoice.query.get(invoice_id)
    if not invoice:
        raise NotFoundError("Đơn hàng không tồn tại")

                         
    from web.services.authorization import ensure_invoice_owner
    ensure_invoice_owner(invoice, employee_id)
    # Validate access to the document's current warehouse before allowing the
    # requested warehouse to be changed.
    ensure_warehouse_access(employee_id, invoice.warehouse_id)

    if invoice.status != InvoiceStatus.DRAFT:
        raise ValidationError("Không thể sửa đơn hàng đã xuất kho")

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
    if invoice.sale_source == SaleSource.CENTRAL_WAREHOUSE:
        warehouse_id = get_central_warehouse().id

                    
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
       
                              
    invoice = dao.get_sales_invoice_by_id(invoice_id)
    if not invoice:
        raise NotFoundError("Đơn hàng không tồn tại")

                         
    ensure_warehouse_access(employee_id, invoice.warehouse_id)

    if invoice.status == InvoiceStatus.COMPLETED:
        raise ValidationError("Đơn hàng đã được xuất kho trước đó")
    
                                                   
    if invoice.status not in {InvoiceStatus.PROCESSING, InvoiceStatus.DELIVERING}:
        raise ValidationError("Chá»‰ cÃ³ thá»ƒ hoÃ n thÃ nh Ä‘Æ¡n Ä‘ang xá»­ lÃ½ hoáº·c Ä‘ang giao")

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

                                            
    try:
        Warehouse.query.filter(Warehouse.id == invoice.warehouse_id).with_for_update().one()
        if invoice.sale_source == SaleSource.CENTRAL_WAREHOUSE:
            _validate_items_available_in_warehouse(
                [
                    {"product_id": item.product_id, "quantity": int(item.quantity)}
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
                if stock_info["available_stock"] < int(item.quantity):
                    raise ValidationError(
                        f"Sản phẩm '{item.product.name}' không đủ tồn kho."
                    )

        total_amount = sum(
            Decimal(str(item.quantity)) * Decimal(str(item.unit_price))
            for item in invoice.items
        )
        final_amount = total_amount - Decimal(str(invoice.discount_amount))
        clean_payment_amount = validate_money(payment_amount, "Số tiền khách thanh toán")
        remaining_amount = final_amount - clean_payment_amount
        requested_due_date = payment_due_date or (
            invoice.payment_due_date.isoformat() if invoice.payment_due_date else None
        )
        clean_payment_due_date = parse_payment_due_date(
            requested_due_date,
            required=remaining_amount > 0,
        )
        invoice.status = InvoiceStatus.COMPLETED
        invoice.payment_due_date = clean_payment_due_date if remaining_amount > 0 else None
        _apply_invoice_payment(invoice, employee_id, clean_payment_amount, final_amount, payment_method)
        db.session.commit()
        return dao.get_sales_invoice_by_id(invoice.id)
    except AppError:
        db.session.rollback()
        raise
    except Exception as ex:
        db.session.rollback()
        raise Exception(f"Lỗi cập nhật trạng thái đơn hàng: {str(ex)}")



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
        "sold_at": invoice.sold_at.isoformat() if invoice.sold_at else None,
        "status": invoice.status.value,
        "cancel_requested": has_active_cancel_request(invoice),
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
):
       
    from web.services.customer_service import parse_page, parse_per_page
    from web import app
    import math
    
    default_size = app.config.get("APPLICATION_SIZE", 10)
    page = parse_page(page_value)
    per_page = parse_per_page(per_page_value, default_size)
    status = parse_invoice_status_filter(status_value)
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
        db.session.query(SalesInvoice.status, func.count(SalesInvoice.id))
        .filter(SalesInvoice.status.in_(tracking_statuses))
        .group_by(SalesInvoice.status)
        .all()
    )
    for status, total in rows:
        groups[status.value]["total"] = int(total or 0)

    return [groups[status.value] for status in tracking_statuses]



def get_sales_invoice_detail_service(invoice_id):
    invoice = dao.get_sales_invoice_by_id(invoice_id)
    
    if not invoice:
        raise NotFoundError("Đơn hàng không tồn tại")
    
    return invoice


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
       
    invoice = SalesInvoice.query.get(invoice_id)
    if not invoice:
        raise NotFoundError("Đơn hàng không tồn tại")

    ensure_warehouse_access(employee_id, invoice.warehouse_id)
    
                  
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
        InvoiceStatus.DELIVERING: {InvoiceStatus.COMPLETED},
        InvoiceStatus.COMPLETED: set(),
        InvoiceStatus.CANCELLED: set(),
    }
    if new_status not in allowed_transitions[invoice.status]:
        raise ValidationError("Chuyá»ƒn tráº¡ng thÃ¡i Ä‘Æ¡n hÃ ng khÃ´ng há»£p lá»‡")

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
                    {"product_id": item.product_id, "quantity": int(item.quantity)}
                    for item in invoice.items
                ],
                invoice.warehouse_id,
                exclude_invoice_id=invoice.id,
            )
        invoice.status = new_status
        db.session.commit()
        db.session.refresh(invoice)
        return invoice
    except AppError:
        db.session.rollback()
        raise
    except Exception as ex:
        db.session.rollback()
        raise Exception(f"Lỗi cập nhật trạng thái: {str(ex)}")


def cancel_invoice_service(invoice_id, employee_id):
       
    invoice = SalesInvoice.query.get(invoice_id)
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
        invoice.status = InvoiceStatus.CANCELLED
        invoice.cancel_requested = False
        if employee.role == EmployeeRole.QUAN_LY:
            current_note = invoice.cancel_note or ""
            invoice.cancel_note = (
                f"{current_note}\n[Quản lý hủy trực tiếp]: Hủy đơn theo quyền quản lý"
            ).strip()
        db.session.commit()
        db.session.refresh(invoice)
        return invoice
    except AppError:
        db.session.rollback()
        raise
    except Exception as ex:
        db.session.rollback()
        raise Exception(f"Lỗi hủy đơn hàng: {str(ex)}")


def request_cancel_invoice_service(invoice_id, employee_id, cancel_note):
       
    invoice = SalesInvoice.query.get(invoice_id)
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
       
    from web.services.customer_service import parse_page, parse_per_page
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
       
                              
    invoice = SalesInvoice.query.get(invoice_id)
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
            invoice.status = InvoiceStatus.CANCELLED
            invoice.cancel_requested = False
            
                           
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
        
        return dao.get_sales_invoice_by_id(invoice.id), message
    
    except Exception as ex:
        db.session.rollback()
        raise Exception(f"Lỗi duyệt yêu cầu hủy: {str(ex)}")
