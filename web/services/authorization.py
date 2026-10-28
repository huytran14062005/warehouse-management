from sqlalchemy import func

from web import app
from web.models import Employee, EmployeeRole, Warehouse
from web.services.exceptions import ForbiddenError, NotFoundError, ValidationError


CENTRAL_WAREHOUSE_NAME = "Kho trung tâm"


def get_central_warehouse():
    """Return the single warehouse used as the source for employee stock."""
    warehouses = (
        Warehouse.query
        .filter(func.lower(func.trim(Warehouse.name)) == CENTRAL_WAREHOUSE_NAME.lower())
        .order_by(Warehouse.id.asc())
        .all()
    )
    if not warehouses:
        raise ValidationError("Chưa cấu hình kho trung tâm để cấp hàng cho nhân viên")
    if len(warehouses) > 1:
        raise ValidationError("Có nhiều kho trung tâm; cần giữ lại đúng một kho trung tâm")
    return warehouses[0]


def scoped_central_warehouse_id(employee_id):
    """Return the central warehouse after applying the caller's access check."""
    warehouse = get_central_warehouse()
    ensure_warehouse_access(employee_id, warehouse.id)
    return warehouse.id


def get_employee_or_404(employee_id):
    employee = Employee.query.get(employee_id)
    if not employee:
        raise NotFoundError("Nhân viên không tồn tại")
    return employee


def ensure_warehouse_access(employee_id, warehouse_id):
    """Keep warehouse-scoped operations inside the employee's assigned scope.

    Managers and accountants are intentionally cross-warehouse roles. A stock
    keeper without an assignment may operate the only warehouse; once a second
    warehouse exists, an assignment becomes mandatory.
    """
    employee = get_employee_or_404(employee_id)
    warehouse = Warehouse.query.get(warehouse_id)
    if not warehouse:
        raise NotFoundError("Kho không tồn tại")

    if employee.role in {EmployeeRole.QUAN_LY, EmployeeRole.KE_TOAN}:
        return warehouse

    if employee.role in {EmployeeRole.THU_KHO, EmployeeRole.NHAN_VIEN_BAN_HANG}:
        if employee.warehouse_id is not None and employee.warehouse_id != warehouse_id:
            raise ForbiddenError("Bạn không có quyền thao tác trên kho này")
        if employee.warehouse_id is None and Warehouse.query.count() > 1:
            raise ForbiddenError("Tài khoản thủ kho chưa được phân công kho")

    return warehouse


def scoped_warehouse_id(employee_id, requested_id=None):
    """Return a safe warehouse filter for list/report endpoints."""
    employee = get_employee_or_404(employee_id)
    if requested_id not in (None, ""):
        try:
            requested_id = int(requested_id)
        except (TypeError, ValueError):
            from web.services.exceptions import ValidationError
            raise ValidationError("Mã kho không hợp lệ")
        ensure_warehouse_access(employee_id, requested_id)
        return requested_id

    if employee.role in {EmployeeRole.QUAN_LY, EmployeeRole.KE_TOAN}:
        return None
    if employee.warehouse_id is not None:
        return employee.warehouse_id
    warehouses = Warehouse.query.order_by(Warehouse.id.asc()).all()
    if len(warehouses) > 1:
        raise ForbiddenError("Tài khoản chưa được phân công kho")
    return warehouses[0].id if warehouses else None


def resolve_document_warehouse(employee_id, requested_id=None):
    """Resolve a document's warehouse without guessing by database order.

    A caller may provide an explicit warehouse id. When it does not, a
    warehouse-scoped employee must have an assignment; a manager defaults to
    the single configured central warehouse. There is deliberately no
    ``first warehouse`` fallback because that can silently put stock in the
    wrong warehouse after another warehouse is added.
    """
    employee = get_employee_or_404(employee_id)

    if requested_id not in (None, ""):
        try:
            requested_id = int(requested_id)
        except (TypeError, ValueError):
            raise ValidationError("Mã kho không hợp lệ")
        return ensure_warehouse_access(employee_id, requested_id)

    if employee.warehouse_id is not None:
        return ensure_warehouse_access(employee_id, employee.warehouse_id)

    if employee.role == EmployeeRole.QUAN_LY:
        warehouse = get_central_warehouse()
        ensure_warehouse_access(employee_id, warehouse.id)
        return warehouse

    raise ForbiddenError("Tài khoản chưa được phân công kho")


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
