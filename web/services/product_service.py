from decimal import Decimal, InvalidOperation
from datetime import datetime

from sqlalchemy import func

from web import app, dao, db
from web.models import Employee, EmployeeRole, Product, ProductRequest, ProductRequestStatus
from web.services.exceptions import NotFoundError, ValidationError
from web.services.validators import require_text, validate_money_amount


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


def parse_warehouse_id(value):
                                   
    if value is None:
        return None
    try:
        wh_id = int(value)
        if wh_id <= 0:
            raise ValidationError("Mã kho phải lớn hơn 0")
        return wh_id
    except (ValueError, TypeError):
        raise ValidationError("Mã kho không hợp lệ")


def parse_optional_price(value, field_name):
    if value is None or (isinstance(value, str) and not value.strip()):
        return None

    try:
        price = Decimal(str(value).strip())
    except (InvalidOperation, ValueError, TypeError):
        raise ValidationError(f"{field_name} khÃ´ng há»£p lá»‡")

    if not price.is_finite() or price < 0:
        raise ValidationError(f"{field_name} khÃ´ng Ä‘Æ°á»£c Ã¢m")

    return price


def parse_price_range(min_price_value, max_price_value):
    min_price = parse_optional_price(min_price_value, "GiÃ¡ tá»«")
    max_price = parse_optional_price(max_price_value, "GiÃ¡ Ä‘áº¿n")

    if min_price is not None and max_price is not None and min_price > max_price:
        raise ValidationError("GiÃ¡ tá»« khÃ´ng Ä‘Æ°á»£c lá»›n hÆ¡n giÃ¡ Ä‘áº¿n")

    return min_price, max_price


def parse_inventory_status(value):
    if value is None or (isinstance(value, str) and not value.strip()):
        return None

    status = str(value).strip().lower()
    allowed_statuses = {"available", "low", "empty"}
    if status not in allowed_statuses:
        raise ValidationError("Trạng thái tồn kho không hợp lệ")
    return status


def parse_paging_args(page_value, per_page_value):
                                                 
    default_size = app.config.get("APPLICATION_SIZE", 10)
    return parse_page(page_value), parse_per_page(per_page_value, default_size)


def serialize_product_inventory(product, inventory):
                                               
    return {
        "id": product.id,
        "name": product.name,
        "unit": product.unit,
        "default_sale_price": float(product.default_sale_price),
        "total_imported": inventory["total_imported"],
        "total_sold": inventory["total_sold"],
        "total_damaged": inventory["total_damaged"],
        "total_transferred": inventory.get("total_transferred", 0),
        "available_stock": inventory["available_stock"],
        "warehouses": inventory["warehouses"]
    }


def get_product_detail_service(product_id, warehouse_id=None):
    product = Product.query.get(product_id)
    if not product:
        raise NotFoundError("Sản phẩm không tồn tại")
    inventory = dao.calculate_inventory_for_products(
        [product.id], warehouse_id=warehouse_id,
    ).get(product.id, {
        "total_imported": 0,
        "total_sold": 0,
        "total_damaged": 0,
        "total_transferred": 0,
        "available_stock": 0,
        "warehouses": [],
    })
    return {
        **serialize_product_inventory(product, inventory),
        "warehouses": inventory.get("warehouses", []),
    }


def get_products_inventory_service(
    page_value,
    per_page_value,
    keyword,
    warehouse_id_value,
    min_price_value,
    max_price_value,
    status_value=None,
):
       
    page, per_page = parse_paging_args(page_value, per_page_value)
    keyword = str(keyword or '').strip()
    warehouse_id = parse_warehouse_id(warehouse_id_value)
    min_price, max_price = parse_price_range(min_price_value, max_price_value)
    status = parse_inventory_status(status_value)

    products_data, total = dao.get_products_with_inventory(
        page=page,
        per_page=per_page,
        keyword=keyword or None,
        warehouse_id=warehouse_id,
        min_price=min_price,
        max_price=max_price,
        status=status,
    )

    return products_data, total, page, per_page


