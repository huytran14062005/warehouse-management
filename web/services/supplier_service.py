from web import db
from web.models import EmployeeRole, ImportInvoice, Supplier, SupplierPayment
from web.services.authorization import get_employee_or_404
from web.services.exceptions import ForbiddenError, NotFoundError, ValidationError
from web.services.validators import require_text, validate_phone


def get_or_create_supplier(name, address, phone=None):
    name = require_text(name, "Tên nhà cung cấp", max_length=255)
    address = require_text(address, "Địa chỉ nhà cung cấp")
    phone = validate_phone(phone) if phone not in (None, "") else None
    supplier = Supplier.query.filter(
        Supplier.name == name,
        Supplier.address == address,
    ).first()
    if supplier is None:
        # Keep Python's Unicode casefold/strip matching and the existing query
        # order, but avoid materializing the entire supplier table at once.
        rows = iter(Supplier.query.yield_per(500))
        try:
            for existing in rows:
                if (existing.name.strip().casefold() == name.casefold()
                        and existing.address.strip().casefold() == address.casefold()):
                    supplier = existing
                    break
        finally:
            rows.close()
    if supplier:
        return supplier, False

    supplier = Supplier(name=name, phone=phone, address=address)
    db.session.add(supplier)
    db.session.flush()
    return supplier, True


def create_supplier_service(employee_id, name, phone, address):
    employee = get_employee_or_404(employee_id)
    if employee.role != EmployeeRole.QUAN_LY:
        raise ForbiddenError("Chỉ quản lý được thêm nhà cung cấp mới")
    phone = validate_phone(phone)
    try:
        supplier, created = get_or_create_supplier(name, address, phone)
        if not created:
            raise ValidationError("Nhà cung cấp này đã có trong danh sách")
        db.session.commit()
        return supplier
    except Exception:
        db.session.rollback()
        raise


def get_supplier_service(supplier_id):
    supplier = Supplier.query.get(supplier_id)
    if not supplier:
        raise NotFoundError("Nhà cung cấp không tồn tại")
    return supplier


def supplier_has_history(supplier_id):
    has_imports = db.session.query(ImportInvoice.id).filter_by(supplier_id=supplier_id).first()
    if has_imports:
        return True
    return db.session.query(SupplierPayment.id).filter_by(supplier_id=supplier_id).first() is not None


def update_supplier_service(supplier_id, employee_id, name, phone, address):
    employee = get_employee_or_404(employee_id)
    if employee.role != EmployeeRole.QUAN_LY:
        raise ForbiddenError("Chỉ quản lý được sửa nhà cung cấp")
    supplier = get_supplier_service(supplier_id)
    name = require_text(name, "Tên nhà cung cấp", max_length=255)
    phone = validate_phone(phone)
    address = require_text(address, "Địa chỉ nhà cung cấp")
    duplicate = Supplier.query.filter(
        Supplier.id != supplier_id,
        Supplier.name == name,
        Supplier.address == address,
    ).first()
    if duplicate:
        raise ValidationError("Nhà cung cấp này đã có trong danh sách")
    try:
        supplier.name = name
        supplier.phone = phone
        supplier.address = address
        db.session.commit()
        return supplier
    except Exception:
        db.session.rollback()
        raise


def delete_supplier_service(supplier_id, employee_id):
    employee = get_employee_or_404(employee_id)
    if employee.role != EmployeeRole.QUAN_LY:
        raise ForbiddenError("Chỉ quản lý được xóa nhà cung cấp")
    get_supplier_service(supplier_id)
    if supplier_has_history(supplier_id):
        raise ValidationError(
            "Không thể xóa nhà cung cấp đã có phiếu nhập hoặc thanh toán",
            status_code=409,
        )
    try:
        # Delete directly so SQLAlchemy does not try to clear restricted foreign keys.
        Supplier.query.filter_by(id=supplier_id).delete(synchronize_session=False)
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise


def serialize_supplier(supplier):
    return {
        "id": supplier.id,
        "name": supplier.name,
        "phone": supplier.phone,
        "address": supplier.address,
    }
