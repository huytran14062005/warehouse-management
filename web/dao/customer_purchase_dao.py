from sqlalchemy import func
from sqlalchemy.orm import joinedload, selectinload
from web import app, db
from web.models import Customer, InvoiceStatus, Product, SalesInvoice, SalesInvoiceItem


def apply_pagination(query, page, page_size=None):
                                        
    total = query.order_by(None).count()

    if not page or page < 1:
        page = 1

    if page_size is None:
        page_size = app.config.get("APPLICATION_SIZE", 10)

    start = (page - 1) * page_size
    end = start + page_size
    query = query.slice(start, end)

    return query, total


def get_customer_orders(customer_id, page=1, per_page=None, warehouse_id=None):
       
    query = (
        SalesInvoice.query.options(
            selectinload(SalesInvoice.items),
            joinedload(SalesInvoice.warehouse),
            joinedload(SalesInvoice.created_by_employee),
        )
        .filter(SalesInvoice.customer_id == customer_id)
        .order_by(SalesInvoice.sold_at.desc())
    )

    if warehouse_id is not None:
        query = query.filter(SalesInvoice.warehouse_id == warehouse_id)

    query, total = apply_pagination(query, page, page_size=per_page)
    orders = query.all()

    return orders, total


def get_customer_order_detail(customer_id, order_id, warehouse_id=None):
       
    query = (
        SalesInvoice.query.options(
            selectinload(SalesInvoice.items).selectinload(SalesInvoiceItem.product),
            joinedload(SalesInvoice.warehouse),
            joinedload(SalesInvoice.created_by_employee),
        )
        .filter(
            SalesInvoice.id == order_id,
            SalesInvoice.customer_id == customer_id
        )
    )
    if warehouse_id is not None:
        query = query.filter(SalesInvoice.warehouse_id == warehouse_id)
    return query.first()


def get_customer_purchased_products(customer_id, page=1, per_page=None, warehouse_id=None):
       
    query = (
        db.session.query(
            Product.id.label("product_id"),
            Product.name.label("product_name"),
            Product.unit.label("unit"),
            func.sum(SalesInvoiceItem.quantity).label("total_quantity"),
            func.sum(SalesInvoiceItem.quantity * SalesInvoiceItem.unit_price).label("total_amount"),
            func.max(SalesInvoice.sold_at).label("last_purchased")
        )
        .join(SalesInvoiceItem, Product.id == SalesInvoiceItem.product_id)
        .join(SalesInvoice, SalesInvoiceItem.sales_invoice_id == SalesInvoice.id)
        .filter(
            SalesInvoice.customer_id == customer_id,
            SalesInvoice.status == InvoiceStatus.COMPLETED
        )
        .group_by(Product.id, Product.name, Product.unit)
        .order_by(func.sum(SalesInvoiceItem.quantity * SalesInvoiceItem.unit_price).desc())
    )
    if warehouse_id is not None:
        query = query.filter(SalesInvoice.warehouse_id == warehouse_id)

    page_size = per_page or app.config.get("APPLICATION_SIZE", 10)
    results = query.offset((page - 1) * page_size).limit(page_size).all()
    totals_query = (
        db.session.query(
            func.count(func.distinct(SalesInvoiceItem.product_id)).label("total_products"),
            func.coalesce(
                func.sum(SalesInvoiceItem.quantity * SalesInvoiceItem.unit_price), 0
            ).label("total_amount"),
        )
        .join(SalesInvoice, SalesInvoiceItem.sales_invoice_id == SalesInvoice.id)
        .filter(
            SalesInvoice.customer_id == customer_id,
            SalesInvoice.status == InvoiceStatus.COMPLETED,
        )
    )
    if warehouse_id is not None:
        totals_query = totals_query.filter(SalesInvoice.warehouse_id == warehouse_id)
    totals = totals_query.one()
    return results, int(totals.total_products or 0), float(totals.total_amount or 0)
