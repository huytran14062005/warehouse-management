"""Product-specific units; transaction quantities are stored in the base unit."""

from decimal import Decimal, InvalidOperation

from web.services.exceptions import ValidationError


MAX_QUANTITY = Decimal("999999999999999.999")


def positive_quantity(value, label="Số lượng"):
    try:
        quantity = Decimal(str(value))
    except (TypeError, ValueError, InvalidOperation):
        raise ValidationError(f"{label} không hợp lệ")
    if (not quantity.is_finite() or quantity <= 0 or quantity > MAX_QUANTITY
            or quantity.as_tuple().exponent < -3):
        raise ValidationError(f"{label} phải lớn hơn 0 và có tối đa 3 chữ số thập phân")
    return quantity


def validate_conversions(value, base_unit):
    if value in (None, ""):
        return {}
    if not isinstance(value, dict) or len(value) > 20:
        raise ValidationError("Danh sách quy đổi đơn vị không hợp lệ")
    result = {}
    for unit, factor in value.items():
        unit = str(unit).strip()
        if not unit or len(unit) > 50 or unit.casefold() == base_unit.casefold():
            raise ValidationError("Tên đơn vị quy đổi không hợp lệ hoặc trùng đơn vị cơ sở")
        quantity = positive_quantity(factor, f"Quy cách {unit}")
        if quantity <= 1:
            raise ValidationError("Đơn vị đóng gói phải lớn hơn 1 đơn vị cơ sở")
        if unit.casefold() in (name.casefold() for name in result):
            raise ValidationError("Đơn vị quy đổi bị trùng")
        result[unit] = str(quantity)
    return result


def to_base_quantity(product, quantity_value, entered_unit=None):
    entered_unit = str(entered_unit or product.unit).strip()
    quantity = positive_quantity(quantity_value)
    if entered_unit == product.unit:
        factor = Decimal("1")
    else:
        factor_value = (product.unit_conversions or {}).get(entered_unit)
        if factor_value is None:
            raise ValidationError(f"Đơn vị '{entered_unit}' chưa có quy đổi cho '{product.name}'")
        factor = positive_quantity(factor_value, "Hệ số quy đổi")
    base_quantity = quantity * factor
    if base_quantity > MAX_QUANTITY or base_quantity.as_tuple().exponent < -3:
        raise ValidationError("Số lượng sau quy đổi vượt giới hạn hoặc quá 3 chữ số thập phân")
    return base_quantity, entered_unit, quantity
