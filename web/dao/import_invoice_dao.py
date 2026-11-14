from datetime import datetime

from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import joinedload, selectinload
from web import db
from web.models import ImportInvoice, ImportInvoiceItem, Supplier, SupplierPayment
from web.utils.pagination import apply_pagination


def _invoice_load_options(for_list=False):
    items_option = selectinload(ImportInvoice.items)
    if not for_list:
        items_option = items_option.selectinload(ImportInvoiceItem.product)
    return (
        items_option,
        joinedload(ImportInvoice.warehouse),
        joinedload(ImportInvoice.supplier),
        joinedload(ImportInvoice.created_by_employee),
        selectinload(ImportInvoice.payments),
    )


def get_all_import_invoices(page=1, per_page=None, warehouse_id=None, supplier_id=None, from_date=None, to_date=None, keyword=None):
       
    query = ImportInvoice.query.options(*_invoice_load_options(for_list=True))

                     
    if warehouse_id:
        query = query.filter(ImportInvoice.warehouse_id == warehouse_id)

                              
    if supplier_id:
        query = query.filter(ImportInvoice.supplier_id == supplier_id)

                           
    if from_date:
        query = query.filter(ImportInvoice.imported_at >= from_date)
    if to_date:
        query = query.filter(ImportInvoice.imported_at <= to_date)

                                                            
    if keyword:
        kw = f"%{keyword.strip()}%"
        query = query.join(Supplier).filter(
            or_(
                Supplier.name.ilike(kw),
                ImportInvoice.id.cast(db.String).ilike(kw)
            )
        )

                                
    query = query.order_by(ImportInvoice.imported_at.desc())

                      
    query, total = apply_pagination(query, page, page_size=per_page)

    invoices = query.all()

    return invoices, total


def get_import_invoice_by_id(invoice_id):
       
    return (
        ImportInvoice.query.options(*_invoice_load_options())
        .filter(ImportInvoice.id == invoice_id)
        .first()
    )


def create_import_invoice(warehouse_id, supplier_id, employee_id, note, items, imported_at=None, payment=None, combo_groups=None, inbound_fee=0, deductible_input_vat=0):
       
    try:
                     
        invoice = ImportInvoice(
            warehouse_id=warehouse_id,
            supplier_id=supplier_id,
            employee_id=employee_id,
            imported_at=imported_at or datetime.now(),
            note=note,
            combo_groups=combo_groups or None,
            inbound_fee=inbound_fee,
            deductible_input_vat=deductible_input_vat,
        )
        db.session.add(invoice)
        db.session.flush()                    

                   
        for item_data in items:
            item = ImportInvoiceItem(
                import_invoice_id=invoice.id,
                product_id=item_data["product_id"],
                quantity=item_data["quantity"],
                unit_price=item_data["unit_price"],
                line_total=item_data["line_total"],
                entered_unit=item_data.get("entered_unit"),
                entered_quantity=item_data.get("entered_quantity"),
            )
            db.session.add(item)

        if payment:
            db.session.add(SupplierPayment(
                supplier_id=supplier_id,
                import_invoice_id=invoice.id,
                employee_id=employee_id,
                amount=payment["amount"],
                payment_method=payment["payment_method"],
                note=payment.get("note"),
            ))

        db.session.commit()

        return get_import_invoice_by_id(invoice.id)

    except IntegrityError:
        db.session.rollback()
        raise
    except Exception as ex:
        db.session.rollback()
        raise Exception(f"Lỗi tạo phiếu nhập kho: {str(ex)}")


def update_import_invoice(invoice_id, warehouse_id, supplier_id, note, items, imported_at=None, combo_groups=None, inbound_fee=0, deductible_input_vat=0):
       
    try:
        invoice = ImportInvoice.query.get(invoice_id)
        if not invoice:
            raise Exception("Phiếu nhập không tồn tại")

                             
        ImportInvoiceItem.query.filter_by(import_invoice_id=invoice_id).delete()

                                    
        invoice.warehouse_id = warehouse_id
        invoice.supplier_id = supplier_id
        if imported_at is not None:
            invoice.imported_at = imported_at
        invoice.note = note
        invoice.combo_groups = combo_groups or None
        invoice.inbound_fee = inbound_fee
        invoice.deductible_input_vat = deductible_input_vat

                       
        for item_data in items:
            item = ImportInvoiceItem(
                import_invoice_id=invoice.id,
                product_id=item_data["product_id"],
                quantity=item_data["quantity"],
                unit_price=item_data["unit_price"],
                line_total=item_data["line_total"],
                entered_unit=item_data.get("entered_unit"),
                entered_quantity=item_data.get("entered_quantity"),
            )
            db.session.add(item)

        db.session.commit()
        return get_import_invoice_by_id(invoice.id)

    except IntegrityError:
        db.session.rollback()
        raise
    except Exception as ex:
        db.session.rollback()
        raise Exception(f"Lỗi cập nhật phiếu nhập kho: {str(ex)}")


def delete_import_invoice(invoice_id):
       
    try:
        invoice = ImportInvoice.query.get(invoice_id)
        if not invoice:
            raise Exception("Phiếu nhập không tồn tại")

                                                    
        db.session.delete(invoice)
        db.session.commit()

        return True

    except IntegrityError:
        db.session.rollback()
        raise
    except Exception as ex:
        db.session.rollback()
        raise Exception(f"Lỗi xóa phiếu nhập kho: {str(ex)}")
