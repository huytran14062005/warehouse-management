from datetime import datetime, time
import math
from web import app, dao, db
from web.dao import import_invoice_dao, product_dao
from web.models import Employee, Product, Supplier, Warehouse
from web.services.exceptions import NotFoundError, ValidationError
from web.services.validators import require_text
from web.services.authorization import ensure_bounded_items, ensure_warehouse_access


def validate_positive_number(value, field_name):
                           
    try:
        num = float(value)
        if not math.isfinite(num) or num <= 0:
            raise ValidationError(f"{field_name} phải lớn hơn 0")
        return num
    except (ValueError, TypeError):
        raise ValidationError(f"{field_name} không hợp lệ")


def validate_positive_integer(value, field_name):
                                  
    try:
        if isinstance(value, bool):
            raise ValueError
        num = int(value)
        if float(value) != num or num <= 0:
            raise ValidationError(f"{field_name} phải lớn hơn 0")
        return num
    except (ValueError, TypeError):
        raise ValidationError(f"{field_name} không hợp lệ")


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


def parse_date(value):
                                         
    if not value:
        return None
    try:
        return datetime.strptime(str(value).strip(), "%Y-%m-%d")
    except (ValueError, TypeError):
        raise ValidationError(f"Ngày không hợp lệ: {value}. Định dạng đúng: YYYY-MM-DD")


def _validate_import_items(items):
    ensure_bounded_items(items, "Sản phẩm trong phiếu nhập")
    if not isinstance(items, list) or not items:
        raise ValidationError("Phiếu nhập phải có ít nhất 1 sản phẩm")

    normalized = []
    product_ids = []
    seen_product_ids = set()
    for index, item in enumerate(items, start=1):
        if not isinstance(item, dict):
            raise ValidationError(f"Sản phẩm (item {index}) không hợp lệ")
        product_id = validate_positive_integer(
            item.get("product_id"),
            f"Mã sản phẩm (item {index})",
        )
        if product_id in seen_product_ids:
            raise ValidationError(f"Sản phẩm ID {product_id} bị lặp trong phiếu nhập")
        seen_product_ids.add(product_id)
        product_ids.append(product_id)
        normalized.append({
            "product_id": product_id,
            "quantity": validate_positive_integer(
                item.get("quantity"),
                f"Số lượng (item {index})",
            ),
            "unit_price": validate_positive_number(
                item.get("unit_price"),
                f"Đơn giá (item {index})",
            ),
        })

    products = Product.query.filter(Product.id.in_(product_ids)).all()
    existing_product_ids = {product.id for product in products}
    missing_product_ids = [product_id for product_id in product_ids if product_id not in existing_product_ids]
    if missing_product_ids:
        raise NotFoundError(f"Sản phẩm ID {missing_product_ids[0]} không tồn tại")

    return normalized


def _resolve_supplier(supplier_id, supplier_data=None):
    supplier_id = validate_positive_integer(supplier_id, "Mã nhà cung cấp") if supplier_id not in (None, "") else None
    if supplier_id:
        supplier = Supplier.query.get(supplier_id)
        if not supplier:
            raise NotFoundError("Nhà cung cấp không tồn tại")
        return supplier

    if not isinstance(supplier_data, dict):
        raise ValidationError("Vui lòng chọn nhà cung cấp hoặc nhập nhà cung cấp mới")
    supplier_name = require_text(supplier_data.get("name"), "Tên nhà cung cấp", max_length=255)
    supplier_address = require_text(supplier_data.get("address"), "Địa chỉ nhà cung cấp")
    supplier = Supplier.query.filter(
        Supplier.name == supplier_name,
        Supplier.address == supplier_address,
    ).first()
    if not supplier:
        supplier = Supplier(name=supplier_name, address=supplier_address)
        db.session.add(supplier)
        db.session.flush()
    return supplier


def serialize_import_invoice(invoice):
                                                       
    items_data = []
    total_amount = 0

    for item in invoice.items:
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

    return {
        "id": invoice.id,
        "imported_at": invoice.imported_at.isoformat() if invoice.imported_at else None,
        "note": invoice.note,
        "warehouse": {
            "id": invoice.warehouse.id,
            "name": invoice.warehouse.name,
            "address": invoice.warehouse.address
        },
        "supplier": {
            "id": invoice.supplier.id,
            "name": invoice.supplier.name,
            "address": invoice.supplier.address
        },
        "employee": {
            "id": invoice.created_by_employee.id,
            "full_name": invoice.created_by_employee.full_name,
            "role": invoice.created_by_employee.role.value
        },
        "items": items_data,
        "total_amount": total_amount
    }


