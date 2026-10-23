from decimal import Decimal, InvalidOperation

from web import app, dao
from web.services.exceptions import ValidationError


def parse_page(value):
                                        
    if value is None:
        return 1
    try:
        page = int(value)
        return page if page > 0 else 1
    except (ValueError, TypeError):
        return 1


def parse_per_page(value, default):
                                     
    if value is None:
        return default
    try:
        per_page = int(value)
        return min(per_page, app.config.get("MAX_PAGE_SIZE", 100)) if per_page > 0 else default
    except (ValueError, TypeError):
        return default


def parse_warehouse_id(value):
                                   
    if value is None:
        return None
    try:
        wh_id = int(value)
        if wh_id <= 0:
            raise ValidationError("Mã kho phải lớn hơn 0")
        return wh_id
    except (ValueError, TypeError):
        raise ValidationError("Mã kho không hợp lệ")


def parse_optional_price(value, field_name):
    if value is None or (isinstance(value, str) and not value.strip()):
        return None

    try:
        price = Decimal(str(value).strip())
    except (InvalidOperation, ValueError, TypeError):
        raise ValidationError(f"{field_name} khÃ´ng há»£p lá»‡")

    if not price.is_finite() or price < 0:
        raise ValidationError(f"{field_name} khÃ´ng Ä‘Æ°á»£c Ã¢m")

    return price


def parse_price_range(min_price_value, max_price_value):
    min_price = parse_optional_price(min_price_value, "GiÃ¡ tá»«")
    max_price = parse_optional_price(max_price_value, "GiÃ¡ Ä‘áº¿n")

    if min_price is not None and max_price is not None and min_price > max_price:
        raise ValidationError("GiÃ¡ tá»« khÃ´ng Ä‘Æ°á»£c lá»›n hÆ¡n giÃ¡ Ä‘áº¿n")

    return min_price, max_price


def parse_inventory_status(value):
    if value is None or (isinstance(value, str) and not value.strip()):
        return None

    status = str(value).strip().lower()
    allowed_statuses = {"available", "low", "empty"}
    if status not in allowed_statuses:
        raise ValidationError("Trạng thái tồn kho không hợp lệ")
    return status


def parse_paging_args(page_value, per_page_value):
                                                 
    default_size = app.config.get("APPLICATION_SIZE", 10)
    return parse_page(page_value), parse_per_page(per_page_value, default_size)


def serialize_product_inventory(product, inventory):
                                               
    return {
        "id": product.id,
        "name": product.name,
        "unit": product.unit,
        "default_sale_price": float(product.default_sale_price),
        "total_imported": inventory["total_imported"],
        "total_sold": inventory["total_sold"],
        "total_damaged": inventory["total_damaged"],
        "total_transferred": inventory.get("total_transferred", 0),
        "available_stock": inventory["available_stock"],
        "warehouses": inventory["warehouses"]
    }


def get_products_inventory_service(
    page_value,
    per_page_value,
    keyword,
    warehouse_id_value,
    min_price_value,
    max_price_value,
    status_value=None,
):
       
    page, per_page = parse_paging_args(page_value, per_page_value)
    keyword = str(keyword or '').strip()
    warehouse_id = parse_warehouse_id(warehouse_id_value)
    min_price, max_price = parse_price_range(min_price_value, max_price_value)
    status = parse_inventory_status(status_value)

    products_data, total = dao.get_products_with_inventory(
        page=page,
        per_page=per_page,
        keyword=keyword or None,
        warehouse_id=warehouse_id,
        min_price=min_price,
        max_price=max_price,
        status=status,
    )

    return products_data, total, page, per_page
