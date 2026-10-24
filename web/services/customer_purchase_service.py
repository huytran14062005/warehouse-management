from web import app, dao
from web.models import Customer
from web.services.exceptions import NotFoundError
from web.services.promotion_service import promotion_snapshot_from_note


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


def parse_paging_args(page_value, per_page_value):
                                                 
    default_size = app.config.get("APPLICATION_SIZE", 10)
    return parse_page(page_value), parse_per_page(per_page_value, default_size)


def get_customer_or_404(customer_id):
                                               
    customer = Customer.query.get(customer_id)
    if not customer:
        raise NotFoundError("Khách hàng không tồn tại")
    return customer


def serialize_customer_basic(customer):
                                                 
    return {
        "id": customer.id,
        "full_name": customer.full_name,
        "phone": customer.phone,
        "address": customer.address
    }


def serialize_order_summary(order):
                                    
                    
    total_amount = sum(
        float(item.quantity) * float(item.unit_price) 
        for item in order.items
    )
    discount_amount = float(order.discount_amount or 0)
    
    return {
        "id": order.id,
        "sold_at": order.sold_at.isoformat() if order.sold_at else None,
        "status": order.status.value,
        "warehouse": {
            "id": order.warehouse.id,
            "name": order.warehouse.name
        },
        "employee": {
            "id": order.created_by_employee.id,
            "full_name": order.created_by_employee.full_name
        },
        "items_count": len(order.items),
        "total_amount": total_amount,
        "discount_amount": discount_amount,
        "promotion": promotion_snapshot_from_note(order.discount_note),
        "final_amount": total_amount - discount_amount,
        "note": order.note
    }


def serialize_order_detail(order):
                                     
    items_data = []
    total_amount = 0

    for item in order.items:
        item_total = float(item.quantity) * float(item.unit_price)
        total_amount += item_total

        items_data.append({
            "id": item.id,
            "product_id": item.product_id,
            "product_name": item.product.name,
            "unit": item.product.unit,
            "quantity": int(item.quantity),
            "unit_price": float(item.unit_price),
            "total": item_total
        })

    discount_amount = float(order.discount_amount or 0)

    return {
        "id": order.id,
        "sold_at": order.sold_at.isoformat() if order.sold_at else None,
        "status": order.status.value,
        "note": order.note,
        "warehouse": {
            "id": order.warehouse.id,
            "name": order.warehouse.name,
            "address": order.warehouse.address
        },
        "employee": {
            "id": order.created_by_employee.id,
            "full_name": order.created_by_employee.full_name,
            "role": order.created_by_employee.role.value
        },
        "items": items_data,
        "total_amount": total_amount,
        "discount_amount": discount_amount,
        "promotion": promotion_snapshot_from_note(order.discount_note),
        "final_amount": total_amount - discount_amount,
    }


def get_customer_orders_service(customer_id, page_value, per_page_value, warehouse_id=None):
       
    customer = get_customer_or_404(customer_id)
    page, per_page = parse_paging_args(page_value, per_page_value)

    orders, total = dao.get_customer_orders(
        customer_id=customer_id,
        page=page,
        per_page=per_page,
        warehouse_id=warehouse_id,
    )

    return customer, orders, total, page, per_page


def get_customer_order_detail_service(customer_id, order_id, warehouse_id=None):
       
    customer = get_customer_or_404(customer_id)
    
    order = dao.get_customer_order_detail(customer_id, order_id, warehouse_id=warehouse_id)
    if not order:
        raise NotFoundError("Đơn hàng không tồn tại hoặc không thuộc về khách hàng này")

    return customer, order


def get_customer_purchased_products_service(customer_id, page_value=None, per_page_value=None, warehouse_id=None):
       
    customer = get_customer_or_404(customer_id)
    
    page, per_page = parse_paging_args(page_value, per_page_value)
    products, total, total_amount = dao.get_customer_purchased_products(
        customer_id, page=page, per_page=per_page, warehouse_id=warehouse_id
    )

    return customer, products, total, total_amount, page, per_page
