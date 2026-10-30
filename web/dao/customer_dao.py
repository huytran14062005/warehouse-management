from datetime import datetime

from sqlalchemy import and_, case, func, or_, select
from sqlalchemy.orm import joinedload
from sqlalchemy.exc import IntegrityError
from web import app, db
from web.models import (
    Customer,
    CustomerPayment,
    InvoiceStatus,
    SalesInvoice,
    SalesInvoiceItem,
)


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


def get_customer_by_phone(phone):
    return Customer.query.filter(Customer.phone == phone.strip()).first()


def get_customer_by_id(customer_id):
                              
    return Customer.query.get(customer_id)


def get_customer_payments(customer_id, page=1, per_page=None):
    query = (
        CustomerPayment.query
        .options(
            joinedload(CustomerPayment.collected_by_employee),
            joinedload(CustomerPayment.sales_invoice),
        )
        .filter(CustomerPayment.customer_id == customer_id)
        .order_by(CustomerPayment.paid_at.desc(), CustomerPayment.id.desc())
    )
    query, total = apply_pagination(query, page, page_size=per_page)
    return query.all(), total


def get_all_customers(
    page=1,
    per_page=None,
    keyword=None,
    has_debt=False,
    debt_min=None,
    debt_max=None,
):
       
    query = Customer.query

                          
    if has_debt:
        query = query.filter(Customer.debt_amount > 0)

    if debt_min is not None:
        query = query.filter(Customer.debt_amount >= debt_min)

    if debt_max is not None:
        query = query.filter(Customer.debt_amount <= debt_max)

                                                    
    if keyword:
        kw = f"%{keyword.strip()}%"
        query = query.filter(
            or_(
                Customer.full_name.ilike(kw),
                Customer.phone.ilike(kw),
                Customer.address.ilike(kw),
            )
        )

                                               
    # Keep the summary over the full filtered set without materializing every
    # customer id (or counting the same result twice for pagination).
    summary_counts = query.order_by(None).with_entities(
        func.count(Customer.id).label("total"),
        func.coalesce(func.sum(Customer.debt_amount), 0).label("total_debt"),
    ).one()
    total = int(summary_counts.total or 0)
    if total == 0:
        return [], 0, {
            "total_customers": 0,
            "total_collected": 0.0,
            "total_sales": 0.0,
            "total_debt": 0.0,
        }
    filtered_customer_ids = query.order_by(None).with_entities(Customer.id).subquery()

    page_size = per_page or app.config.get("APPLICATION_SIZE", 10)
    page = page if page and page > 0 else 1
    customers = (
        query.options(joinedload(Customer.sales_area_ref))
        .order_by(Customer.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    page_customer_ids = [customer.id for customer in customers]

    def payment_totals(customer_ids):
        if not customer_ids:
            return {}
        return {
            row.customer_id: float(row.total_paid or 0)
            for row in db.session.query(
                CustomerPayment.customer_id,
                func.coalesce(func.sum(CustomerPayment.amount), 0).label("total_paid"),
            )
            .filter(CustomerPayment.customer_id.in_(customer_ids))
            .group_by(CustomerPayment.customer_id)
            .all()
        }

    def completed_invoice_totals(customer_filter):
        return (
            db.session.query(
                SalesInvoice.id.label("invoice_id"),
                SalesInvoice.customer_id.label("customer_id"),
                (
                    func.sum(
                        SalesInvoiceItem.quantity * SalesInvoiceItem.unit_price
                    )
                    - SalesInvoice.discount_amount
                ).label("final_amount"),
            )
            .join(
                SalesInvoiceItem,
                SalesInvoiceItem.sales_invoice_id == SalesInvoice.id,
            )
            .filter(
                customer_filter,
                SalesInvoice.status == InvoiceStatus.COMPLETED,
            )
            .group_by(
                SalesInvoice.id,
                SalesInvoice.customer_id,
                SalesInvoice.discount_amount,
            )
            .subquery()
        )

    def sales_totals(customer_ids):
        if not customer_ids:
            return {}
        invoice_totals = completed_invoice_totals(
            SalesInvoice.customer_id.in_(customer_ids)
        )
        return {
            row.customer_id: float(row.total_sales or 0)
            for row in db.session.query(
                invoice_totals.c.customer_id,
                func.coalesce(
                    func.sum(invoice_totals.c.final_amount), 0
                ).label("total_sales"),
            )
            .group_by(invoice_totals.c.customer_id)
            .all()
        }

    page_paid = payment_totals(page_customer_ids)
    page_sales = sales_totals(page_customer_ids)
    for customer in customers:
        # Transient attributes keep the API serializer reusable for detail and
        # update responses without changing the database model.
        customer._total_paid_amount = page_paid.get(customer.id, 0.0)
        customer._total_sales_amount = page_sales.get(customer.id, 0.0)

    filtered_ids = select(filtered_customer_ids.c.id)
    all_paid = db.session.query(
        func.coalesce(func.sum(CustomerPayment.amount), 0)
    ).filter(CustomerPayment.customer_id.in_(filtered_ids)).scalar()
    all_invoice_totals = completed_invoice_totals(
        SalesInvoice.customer_id.in_(filtered_ids)
    )
    all_sales = db.session.query(
        func.coalesce(func.sum(all_invoice_totals.c.final_amount), 0)
    ).scalar()

    summary = {
        "total_customers": total,
        "total_collected": float(all_paid or 0),
        "total_sales": float(all_sales or 0),
        "total_debt": float(summary_counts.total_debt or 0),
    }

    return customers, total, summary


def add_customer(full_name, phone, address, sales_area_id=None):
    customer = Customer(
        full_name=full_name,
        phone=phone,
        address=address,
        sales_area_id=sales_area_id,
    )

    db.session.add(customer)

    try:
        db.session.commit()
        return customer
    except IntegrityError:
        db.session.rollback()
        raise
    except Exception as ex:
        db.session.rollback()
        raise Exception(f"Lỗi hệ thống: {str(ex)}!")


def update_customer(
    customer_id,
    full_name,
    phone,
    address,
    debt_amount=None,
    sales_area_id=None,
):
       
    customer = (
        Customer.query.with_for_update()
        .filter(Customer.id == customer_id)
        .first()
    )
    
    if not customer:
        return None
    
    try:
        customer.full_name = full_name
        customer.phone = phone
        customer.address = address
        customer.sales_area_id = sales_area_id
        
        if debt_amount is not None:
            customer.debt_amount = debt_amount
        
        db.session.commit()
        db.session.refresh(customer)
        return customer
    except IntegrityError:
        db.session.rollback()
        raise
    except Exception as ex:
        db.session.rollback()
        raise Exception(f"Lỗi hệ thống: {str(ex)}!")


def reduce_customer_debt(customer_id, payment_amount):
    customer = (
        Customer.query.with_for_update()
        .filter(Customer.id == customer_id)
        .first()
    )
    
    if not customer:
        return None
    
    try:
        old_debt = float(customer.debt_amount)
        new_debt = old_debt - payment_amount
        
                                                     
        if new_debt < 0:
            raise ValueError("Số tiền thanh toán vượt quá công nợ hiện tại")
        
        customer.debt_amount = new_debt
        
        db.session.commit()
        db.session.refresh(customer)
        
        return customer, old_debt, new_debt
    except ValueError:
        db.session.rollback()
        raise
    except Exception as ex:
        db.session.rollback()
        raise Exception(f"Lỗi hệ thống: {str(ex)}!")


def get_customer_statistics(customer_id, warehouse_id=None):
    from web.models import SalesInvoiceItem

    current_year = datetime.now().year
    year_start = datetime(current_year, 1, 1)
    next_year_start = datetime(current_year + 1, 1, 1)
    completed_condition = SalesInvoice.status == InvoiceStatus.COMPLETED
    invoice_total = (
        select(
            func.coalesce(
                func.sum(SalesInvoiceItem.quantity * SalesInvoiceItem.unit_price),
                0,
            ) - SalesInvoice.discount_amount
        )
        .where(SalesInvoiceItem.sales_invoice_id == SalesInvoice.id)
        .correlate(SalesInvoice)
        .scalar_subquery()
    )

    statistics_query = db.session.query(
        func.count(func.distinct(SalesInvoice.id)).label("total_orders"),
        func.count(
            func.distinct(
                case(
                    (SalesInvoice.status == InvoiceStatus.COMPLETED, SalesInvoice.id),
                    else_=None,
                )
            )
        ).label("total_completed_orders"),
        func.coalesce(
            func.sum(
                case(
                    (
                        completed_condition,
                        invoice_total,
                    ),
                    else_=0,
                )
            ),
            0,
        ).label("total_spent"),
        func.coalesce(
            func.sum(
                case(
                    (
                        and_(
                            completed_condition,
                            SalesInvoice.sold_at >= year_start,
                            SalesInvoice.sold_at < next_year_start,
                        ),
                        invoice_total,
                    ),
                    else_=0,
                )
            ),
            0,
        ).label("total_spent_current_year"),
    ).filter(SalesInvoice.customer_id == customer_id)
    if warehouse_id is not None:
        statistics_query = statistics_query.filter(SalesInvoice.warehouse_id == warehouse_id)
    statistics = statistics_query.one()

    return {
        "total_orders": int(statistics.total_orders or 0),
        "total_completed_orders": int(statistics.total_completed_orders or 0),
        "total_spent": float(statistics.total_spent or 0),
        "current_year": current_year,
        "total_spent_current_year": float(statistics.total_spent_current_year or 0),
    }
