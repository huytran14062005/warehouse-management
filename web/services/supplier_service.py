from web import db
from web.models import EmployeeRole, Supplier
from web.services.authorization import get_employee_or_404
from web.services.exceptions import ForbiddenError, ValidationError
from web.services.validators import require_text


def get_or_create_supplier(name, address):
    name = require_text(name, "Tên nhà cung cấp", max_length=255)
    address = require_text(address, "Địa chỉ nhà cung cấp")
    supplier = Supplier.query.filter(
        Supplier.name == name,
        Supplier.address == address,
    ).first()
    if supplier is None:
        supplier = next((
            existing for existing in Supplier.query.all()
            if existing.name.strip().casefold() == name.casefold()
            and existing.address.strip().casefold() == address.casefold()
        ), None)
    if supplier:
        return supplier, False

    supplier = Supplier(name=name, address=address)
    db.session.add(supplier)
    db.session.flush()
    return supplier, True


def create_supplier_service(employee_id, name, address):
    employee = get_employee_or_404(employee_id)
    if employee.role != EmployeeRole.QUAN_LY:
        raise ForbiddenError("Chỉ quản lý được thêm nhà cung cấp mới")
    try:
        supplier, created = get_or_create_supplier(name, address)
        if not created:
            raise ValidationError("Nhà cung cấp này đã có trong danh sách")
        db.session.commit()
        return supplier
    except Exception:
        db.session.rollback()
        raise


def serialize_supplier(supplier):
    return {
        "id": supplier.id,
        "name": supplier.name,
        "address": supplier.address,
    }