def serialize_product_request(request):
    return {
        "id": request.id,
        "name": request.name,
        "unit": request.unit,
        "note": request.note,
        "status": request.status,
        "created_at": request.created_at.isoformat() if request.created_at else None,
        "requested_by": {
            "id": request.requested_by_employee.id,
            "full_name": request.requested_by_employee.full_name,
            "role": request.requested_by_employee.role.value,
        },
        "resolved_product_id": request.resolved_product_id,
    }


def create_product_request_service(employee_id, name, unit, note=""):
    employee = Employee.query.get(employee_id)
    if not employee:
        raise NotFoundError("Nhân viên không tồn tại")
    if employee.role not in {EmployeeRole.NHAN_VIEN_BAN_HANG, EmployeeRole.THU_KHO}:
        raise ValidationError("Vai trò của bạn không được gửi yêu cầu thêm sản phẩm")

    name = require_text(name, "Tên sản phẩm", max_length=255)
    unit = require_text(unit, "Đơn vị tính", max_length=50)
    note = str(note or "").strip()[:1000]

    existing_product = Product.query.filter(func.lower(Product.name) == name.lower()).first()
    if existing_product:
        raise ValidationError("Sản phẩm này đã tồn tại trong danh sách")

    pending_request = ProductRequest.query.filter(
        ProductRequest.status == ProductRequestStatus.PENDING.value,
        func.lower(ProductRequest.name) == name.lower(),
    ).first()
    if pending_request:
        raise ValidationError("Sản phẩm này đã có yêu cầu đang chờ quản lý xử lý")

    request = ProductRequest(
        name=name,
        unit=unit,
        note=note or None,
        requested_by_employee_id=employee_id,
        status=ProductRequestStatus.PENDING.value,
    )
    db.session.add(request)
    db.session.commit()
    return request


def get_product_requests_service(status=ProductRequestStatus.PENDING.value):
    query = ProductRequest.query.order_by(ProductRequest.created_at.desc(), ProductRequest.id.desc())
    if status:
        query = query.filter(ProductRequest.status == status)
    return query.all()


def create_product_service(name, unit, default_sale_price=0, request_id=None):
    name = require_text(name, "Tên sản phẩm", max_length=255)
    unit = require_text(unit, "Đơn vị tính", max_length=50)
    price = validate_money_amount(
        default_sale_price if default_sale_price not in (None, "") else 0,
        "Giá bán mặc định",
        allow_zero=False,
    )

    if Product.query.filter(func.lower(Product.name) == name.lower()).first():
        raise ValidationError("Tên sản phẩm đã tồn tại")

    request = None
    if request_id not in (None, ""):
        try:
            request = ProductRequest.query.get(int(request_id))
        except (TypeError, ValueError):
            raise ValidationError("Yêu cầu sản phẩm không hợp lệ")
        if not request:
            raise NotFoundError("Yêu cầu sản phẩm không tồn tại")
        if request.status != ProductRequestStatus.PENDING.value:
            raise ValidationError("Yêu cầu sản phẩm này đã được xử lý")

    product = Product(
        name=name,
        unit=unit,
        default_sale_price=price,
    )
    db.session.add(product)
    db.session.flush()

    if request:
        request.status = ProductRequestStatus.COMPLETED.value
        request.resolved_product_id = product.id
        request.resolved_at = datetime.now()

    db.session.commit()
    return product, request


def update_product_service(product_id, name, unit, default_sale_price=0):
    product = Product.query.get(product_id)
    if not product:
        raise NotFoundError("Sản phẩm không tồn tại")

    name = require_text(name, "Tên sản phẩm", max_length=255)
    unit = require_text(unit, "Đơn vị tính", max_length=50)
    price = validate_money_amount(
        default_sale_price if default_sale_price not in (None, "") else 0,
        "Giá bán mặc định",
        allow_zero=False,
    )

    duplicate = Product.query.filter(
        func.lower(Product.name) == name.lower(),
        Product.id != product.id,
    ).first()
    if duplicate:
        raise ValidationError("Tên sản phẩm đã tồn tại")

    product.name = name
    product.unit = unit
    product.default_sale_price = price
    db.session.commit()
    return product
