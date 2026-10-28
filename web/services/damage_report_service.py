from web import app
from web.dao import damage_report_dao, product_dao
from web.models import (
    DamageReportStatus,
    Employee,
    Product,
    Warehouse,
)
from web.services.exceptions import NotFoundError, ValidationError
from web.services.authorization import ensure_bounded_items, ensure_warehouse_access


def _positive_integer(value, field_name):
    try:
        if isinstance(value, bool):
            raise ValueError
        parsed = int(value)
    except (TypeError, ValueError):
        raise ValidationError(f"{field_name} không hợp lệ")
    if parsed <= 0:
        raise ValidationError(f"{field_name} phải lớn hơn 0")
    return parsed


def _positive_number(value, field_name):
    try:
        if isinstance(value, bool):
            raise ValueError
        parsed = int(value)
    except (TypeError, ValueError):
        raise ValidationError(f"{field_name} không hợp lệ")
    if float(value) != parsed or parsed <= 0:
        raise ValidationError(f"{field_name} phải lớn hơn 0")
    return parsed


def _parse_page(value, default):
    try:
        parsed = int(value) if value is not None else default
    except (TypeError, ValueError):
        parsed = default
    return max(parsed, 1)


def _parse_status(value):
    if not value:
        return None
    normalized = str(value).strip().lower()
    for status in DamageReportStatus:
        if normalized in {status.name.lower(), status.value.lower()}:
            return status
    raise ValidationError("Trạng thái phiếu hàng hư không hợp lệ")


def serialize_damage_report(report):
    return {
        "id": report.id,
        "warehouse": {
            "id": report.warehouse.id,
            "name": report.warehouse.name,
            "address": report.warehouse.address,
        },
        "reported_by": {
            "id": report.reported_by_employee.id,
            "full_name": report.reported_by_employee.full_name,
        },
        "reviewed_by": (
            {
                "id": report.reviewed_by_employee.id,
                "full_name": report.reviewed_by_employee.full_name,
            }
            if report.reviewed_by_employee
            else None
        ),
        "status": report.status.value,
        "note": report.note,
        "review_note": report.review_note,
        "reported_at": report.reported_at.isoformat() if report.reported_at else None,
        "reviewed_at": report.reviewed_at.isoformat() if report.reviewed_at else None,
        "items": [
            {
                "id": item.id,
                "product_id": item.product_id,
                "product_name": item.product.name,
                "unit": item.product.unit,
                "quantity": int(item.quantity),
                "damage_reason": item.damage_reason,
            }
            for item in report.items
        ],
    }


def _validate_items(items, warehouse_id):
    ensure_bounded_items(items, "Sản phẩm trong phiếu hàng hư")
    if not isinstance(items, list) or not items:
        raise ValidationError("Phiếu hàng hư phải có ít nhất một sản phẩm")

    validated_items = []
    product_ids = []
    seen_product_ids = set()
    for index, raw_item in enumerate(items, start=1):
        if not isinstance(raw_item, dict):
            raise ValidationError(f"Sản phẩm thứ {index} không hợp lệ")
        product_id = _positive_integer(
            raw_item.get("product_id"),
            f"Mã sản phẩm thứ {index}",
        )
        if product_id in seen_product_ids:
            raise ValidationError(f"Sản phẩm ID {product_id} bị lặp trong cùng một phiếu")
        seen_product_ids.add(product_id)
        product_ids.append(product_id)
        validated_items.append({
            "product_id": product_id,
            "quantity": _positive_number(
                raw_item.get("quantity"),
                f"Số lượng sản phẩm thứ {index}",
            ),
            "damage_reason": str(raw_item.get("damage_reason") or "").strip() or None,
        })

    products = Product.query.filter(Product.id.in_(product_ids)).all()
    products_by_id = {product.id: product for product in products}
    missing_product_ids = [product_id for product_id in product_ids if product_id not in products_by_id]
    if missing_product_ids:
        raise NotFoundError(f"Sản phẩm ID {missing_product_ids[0]} không tồn tại")

    stock_by_product = product_dao.calculate_available_stock_for_items_at_warehouse(
        product_ids,
        warehouse_id,
    )
    for item in validated_items:
        product = products_by_id[item["product_id"]]
        stock = stock_by_product[item["product_id"]]
        available_stock = max(
            0,
            stock["available_stock"],
        )
        if item["quantity"] > available_stock:
            raise ValidationError(
                f"Sản phẩm '{product.name}' chỉ còn {available_stock} trong kho, "
                f"không thể báo hư {item['quantity']}"
            )

    return validated_items

