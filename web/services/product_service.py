from decimal import Decimal, InvalidOperation
from datetime import datetime

from sqlalchemy import func
from sqlalchemy.orm import joinedload

from web import dao, db
from web.models import Employee, EmployeeRole, ImportInvoiceItem, OperatingExpense, Product, ProductRequest, ProductRequestStatus, SalesInvoiceItem
from web.services.exceptions import NotFoundError, ValidationError
from web.services.validators import require_text, validate_money_amount
from web.services.unit_conversion import validate_conversions


def _physical_measure(value, label):
    if value in (None, ""):
        return None
    try:
        result = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        raise ValidationError(f"{label} không hợp lệ")
    if not result.is_finite() or result <= 0 or result > Decimal("99999999999.999") or result.as_tuple().exponent < -3:
        raise ValidationError(f"{label} phải lớn hơn 0 và tối đa 3 chữ số thập phân")
    return result
from web.utils.pagination import parse_page, parse_per_page, parse_paging_args


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
        raise ValidationError(f"{field_name} không hợp lệ")

    if not price.is_finite() or price < 0:
        raise ValidationError(f"{field_name} không được âm")

    return price


def parse_price_range(min_price_value, max_price_value):
    min_price = parse_optional_price(min_price_value, "Giá từ")
    max_price = parse_optional_price(max_price_value, "Giá đến")

    if min_price is not None and max_price is not None and min_price > max_price:
        raise ValidationError("Giá từ không được lớn hơn giá đến")

    return min_price, max_price


def parse_inventory_status(value):
    if value is None or (isinstance(value, str) and not value.strip()):
        return None

    status = str(value).strip().lower()
    allowed_statuses = {"available", "low", "empty"}
    if status not in allowed_statuses:
        raise ValidationError("Trạng thái tồn kho không hợp lệ")
    return status


def serialize_product_inventory(product, inventory):
                                               
    return {
        "id": product.id,
        "name": product.name,
        "unit": product.unit,
        "unit_conversions": product.unit_conversions or {},
        "weight_per_unit": float(product.weight_per_unit) if product.weight_per_unit is not None else None,
        "volume_per_unit": float(product.volume_per_unit) if product.volume_per_unit is not None else None,
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
    query = ProductRequest.query.options(joinedload(ProductRequest.requested_by_employee)).order_by(
        ProductRequest.created_at.desc(), ProductRequest.id.desc(),
    )
    if status:
        query = query.filter(ProductRequest.status == status)
    return query.all()


def create_product_service(name, unit, default_sale_price=0, request_id=None, unit_conversions=None, weight_per_unit=None, volume_per_unit=None):
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
        unit_conversions=validate_conversions(unit_conversions, unit),
        weight_per_unit=_physical_measure(weight_per_unit, "Trọng lượng mỗi đơn vị"),
        volume_per_unit=_physical_measure(volume_per_unit, "Thể tích mỗi đơn vị"),
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


def update_product_service(product_id, name, unit, default_sale_price=0, unit_conversions=None, weight_per_unit=None, volume_per_unit=None):
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
    if unit != product.unit and (
        db.session.query(ImportInvoiceItem.id).filter_by(product_id=product_id).first() or
        db.session.query(SalesInvoiceItem.id).filter_by(product_id=product_id).first()
    ):
        raise ValidationError("Không thể đổi đơn vị cơ sở sau khi sản phẩm đã có nhập hoặc bán hàng")

    next_conversions = validate_conversions(unit_conversions, unit) if unit_conversions is not None else product.unit_conversions or {}
    if next_conversions != (product.unit_conversions or {}):
        used_import_units = db.session.query(ImportInvoiceItem.entered_unit).filter(
            ImportInvoiceItem.product_id == product_id, ImportInvoiceItem.entered_unit.isnot(None),
        ).distinct().all()
        used_sale_units = db.session.query(SalesInvoiceItem.entered_unit).filter(
            SalesInvoiceItem.product_id == product_id, SalesInvoiceItem.entered_unit.isnot(None),
        ).distinct().all()
        for (used_unit,) in used_import_units + used_sale_units:
            if used_unit != product.unit and next_conversions.get(used_unit) != (product.unit_conversions or {}).get(used_unit):
                raise ValidationError(f"Không thể đổi quy cách {used_unit} đã dùng trong phiếu nhập hoặc đơn bán")
    next_weight = _physical_measure(weight_per_unit, "Trọng lượng mỗi đơn vị") if weight_per_unit is not None else product.weight_per_unit
    next_volume = _physical_measure(volume_per_unit, "Thể tích mỗi đơn vị") if volume_per_unit is not None else product.volume_per_unit
    for basis, old, new in (("weight", product.weight_per_unit, next_weight),
                            ("volume", product.volume_per_unit, next_volume)):
        if old != new and db.session.query(OperatingExpense.id).join(
            SalesInvoiceItem, SalesInvoiceItem.sales_invoice_id == OperatingExpense.invoice_id,
        ).filter(SalesInvoiceItem.product_id == product_id,
                 OperatingExpense.allocation_basis == basis,
                 OperatingExpense.voided_at.is_(None)).first():
            raise ValidationError("Không thể đổi trọng lượng/thể tích đã dùng để phân bổ chi phí đơn")

    product.name = name
    product.unit = unit
    if unit_conversions is not None:
        product.unit_conversions = next_conversions
    if weight_per_unit is not None:
        product.weight_per_unit = next_weight
    if volume_per_unit is not None:
        product.volume_per_unit = next_volume
    product.default_sale_price = price
    db.session.commit()
    return product
