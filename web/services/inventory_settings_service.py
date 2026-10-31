from decimal import Decimal, InvalidOperation

from sqlalchemy import inspect
from sqlalchemy.orm import Session

from web import db
from web.models import EmployeeRole, InventorySetting
from web.services.authorization import get_employee_or_404
from web.services.exceptions import ForbiddenError, ValidationError
from web.utils.query_cache import cached_query


DEFAULT_LOW_STOCK_PERCENTAGE = Decimal("25")
SETTINGS_ROW_ID = 1


def get_low_stock_percentage():
    return Decimal(cached_query("inventory-threshold", {}, 300, _load_low_stock_percentage))


def _load_low_stock_percentage():
    # Existing databases gain this table on the first manager update. Until
    # then, preserve the previous 25% behavior without requiring a reset.
    if not inspect(db.engine).has_table(InventorySetting.__tablename__):
        return str(DEFAULT_LOW_STOCK_PERCENTAGE)
    setting = db.session.get(InventorySetting, SETTINGS_ROW_ID)
    return str(setting.low_stock_percentage) if setting else str(DEFAULT_LOW_STOCK_PERCENTAGE)


def update_low_stock_percentage(employee_id, value):
    employee = get_employee_or_404(employee_id)
    if employee.role != EmployeeRole.QUAN_LY:
        raise ForbiddenError("Chỉ quản lý được chỉnh ngưỡng sắp hết hàng")
    try:
        if isinstance(value, bool):
            raise InvalidOperation
        percentage = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        raise ValidationError("Tỷ lệ sắp hết hàng không hợp lệ")
    if not percentage.is_finite() or not Decimal("1") <= percentage <= Decimal("100"):
        raise ValidationError("Tỷ lệ sắp hết hàng phải từ 1% đến 100%")
    if percentage.as_tuple().exponent < -2:
        raise ValidationError("Tỷ lệ sắp hết hàng chỉ được có tối đa 2 chữ số thập phân")

    # MySQL DDL invalidates the transaction opened by the authentication
    # lookup. Use a fresh session after the table is created so the first
    # update sees the new schema instead of raising error 1412.
    InventorySetting.__table__.create(bind=db.engine, checkfirst=True)
    with Session(db.engine) as settings_session:
        setting = settings_session.get(InventorySetting, SETTINGS_ROW_ID)
        if setting is None:
            setting = InventorySetting(id=SETTINGS_ROW_ID, low_stock_percentage=percentage)
            settings_session.add(setting)
        else:
            setting.low_stock_percentage = percentage
        settings_session.commit()
    return percentage