def serialize_import_invoice_summary(invoice):
                                                        
    total_amount = sum(
        float(item.quantity) * float(item.unit_price) 
        for item in invoice.items
    )
    
    return {
        "id": invoice.id,
        "imported_at": invoice.imported_at.isoformat() if invoice.imported_at else None,
        "warehouse": {
            "id": invoice.warehouse.id,
            "name": invoice.warehouse.name
        },
        "supplier": {
            "id": invoice.supplier.id,
            "name": invoice.supplier.name
        },
        "employee": {
            "id": invoice.created_by_employee.id,
            "full_name": invoice.created_by_employee.full_name
        },
        "items_count": len(invoice.items),
        "total_amount": total_amount,
        "note": invoice.note
    }


def get_import_invoices_list_service(page_value, per_page_value, warehouse_id_value, supplier_id_value, from_date_value, to_date_value, keyword):
       
    page, per_page = parse_paging_args(page_value, per_page_value)
    
    warehouse_id = validate_positive_integer(warehouse_id_value, "Mã kho") if warehouse_id_value else None
    supplier_id = validate_positive_integer(supplier_id_value, "Mã nhà cung cấp") if supplier_id_value else None
    from_date = parse_date(from_date_value)
    to_date = parse_date(to_date_value)
    if to_date:
        to_date = datetime.combine(to_date.date(), time.max)
    keyword = str(keyword or '').strip() or None
    
    invoices, total = import_invoice_dao.get_all_import_invoices(
        page=page,
        per_page=per_page,
        warehouse_id=warehouse_id,
        supplier_id=supplier_id,
        from_date=from_date,
        to_date=to_date,
        keyword=keyword
    )
    
    return invoices, total, page, per_page


def get_import_invoice_detail_service(invoice_id):
       
    invoice = import_invoice_dao.get_import_invoice_by_id(invoice_id)
    
    if not invoice:
        raise NotFoundError("Phiếu nhập không tồn tại")
    
    return invoice


def create_import_invoice_service(employee_id, warehouse_id, supplier_id, supplier_data=None, note="", items=None, is_return=False, imported_at=None):
       
                    
    if not items or len(items) == 0:
        raise ValidationError("Phiếu nhập phải có ít nhất 1 sản phẩm")

    warehouse_id = validate_positive_integer(warehouse_id, "Mã kho") if warehouse_id not in (None, "") else None

                               
    imported_at = parse_date(imported_at) if imported_at not in (None, "") else datetime.now()
    employee = Employee.query.get(employee_id)
    if not employee:
        raise NotFoundError("Nhân viên không tồn tại")

    validated_items = _validate_import_items(items)

                                
    warehouse = Warehouse.query.get(warehouse_id) if warehouse_id else Warehouse.query.order_by(Warehouse.id.asc()).first()
    if not warehouse:
        raise NotFoundError("Kho không tồn tại")
    warehouse_id = warehouse.id
    ensure_warehouse_access(employee_id, warehouse_id)

                               
    supplier = _resolve_supplier(supplier_id, supplier_data)
    supplier_id = supplier.id

                                
    final_note = note.strip() if note else ""
    if is_return:
        final_note = f"[TRẢ HÀNG] {final_note}" if final_note else "[TRẢ HÀNG]"

                        
    invoice = import_invoice_dao.create_import_invoice(
        warehouse_id=warehouse_id,
        supplier_id=supplier_id,
        employee_id=employee_id,
        imported_at=imported_at,
        note=final_note,
        items=validated_items
    )

    return invoice


