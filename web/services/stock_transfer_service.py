import math

from sqlalchemy import func
from sqlalchemy.orm import selectinload

from web import app, dao, db
from web.models import Employee, EmployeeRole, EmployeeStock, Product, StockTransfer, StockTransferItem, Warehouse
from web.services.exceptions import NotFoundError, ValidationError
from web.services.authorization import ensure_bounded_items, ensure_warehouse_access


def _parse_positive_int(value, default):
    try:
        number = int(value)
        return number if number > 0 else default
    except (TypeError, ValueError):
        return default


def get_stock_transfers_list_service(page_value=None, per_page_value=None, warehouse_id=None):
    page = _parse_positive_int(page_value, 1)
    per_page = min(_parse_positive_int(
        per_page_value,
        app.config.get("APPLICATION_SIZE", 10),
    ), app.config.get("MAX_PAGE_SIZE", 100))
    filters = []
    if warehouse_id:
        filters.append(StockTransfer.warehouse_id == warehouse_id)

    total = StockTransfer.query.filter(*filters).count()
    item_summary = (
        db.session.query(
            StockTransferItem.stock_transfer_id.label("transfer_id"),
            func.count(StockTransferItem.id).label("items_count"),
            func.coalesce(func.sum(StockTransferItem.quantity), 0).label("total_quantity"),
        )
        .group_by(StockTransferItem.stock_transfer_id)
        .subquery()
    )
    rows = (
        db.session.query(
            StockTransfer,
            func.coalesce(item_summary.c.items_count, 0).label("items_count"),
            func.coalesce(item_summary.c.total_quantity, 0).label("total_quantity"),
        )
        .outerjoin(item_summary, item_summary.c.transfer_id == StockTransfer.id)
        .options(
            selectinload(StockTransfer.recipient_employee),
            selectinload(StockTransfer.created_by_employee),
        )
        .filter(*filters)
        .order_by(StockTransfer.transferred_at.desc(), StockTransfer.id.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )
    return rows, total, page, per_page


def serialize_stock_transfer_summary(transfer, items_count, total_quantity):
    return {
        "id": transfer.id,
        "transferred_at": transfer.transferred_at.isoformat() if transfer.transferred_at else None,
        "employee_name": transfer.recipient_employee.full_name,
        "created_by": transfer.created_by_employee.full_name,
        "items_count": int(items_count or 0),
        "total_quantity": int(total_quantity or 0),
        "note": transfer.note,
    }


def get_stock_transfer_detail_service(transfer_id, page_value=None, per_page_value=None, keyword=None):
    transfer = (
        StockTransfer.query
        .options(
            selectinload(StockTransfer.recipient_employee),
            selectinload(StockTransfer.created_by_employee),
        )
        .get(transfer_id)
    )
    if not transfer:
        raise NotFoundError("Phiếu điều chuyển không tồn tại")

    page = _parse_positive_int(page_value, 1)
    per_page = min(_parse_positive_int(per_page_value, app.config.get("APPLICATION_SIZE", 10)), app.config.get("MAX_PAGE_SIZE", 100))
    query = (
        StockTransferItem.query
        .options(selectinload(StockTransferItem.product))
        .filter(StockTransferItem.stock_transfer_id == transfer.id)
    )
    all_items_count = query.count()
    clean_keyword = str(keyword or "").strip()
    if clean_keyword:
        query = query.join(StockTransferItem.product).filter(Product.name.ilike(f"%{clean_keyword}%"))

    total = query.count()
    total_quantity = (
        db.session.query(func.coalesce(func.sum(StockTransferItem.quantity), 0))
        .filter(StockTransferItem.stock_transfer_id == transfer.id)
        .scalar()
        or 0
    )
    items = query.order_by(StockTransferItem.id.asc()).offset((page - 1) * per_page).limit(per_page).all()
    product_ids = [item.product_id for item in items]
    remaining_rows = EmployeeStock.query.filter(
        EmployeeStock.employee_id == transfer.employee_id,
        EmployeeStock.product_id.in_(product_ids),
    ).all() if product_ids else []
    remaining_by_product = {row.product_id: int(row.quantity or 0) for row in remaining_rows}
    return transfer, items, total, all_items_count, total_quantity, remaining_by_product, page, per_page


def serialize_stock_transfer(transfer, items=None, items_count=None, total_quantity=None, remaining_by_product=None):
    detail_items = list(transfer.items if items is None else items)
    remaining_by_product = remaining_by_product or {}
    return {
        "id": transfer.id,
        "transferred_at": transfer.transferred_at.isoformat() if transfer.transferred_at else None,
        "employee_name": transfer.recipient_employee.full_name,
        "created_by": transfer.created_by_employee.full_name,
        "total_quantity": int(total_quantity if total_quantity is not None else sum(int(item.quantity) for item in detail_items)),
        "items_count": int(items_count if items_count is not None else len(detail_items)),
        "note": transfer.note,
        "items": [
            {
                "product_id": item.product_id,
                "product_name": item.product.name,
                "quantity": int(item.quantity),
                "transferred_quantity": int(item.quantity),
                "remaining_quantity": int(remaining_by_product.get(item.product_id, 0)),
                "unit": item.product.unit,
            }
            for item in detail_items
        ],
    }


def _positive_number(value, field_name):
    try:
        if isinstance(value, bool):
            raise ValueError
        number = int(value)
    except (TypeError, ValueError):
        raise ValidationError(f"{field_name} không hợp lệ")
    if float(value) != number or number <= 0:
        raise ValidationError(f"{field_name} phải lớn hơn 0")
    return number


def _positive_integer(value, field_name):
    try:
        if isinstance(value, bool):
            raise ValueError
        number = int(value)
    except (TypeError, ValueError):
        raise ValidationError(f"{field_name} không hợp lệ")
    if number <= 0:
        raise ValidationError(f"{field_name} phải lớn hơn 0")
    return number


def _normalize_transfer_items(items):
    ensure_bounded_items(items, "Sản phẩm cấp hàng")
    if not isinstance(items, list) or not items:
        raise ValidationError("Vui lòng thêm ít nhất một sản phẩm để điều chuyển")

    normalized = []
    product_ids = []
    seen_ids = set()
    for index, item in enumerate(items, start=1):
        if not isinstance(item, dict):
            raise ValidationError(f"Sản phẩm thứ {index} không hợp lệ")
        product_id = _positive_integer(item.get("product_id"), f"Mã sản phẩm thứ {index}")
        if product_id in seen_ids:
            raise ValidationError("Mỗi sản phẩm chỉ được xuất hiện một lần")
        seen_ids.add(product_id)
        product_ids.append(product_id)
        normalized.append({
            "product_id": product_id,
            "quantity": _positive_number(item.get("quantity"), f"Số lượng sản phẩm thứ {index}"),
        })

    products = Product.query.filter(Product.id.in_(product_ids)).all()
    product_by_id = {product.id: product for product in products}
    missing = [product_id for product_id in product_ids if product_id not in product_by_id]
    if missing:
        raise NotFoundError(f"Sản phẩm có mã {missing[0]} không tồn tại")
    for item in normalized:
        item["product_name"] = product_by_id[item["product_id"]].name
    return normalized


def serialize_employee_stock(employee_id, page_value=None, per_page_value=None):
    employee = Employee.query.get(employee_id)
    if not employee:
        raise NotFoundError("Nhân viên không tồn tại")

    page = _parse_positive_int(page_value, 1)
    per_page = min(_parse_positive_int(per_page_value, app.config.get("APPLICATION_SIZE", 10)), app.config.get("MAX_PAGE_SIZE", 100))
    rows, total, total_quantity = dao.get_employee_stock_list(employee_id, page=page, per_page=per_page)
    return {
        "employee": {
            "id": employee.id,
            "full_name": employee.full_name,
            "phone": employee.phone,
        },
        "products": [
            {
                "id": row["product"].id,
                "name": row["product"].name,
                "unit": row["product"].unit,
                "default_sale_price": float(row["product"].default_sale_price),
                "quantity": int(row["quantity"]),
            }
            for row in rows
        ],
        "pagination": {
            "page": page,
            "per_page": per_page,
            "total": total,
            "total_pages": math.ceil(total / per_page) if per_page else 0,
        },
        "total_quantity": total_quantity,
    }


def get_sales_employees_service(warehouse_id=None):
    query = (
        Employee.query
        .filter(
            Employee.role == EmployeeRole.NHAN_VIEN_BAN_HANG,
            Employee.is_locked.is_(False),
            Employee.is_approved.is_(True),
        )
    )
    if warehouse_id is not None:
        query = query.filter(Employee.warehouse_id == warehouse_id)
    employees = query.order_by(Employee.full_name.asc()).all()
    return [
        {"id": employee.id, "full_name": employee.full_name, "phone": employee.phone}
        for employee in employees
    ]


def create_stock_transfer_service(created_by_employee_id, employee_id, warehouse_id, items, note=""):
    employee_id = _positive_integer(employee_id, "Mã nhân viên")
    recipient = Employee.query.get(employee_id)
    if recipient is not None and (recipient.is_locked or not recipient.is_approved):
        raise ValidationError("Tài khoản người nhận chưa được duyệt hoặc đang bị khóa")
    if not recipient:
        raise NotFoundError("Nhân viên nhận hàng không tồn tại")
    if recipient.role != EmployeeRole.NHAN_VIEN_BAN_HANG:
        raise ValidationError("Chỉ được cấp hàng cho nhân viên bán hàng")

    warehouse = Warehouse.query.order_by(Warehouse.id.asc()).first() if warehouse_id in (None, "") else Warehouse.query.get(_positive_integer(warehouse_id, "Mã kho"))
    if not warehouse:
        raise NotFoundError("Kho không tồn tại")

    ensure_warehouse_access(created_by_employee_id, warehouse.id)
    if recipient.warehouse_id is not None and recipient.warehouse_id != warehouse.id:
        raise ValidationError("NhÃ¢n viÃªn nháº­n hÃ ng khÃ´ng thuá»™c kho Ä‘ang cáº¥p")
    normalized = _normalize_transfer_items(items)
    product_ids = [item["product_id"] for item in normalized]
    product_names = {item["product_id"]: item["product_name"] for item in normalized}

    try:
        Warehouse.query.filter(Warehouse.id == warehouse.id).with_for_update().one()
        warehouse_stock = dao.calculate_stock_for_items_at_warehouse(product_ids, warehouse.id)
        for item in normalized:
            available = warehouse_stock[item["product_id"]]["available_stock"]
            if available < item["quantity"]:
                raise ValidationError(
                    f"Sản phẩm '{product_names[item['product_id']]}' không đủ tồn kho."
                )

        transfer = StockTransfer(
            warehouse_id=warehouse.id,
            employee_id=recipient.id,
            created_by_employee_id=created_by_employee_id,
            note=str(note or "").strip() or None,
        )
        db.session.add(transfer)
        db.session.flush()

        locked_stocks = dao.get_employee_stock_map(
            recipient.id,
            product_ids=product_ids,
            for_update=True,
        )
        for item in normalized:
            stock = locked_stocks.get(item["product_id"])
            if stock is None:
                stock = dao.get_or_create_employee_stock(recipient.id, item["product_id"])
            stock.quantity = int(stock.quantity) + item["quantity"]
            db.session.add(
                StockTransferItem(
                    stock_transfer_id=transfer.id,
                    product_id=item["product_id"],
                    quantity=item["quantity"],
                )
            )

        db.session.commit()
        return transfer
    except ValidationError:
        db.session.rollback()
        raise
    except Exception as error:
        db.session.rollback()
        raise Exception(f"Lỗi cấp hàng cho nhân viên: {error}")
