from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

from web import app, dao
from web.services.exceptions import NotFoundError, ValidationError
from web.services.validators import require_text, validate_money_amount, validate_phone
from web.services.sales_area_service import resolve_sales_area_id


def parse_page(value):
                                        
    if value is None:
        return 1
    try:
        page = int(value)
        return page if page > 0 else 1
    except (ValueError, TypeError):
        return 1


def parse_per_page(value, default):
                                     
    if value is None:
        return default
    try:
        per_page = int(value)
        return min(per_page, app.config.get("MAX_PAGE_SIZE", 100)) if per_page > 0 else default
    except (ValueError, TypeError):
        return default


def parse_paging_args(page_value, per_page_value):
                                                 
    default_size = app.config.get("APPLICATION_SIZE", 10)
    return parse_page(page_value), parse_per_page(per_page_value, default_size)


def validate_debt_amount(value, enforce_minimum=False):
    return validate_money_amount(
        value,
        "Số tiền nợ",
        allow_zero=True,
        minimum=Decimal("500") if enforce_minimum else None,
    )


def serialize_customer(customer, include_financial=True):
    data = {
        "id": customer.id,
        "full_name": customer.full_name,
        "phone": customer.phone,
        "address": customer.address,
        "sales_area": {
            "id": customer.sales_area_ref.id,
            "code": customer.sales_area_ref.code,
            "name": customer.sales_area_ref.name,
        } if customer.sales_area_ref else None,
        "sales_area_id": customer.sales_area_id,
    }
    data["debt_amount"] = float(customer.debt_amount) if include_financial else None
    return data


def get_customers_list_service(
    page_value,
    per_page_value,
    keyword,
    has_debt,
    debt_min=None,
    debt_max=None,
):
       
    page, per_page = parse_paging_args(page_value, per_page_value)
    keyword = str(keyword or '').strip()
    
                              
    has_debt_filter = False
    if has_debt and str(has_debt).lower() in ['true', '1', 'yes']:
        has_debt_filter = True

    clean_debt_min = validate_debt_amount(debt_min) if str(debt_min or '').strip() else None
    clean_debt_max = validate_debt_amount(debt_max) if str(debt_max or '').strip() else None
    if clean_debt_min is not None and clean_debt_max is not None and clean_debt_min > clean_debt_max:
        raise ValidationError("Mức công nợ từ không được lớn hơn mức công nợ đến")

    customers, total = dao.get_all_customers(
        page=page,
        per_page=per_page,
        keyword=keyword or None,
        has_debt=has_debt_filter,
        debt_min=clean_debt_min,
        debt_max=clean_debt_max,
    )

    return customers, total, page, per_page


def create_customer_service(full_name, phone, address, sales_area_id=None):
    clean_full_name = require_text(full_name, "Họ tên", max_length=150)
    clean_phone = validate_phone(phone)
    clean_address = require_text(address, "Địa chỉ")

    if dao.get_customer_by_phone(clean_phone):
        raise ValidationError("Số điện thoại này đã tồn tại!")

    clean_sales_area_id = resolve_sales_area_id(sales_area_id)
    return dao.add_customer(
        full_name=clean_full_name,
        phone=clean_phone,
        address=clean_address,
        sales_area_id=clean_sales_area_id,
    )


def get_customer_detail_service(customer_id, page_value=None, per_page_value=None):
       
    customer = dao.get_customer_by_id(customer_id)
    
    if not customer:
        raise NotFoundError("Khách hàng không tồn tại")
    
    statistics = dao.get_customer_statistics(customer_id)
    page, per_page = parse_paging_args(page_value, per_page_value)
    payments, total_payments = dao.get_customer_payments(
        customer_id, page=page, per_page=per_page
    )
    
    return customer, statistics, payments, total_payments, page, per_page


def update_customer_service(
    customer_id,
    full_name,
    phone,
    address,
    debt_amount,
    sales_area_id=None,
):
       
    customer = dao.get_customer_by_id(customer_id)
    
    if not customer:
        raise NotFoundError("Khách hàng không tồn tại")
    
                               
    clean_full_name = require_text(full_name, "Họ tên", max_length=150)
    clean_phone = validate_phone(phone)
    clean_address = require_text(address, "Địa chỉ")
    
                                          
    clean_sales_area_id = resolve_sales_area_id(sales_area_id)
    if clean_phone != customer.phone:
        existing_customer = dao.get_customer_by_phone(clean_phone)
        if existing_customer:
            raise ValidationError("Số điện thoại này đã tồn tại!")
    
                                       
    clean_debt_amount = None
    if debt_amount is not None:
        clean_debt_amount = validate_debt_amount(debt_amount, enforce_minimum=True)

    updated_customer = dao.update_customer(
        customer_id=customer_id,
        full_name=clean_full_name,
        phone=clean_phone,
        address=clean_address,
        debt_amount=clean_debt_amount,
        sales_area_id=clean_sales_area_id,
    )
    
    return updated_customer


def customer_payment_service(customer_id, payment_amount, note):
       
    customer = dao.get_customer_by_id(customer_id)
    
    if not customer:
        raise NotFoundError("Khách hàng không tồn tại")
    
                             
    if payment_amount is None or payment_amount == "":
        raise ValidationError("Số tiền thanh toán không được để trống")
    
    try:
        clean_payment_amount = validate_money_amount(
            payment_amount,
            "Số tiền thanh toán",
            allow_zero=False,
        )
    except (ValueError, TypeError):
        raise ValidationError("Số tiền thanh toán không hợp lệ")
    
                  
    try:
        updated_customer, old_debt, new_debt = dao.reduce_customer_debt(
            customer_id=customer_id,
            payment_amount=float(clean_payment_amount)
        )
        
        return updated_customer, old_debt, new_debt, clean_payment_amount
    except ValueError as ex:
        raise ValidationError(str(ex))
