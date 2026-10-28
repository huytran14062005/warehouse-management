from datetime import datetime, time, timedelta
from web.dao import reports_dao
from web.models import Warehouse
from web.services.authorization import ensure_central_warehouse
from web.services.exceptions import NotFoundError, ValidationError


def parse_date(value):
                                         
    if not value:
        return None
    try:
        return datetime.strptime(str(value).strip(), "%Y-%m-%d")
    except (ValueError, TypeError):
        raise ValidationError(f"Ngày không hợp lệ: {value}. Định dạng đúng: YYYY-MM-DD")


def validate_positive_integer(value, field_name):
                                  
    if not value:
        return None
    try:
        num = int(value)
        if num <= 0:
            raise ValidationError(f"{field_name} phải lớn hơn 0")
        return num
    except (ValueError, TypeError):
        raise ValidationError(f"{field_name} không hợp lệ")


def get_inventory_report_service(warehouse_id_value, product_id_value, keyword):
       
    warehouse_id = validate_positive_integer(warehouse_id_value, "Mã kho")
    product_id = validate_positive_integer(product_id_value, "Mã sản phẩm")
    keyword = str(keyword or '').strip() or None
    
                                                
    if warehouse_id:
        warehouse = Warehouse.query.get(warehouse_id)
        if not warehouse:
            raise NotFoundError("Kho không tồn tại")
    
    warehouse_id = ensure_central_warehouse(warehouse_id).id
    products_data = reports_dao.get_inventory_report(
        warehouse_id=warehouse_id,
        product_id=product_id,
        keyword=keyword
    )
    
    return products_data


def get_movements_report_service(from_date_value, to_date_value, warehouse_id_value):
       
    from_date = parse_date(from_date_value)
    to_date = parse_date(to_date_value)
    warehouse_id = validate_positive_integer(warehouse_id_value, "Mã kho")
    
                                    
    if from_date and to_date and from_date > to_date:
        raise ValidationError("Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc")

    if to_date:
        to_date = datetime.combine(to_date.date(), time.max)
    
                                                
    warehouse = None
    if warehouse_id:
        warehouse = Warehouse.query.get(warehouse_id)
        if not warehouse:
            raise NotFoundError("Kho không tồn tại")
    
    warehouse_id = ensure_central_warehouse(warehouse_id).id
    report_data = reports_dao.get_movements_report(
        from_date=from_date,
        to_date=to_date,
        warehouse_id=warehouse_id
    )
    
    return report_data, warehouse, from_date, to_date
