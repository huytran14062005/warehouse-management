from sqlalchemy import func

from web import app
from web.models import Employee, EmployeeRole, Warehouse
from web.services.exceptions import ForbiddenError, NotFoundError, ValidationError


CENTRAL_WAREHOUSE_NAME = "Kho trung tâm"


def get_central_warehouse():
    warehouses = (
        Warehouse.query
        .filter(func.lower(func.trim(Warehouse.name)) == CENTRAL_WAREHOUSE_NAME.lower())
        .order_by(Warehouse.id.asc())
        .all()
    )
    if not warehouses:
        raise ValidationError("Chưa cấu hình kho trung tâm")
    if len(warehouses) > 1:
        raise ValidationError("Có nhiều kho trung tâm; cần giữ lại đúng một kho trung tâm")
    return warehouses[0]


def ensure_central_warehouse(requested_id=None):
    warehouse = get_central_warehouse()
    if requested_id not in (None, ""):
        try:
            requested_id = int(requested_id)
        except (TypeError, ValueError):
            raise ValidationError("Mã kho không hợp lệ")
        if requested_id != warehouse.id:
            raise ValidationError("Hệ thống chỉ sử dụng kho trung tâm")
    return warehouse


def scoped_central_warehouse_id(employee_id):
    """Return the central warehouse after applying the caller's access check."""
    warehouse = ensure_central_warehouse()
    ensure_warehouse_access(employee_id, warehouse.id)
    return warehouse.id


def get_employee_or_404(employee_id):
    employee = Employee.query.get(employee_id)
    if not employee:
        raise NotFoundError("Nhân viên không tồn tại")
    return employee


def get_accessible_warehouses(employee_id):
    """Return warehouses the current role may select in an operation form."""
    get_employee_or_404(employee_id)
    return Warehouse.query.order_by(Warehouse.id.asc()).all()


def ensure_warehouse_access(employee_id, warehouse_id):
    """Validate the selected warehouse for a role-authorized operation."""
    get_employee_or_404(employee_id)
    warehouse = Warehouse.query.get(warehouse_id)
    if not warehouse:
        raise NotFoundError("Kho không tồn tại")
    return warehouse


def scoped_warehouse_id(employee_id, requested_id=None):
    """Return a safe warehouse filter for list/report endpoints."""
    get_employee_or_404(employee_id)
    if requested_id not in (None, ""):
        try:
            requested_id = int(requested_id)
        except (TypeError, ValueError):
            from web.services.exceptions import ValidationError
            raise ValidationError("Mã kho không hợp lệ")
        ensure_warehouse_access(employee_id, requested_id)
        return requested_id

    return None


def resolve_document_warehouse(employee_id, requested_id=None):
    """Use the selected warehouse, defaulting to the configured central one."""
    get_employee_or_404(employee_id)
    if requested_id not in (None, ""):
        try:
            requested_id = int(requested_id)
        except (TypeError, ValueError):
            raise ValidationError("Mã kho không hợp lệ")
        return ensure_warehouse_access(employee_id, requested_id)

    warehouse = get_central_warehouse()
    return ensure_warehouse_access(employee_id, warehouse.id)


def ensure_bounded_items(items, label="danh sách sản phẩm"):
    if not isinstance(items, list):
        return
    max_items = app.config.get("MAX_ITEMS_PER_DOCUMENT", 100)
    if len(items) > max_items:
        from web.services.exceptions import ValidationError
        raise ValidationError(f"{label} không được vượt quá {max_items} dòng")


def ensure_invoice_owner(invoice, employee_id):
    employee = get_employee_or_404(employee_id)
    if employee.role == EmployeeRole.NHAN_VIEN_BAN_HANG and invoice.employee_id != employee_id:
        raise ForbiddenError("Nhân viên bán hàng chỉ được thao tác trên đơn do mình tạo")
    return employee