def update_import_invoice_service(invoice_id, employee_id, warehouse_id, supplier_id, supplier_data=None, note="", items=None, is_return=False, imported_at=None):
       
                              
    invoice = import_invoice_dao.get_import_invoice_by_id(invoice_id)
    if not invoice:
        raise NotFoundError("Phiếu nhập không tồn tại")

    # Authorize the existing document before accepting a client-supplied
    # warehouse_id. Otherwise a warehouse-scoped employee could edit a
    # document from another warehouse by submitting their own warehouse id.
    ensure_warehouse_access(employee_id, invoice.warehouse_id)

                    
    if not items or len(items) == 0:
        raise ValidationError("Phiếu nhập phải có ít nhất 1 sản phẩm")

    warehouse_id = (
        validate_positive_integer(warehouse_id, "Mã kho")
        if warehouse_id not in (None, "")
        else invoice.warehouse_id
    )

    imported_at = parse_date(imported_at) if imported_at not in (None, "") else invoice.imported_at
    warehouse = Warehouse.query.get(warehouse_id)
    if not warehouse:
        raise NotFoundError("Kho không tồn tại")
    warehouse_id = warehouse.id
    ensure_warehouse_access(employee_id, warehouse_id)

                               
    validated_items = _validate_import_items(items)

    supplier = _resolve_supplier(supplier_id, supplier_data)
    supplier_id = supplier.id


    old_items = {item.product_id: float(item.quantity) for item in invoice.items}

    if invoice.warehouse_id != warehouse_id:
        old_stock_by_product = product_dao.calculate_stock_for_items_at_warehouse(
            list(old_items),
            invoice.warehouse_id,
        )
        for product_id, old_quantity in old_items.items():
            old_stock = old_stock_by_product[product_id]
            if old_stock["available_stock"] - old_quantity < 0:
                product = Product.query.get(product_id)
                raise ValidationError(
                    f"KhÃ´ng thá»ƒ chuyá»ƒn phiáº¿u nháº­p vÃ¬ sáº£n pháº©m '{product.name}' "
                    f"Ä‘Ã£ Ä‘Æ°á»£c báº£n hoáº·c xuáº¥t khá»i kho cÅ©."
                )
    
                                    
    new_items_by_product = {
        item["product_id"]: item["quantity"]
        for item in validated_items
    }
    stock_by_product = product_dao.calculate_stock_for_items_at_warehouse(
        list(set(old_items) | set(new_items_by_product)),
        warehouse_id,
    )
    for product_id, old_quantity in old_items.items():
        new_quantity = new_items_by_product.get(product_id, 0)
        
        change = new_quantity - old_quantity                  
        
                                                                               
        if change < 0:
            stock_info = stock_by_product[product_id]
            new_stock = stock_info["available_stock"] + change
            
            if new_stock < 0:
                product = Product.query.get(product_id)
                raise ValidationError(
                    f"Không thể sửa phiếu nhập vì sản phẩm '{product.name}' "
                    f"đã bán hết. Tồn kho hiện tại: {stock_info['available_stock']}, "
                    f"giảm {abs(change)} sẽ làm tồn kho âm."
                )

                                  
    final_note = note.strip() if note else ""
    if is_return and not final_note.startswith("[TRẢ HÀNG]"):
        final_note = f"[TRẢ HÀNG] {final_note}" if final_note else "[TRẢ HÀNG]"

                      
    updated_invoice = import_invoice_dao.update_import_invoice(
        invoice_id=invoice_id,
        warehouse_id=warehouse_id,
        supplier_id=supplier_id,
        imported_at=imported_at,
        note=final_note,
        items=validated_items
    )

    return updated_invoice


def delete_import_invoice_service(invoice_id):
       
                              
    invoice = import_invoice_dao.get_import_invoice_by_id(invoice_id)
    if not invoice:
        raise NotFoundError("Phiếu nhập không tồn tại")

                                                          
    stock_by_product = product_dao.calculate_stock_for_items_at_warehouse(
        [item.product_id for item in invoice.items],
        invoice.warehouse_id,
    )
    for item in invoice.items:
        stock_info = stock_by_product[item.product_id]
        
                                                                                
        new_stock = stock_info["available_stock"] - float(item.quantity)
        
        if new_stock < 0:
            raise ValidationError(
                f"Không thể xóa phiếu nhập vì sản phẩm '{item.product.name}' "
                f"đã bán hết. Tồn kho hiện tại: {stock_info['available_stock']}, "
                f"xóa {int(item.quantity)} sẽ làm tồn kho âm."
            )

                 
    import_invoice_dao.delete_import_invoice(invoice_id)
    
    return True