def create_damage_report_service(reported_by_employee_id, warehouse_id, note, items):
    warehouse_id = _positive_integer(warehouse_id, "Mã kho") if warehouse_id not in (None, "") else None
    warehouse = Warehouse.query.get(warehouse_id) if warehouse_id else Warehouse.query.order_by(Warehouse.id.asc()).first()
    if not warehouse:
        raise NotFoundError("Kho không tồn tại")
    warehouse_id = warehouse.id
    ensure_warehouse_access(reported_by_employee_id, warehouse_id)

    if not Employee.query.get(reported_by_employee_id):
        raise NotFoundError("Nhân viên không tồn tại")

    validated_items = _validate_items(items, warehouse_id)
    return damage_report_dao.create_damage_report(
        warehouse_id=warehouse_id,
        reported_by_employee_id=reported_by_employee_id,
        note=str(note or "").strip() or None,
        items=validated_items,
    )


def get_damage_reports_service(page_value, per_page_value, status_value, warehouse_id_value):
    page = _parse_page(page_value, 1)
    per_page = min(_parse_page(per_page_value, 10), app.config.get("MAX_PAGE_SIZE", 100))
    status = _parse_status(status_value)
    warehouse_id = None
    if warehouse_id_value:
        warehouse_id = _positive_integer(warehouse_id_value, "Mã kho")
        if not Warehouse.query.get(warehouse_id):
            raise NotFoundError("Kho không tồn tại")

    reports, total = damage_report_dao.get_damage_reports(
        page=page,
        per_page=per_page,
        status=status,
        warehouse_id=warehouse_id,
    )
    return reports, total, page, per_page


def get_damage_report_detail_service(report_id):
    report = damage_report_dao.get_damage_report_by_id(report_id)
    if not report:
        raise NotFoundError("Phiếu hàng hư không tồn tại")
    return report


def review_damage_report_service(report_id, manager_id, decision, review_note):
    report = get_damage_report_detail_service(report_id)
    if report.status != DamageReportStatus.PENDING:
        raise ValidationError("Chỉ phiếu đang chờ duyệt mới được xử lý")

    normalized_decision = str(decision or "").strip().lower()
    if normalized_decision not in {DamageReportStatus.APPROVED.value, DamageReportStatus.REJECTED.value}:
        raise ValidationError("Quyết định phải là approved hoặc rejected")

    review_note = str(review_note or "").strip() or None
    if normalized_decision == DamageReportStatus.REJECTED.value and not review_note:
        raise ValidationError("Phải ghi lý do khi từ chối phiếu hàng hư")

    if not Employee.query.get(manager_id):
        raise NotFoundError("Quản lý không tồn tại")

    if normalized_decision == DamageReportStatus.APPROVED.value:
        Warehouse.query.filter(Warehouse.id == report.warehouse_id).with_for_update().one()
        stock_by_product = product_dao.calculate_available_stock_for_items_at_warehouse(
            [item.product_id for item in report.items],
            report.warehouse_id,
        )
        for item in report.items:
            stock = stock_by_product[item.product_id]
            available_stock = max(
                0,
                stock["available_stock"],
            )
            if float(item.quantity) > available_stock:
                raise ValidationError(
                    f"Không thể duyệt: sản phẩm '{item.product.name}' chỉ còn "
                    f"{available_stock} trong kho"
                )

    return damage_report_dao.review_damage_report(
        report=report,
        manager_id=manager_id,
        status=DamageReportStatus.APPROVED
        if normalized_decision == DamageReportStatus.APPROVED.value
        else DamageReportStatus.REJECTED,
        review_note=review_note,
    )
