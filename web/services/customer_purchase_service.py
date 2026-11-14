from web import dao
from web.models import Customer
from web.services.exceptions import NotFoundError
from web.services.promotion_service import promotion_snapshot_from_note
from web.utils.pagination import parse_page, parse_per_page, parse_paging_args


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
        "sale_source": order.sale_source.value,
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
            "quantity": float(item.quantity),
            "unit_price": float(item.unit_price),
            "total": item_total
        })

    discount_amount = float(order.discount_amount or 0)

    return {
        "id": order.id,
        "sold_at": order.sold_at.isoformat() if order.sold_at else None,
        "status": order.status.value,
        "sale_source": order.sale_source.value,
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
