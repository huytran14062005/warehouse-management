from uuid import uuid4

from sqlalchemy import func
from sqlalchemy.exc import IntegrityError

from web import dao, db
from web.models import SalesArea
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


def create_sales_area_service(value):
    if not isinstance(value, str):
        raise ValidationError("Tên khu vực bán hàng không hợp lệ")
    name = " ".join(value.split())
    if not name or len(name) > 120:
        raise ValidationError("Tên khu vực bán hàng phải có từ 1 đến 120 ký tự")
    if db.session.query(SalesArea.id).filter(func.lower(SalesArea.name) == name.lower()).first():
        raise ValidationError("Khu vực bán hàng đã tồn tại", status_code=409)

    area = SalesArea(code=f"custom_{uuid4().hex}", name=name, is_active=True)
    try:
        db.session.add(area)
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        raise ValidationError("Khu vực bán hàng đã tồn tại hoặc không thể lưu", status_code=409)
    return area
