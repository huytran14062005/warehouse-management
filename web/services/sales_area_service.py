from web import dao
from web.services.exceptions import ValidationError


def resolve_sales_area_id(value, required=False):
    if value in (None, ""):
        if required:
            raise ValidationError("Vui lòng chọn khu vực bán hàng")
        return None
    try:
        area_id = int(value)
    except (TypeError, ValueError):
        raise ValidationError("Khu vực bán hàng không hợp lệ")
    if area_id <= 0 or not dao.get_sales_area_by_id(area_id):
        raise ValidationError("Khu vực bán hàng không tồn tại hoặc đã bị khóa")
    return area_id


def serialize_sales_area(area):
    return {"id": area.id, "code": area.code, "name": area.name}
