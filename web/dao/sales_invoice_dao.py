from sqlalchemy.orm import selectinload
from sqlalchemy.exc import IntegrityError

from web import db
from web.models import InvoiceStatus, SalesInvoice, SalesInvoiceItem


def _invoice_load_options():
    return (
        selectinload(SalesInvoice.items).selectinload(SalesInvoiceItem.product),
        selectinload(SalesInvoice.customer),
        selectinload(SalesInvoice.warehouse),
        selectinload(SalesInvoice.created_by_employee),
        selectinload(SalesInvoice.discount_approved_by_employee),
    )


def create_sales_invoice(
    warehouse_id,
    customer_id,
    employee_id,
    note,
    items,
    discount_amount=0,
    discount_status=None,
    discount_note=None,
    sale_source=None,
    payment_status=None,
    paid_amount=0,
    status=None,
    sales_area_id=None,
    commit=True,
):
       
    try:
        from web.models import DiscountStatus
        
                     
        invoice = SalesInvoice(
            warehouse_id=warehouse_id,
            customer_id=customer_id,
            employee_id=employee_id,
            note=note,
            status=status or InvoiceStatus.DRAFT,
            discount_amount=discount_amount,
            discount_status=discount_status or DiscountStatus.NO_DISCOUNT,
            discount_note=discount_note,
            sale_source=sale_source,
            payment_status=payment_status,
            paid_amount=paid_amount,
            sales_area_id=sales_area_id,
        )
        db.session.add(invoice)
        db.session.flush()                    

                   
        for item_data in items:
            item = SalesInvoiceItem(
                sales_invoice_id=invoice.id,
                product_id=item_data["product_id"],
                quantity=item_data["quantity"],
                unit_price=item_data["unit_price"]
            )
            db.session.add(item)

        if commit:
            db.session.commit()
            return get_sales_invoice_by_id(invoice.id)
        db.session.flush()
        return invoice

    except IntegrityError:
        db.session.rollback()
        raise
    except Exception as ex:
        db.session.rollback()
        raise Exception(f"Lỗi tạo đơn hàng: {str(ex)}")



def update_sales_invoice(invoice_id, warehouse_id, customer_id, note, items, discount_amount=0, discount_status=None, discount_note=None, sales_area_id=None):
       
    try:
        from web.models import DiscountStatus
        
        invoice = SalesInvoice.query.get(invoice_id)
        if not invoice:
            raise Exception("Invoice không tồn tại")

                             
        SalesInvoiceItem.query.filter_by(sales_invoice_id=invoice_id).delete()

                                    
        invoice.warehouse_id = warehouse_id
        invoice.customer_id = customer_id
        invoice.note = note
        invoice.discount_amount = discount_amount
        invoice.discount_status = discount_status or DiscountStatus.NO_DISCOUNT
        invoice.discount_note = discount_note
        invoice.sales_area_id = sales_area_id

                       
        for item_data in items:
            item = SalesInvoiceItem(
                sales_invoice_id=invoice.id,
                product_id=item_data["product_id"],
                quantity=item_data["quantity"],
                unit_price=item_data["unit_price"]
            )
            db.session.add(item)

        db.session.commit()
        return get_sales_invoice_by_id(invoice.id)

    except IntegrityError:
        db.session.rollback()
        raise
    except Exception as ex:
        db.session.rollback()
        raise Exception(f"Lỗi cập nhật đơn hàng: {str(ex)}")



def get_sales_invoices_list(
    page=1,
    per_page=None,
    status=None,
    keyword=None,
    discount_status=None,
    from_date=None,
    to_date=None,
    cancel_requested=None,
    warehouse_id=None,
):
       
    from web import app
    from web.models import Customer
    from sqlalchemy import or_
    
    query = SalesInvoice.query.options(*_invoice_load_options())
    
                        
    if status:
        query = query.filter(SalesInvoice.status == status)
    if warehouse_id:
        query = query.filter(SalesInvoice.warehouse_id == warehouse_id)
    
                                 
    if discount_status:
        query = query.filter(SalesInvoice.discount_status == discount_status)

    if cancel_requested is not None:
        query = query.filter(SalesInvoice.cancel_requested == cancel_requested)
        if cancel_requested:
            query = query.filter(
                SalesInvoice.status.in_(
                    [InvoiceStatus.PROCESSING, InvoiceStatus.DELIVERING]
                )
            )

    if from_date:
        query = query.filter(SalesInvoice.sold_at >= from_date)
    if to_date:
        query = query.filter(SalesInvoice.sold_at <= to_date)
    
                                            
    if keyword:
        kw = f"%{keyword.strip()}%"
        query = query.join(Customer).filter(
            or_(
                Customer.full_name.ilike(kw),
                Customer.phone.ilike(kw),
                SalesInvoice.id.cast(db.String).ilike(kw)
            )
        )
    
                                
    query = query.order_by(SalesInvoice.sold_at.desc())
    
                      
    total = query.count()
    
    if not page or page < 1:
        page = 1
    
    if per_page is None:
        per_page = app.config.get("APPLICATION_SIZE", 10)
    
    start = (page - 1) * per_page
    end = start + per_page
    query = query.slice(start, end)
    
    invoices = query.all()
    
    return invoices, total


def get_sales_invoice_by_id(invoice_id):
    return (
        SalesInvoice.query.options(*_invoice_load_options())
        .filter(SalesInvoice.id == invoice_id)
        .first()
    )
