from datetime import datetime, time, timedelta
from decimal import Decimal, ROUND_HALF_UP
from sqlalchemy import func
from web import dao, db
from web.dao import import_invoice_dao, product_dao
from web.models import Employee, EmployeeRole, ImportInvoice, ImportInvoiceItem, PaymentMethod, Product, Supplier, SupplierPayment, Warehouse
from web.services.exceptions import ForbiddenError, NotFoundError, ValidationError
from web.services.company_fund_service import record_fund_movement
from web.services.validators import (
    parse_iso_date as parse_date,
    validate_money_amount,
    validate_positive_number,
    validate_strict_positive_integer as validate_positive_integer,
)
from web.utils.pagination import parse_page, parse_per_page, parse_paging_args
from web.services.authorization import (
    ensure_bounded_items,
    ensure_warehouse_access,
    require_accountant,
    resolve_document_warehouse,
)
from web.services.payment_service import parse_payment_method
from web.services.supplier_service import get_or_create_supplier


def _validate_inbound_fee(value):
    fee = validate_money_amount(value, "Phí mua hàng về kho", minimum=None)
    if fee > Decimal("999999999999.99"):
        raise ValidationError("Phí mua hàng về kho vượt quá giới hạn lưu trữ")
    return fee


def _validate_import_items(items):
    ensure_bounded_items(items, "Sản phẩm trong phiếu nhập")
    if not isinstance(items, list) or not items:
        raise ValidationError("Phiếu nhập phải có ít nhất 1 sản phẩm")

    normalized = []
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
        normalized.append({
            "product_id": product_id,
            "quantity": validate_positive_integer(
                item.get("quantity"),
                f"Số lượng (item {index})",
            ),
            "unit_price": validate_money_amount(
                item.get("unit_price"),
                f"Đơn giá (item {index})",
                allow_zero=False,
            ),
        })
        normalized[-1]["line_total"] = normalized[-1]["quantity"] * normalized[-1]["unit_price"]

    return normalized


def _prepare_import_lines(items, combo_groups, excluded_invoice_id=None, imported_at=None):
    """Resolve bundle prices into exact product line totals."""
    if not isinstance(combo_groups, list) or len(combo_groups) > 30:
        raise ValidationError("Danh sách combo không hợp lệ")
    if not isinstance(items, list):
        raise ValidationError("Danh sách sản phẩm không hợp lệ")
    if not items and not combo_groups:
        raise ValidationError("Phiếu nhập cần có sản phẩm hoặc combo")
    singles = _validate_import_items(items) if items else []
    groups = []
    product_ids = {line["product_id"] for line in singles}
    for group_index, group in enumerate(combo_groups, 1):
        if not isinstance(group, dict):
            raise ValidationError("Combo không hợp lệ")
        name = str(group.get("name") or "").strip()
        if not name or len(name) > 150:
            raise ValidationError(f"Tên combo {group_index} không hợp lệ")
        sets = validate_positive_integer(group.get("sets"), "Số bộ combo")
        if sets > 100000:
            raise ValidationError("Số bộ combo không được vượt quá 100.000")
        price = validate_money_amount(group.get("bundle_price"), "Giá một bộ", allow_zero=False)
        if price != price.quantize(Decimal("1")):
            raise ValidationError("Giá combo phải là số đồng nguyên")
        parts = group.get("parts")
        if not isinstance(parts, list) or not 2 <= len(parts) <= 20:
            raise ValidationError("Combo cần từ 2 đến 20 sản phẩm")
        normalized_parts = []
        seen = set()
        for part in parts:
            if not isinstance(part, dict):
                raise ValidationError("Thành phần combo không hợp lệ")
            pid = validate_positive_integer(part.get("product_id"), "Sản phẩm combo")
            qty = validate_positive_integer(part.get("quantity_per_set"), "Số lượng trong bộ")
            if pid in seen:
                raise ValidationError("Sản phẩm bị lặp trong cùng combo")
            seen.add(pid)
            product_ids.add(pid)
            normalized_parts.append({"product_id": pid, "quantity_per_set": qty,
                                     "allocated_total": part.get("allocated_total"),
                                     "unit_price": part.get("unit_price")})
        groups.append({"name": name, "sets": sets, "bundle_price": price,
                       "allocation_mode": group.get("allocation_mode", "equal"),
                       "parts": normalized_parts})
    ensure_bounded_items(singles + [p for g in groups for p in g["parts"]], "Sản phẩm trong phiếu nhập")
    existing_ids = {pid for (pid,) in db.session.query(Product.id).filter(Product.id.in_(product_ids)).all()} if product_ids else set()
    if existing_ids != product_ids:
        raise NotFoundError("Có sản phẩm trong phiếu nhập không tồn tại")

    auto_ids = {p["product_id"] for g in groups if g["allocation_mode"] == "auto" for p in g["parts"]}
    costs = {}
    if auto_ids:
        cost_query = db.session.query(
            ImportInvoiceItem.product_id,
            func.sum(ImportInvoiceItem.quantity),
            func.sum(func.coalesce(ImportInvoiceItem.line_total, ImportInvoiceItem.quantity * ImportInvoiceItem.unit_price)),
        ).filter(ImportInvoiceItem.product_id.in_(auto_ids))
        if imported_at is not None:
            next_day = datetime.combine(imported_at.date() + timedelta(days=1), time.min)
            cost_query = cost_query.join(ImportInvoice).filter(ImportInvoice.imported_at < next_day)
        if excluded_invoice_id is not None:
            cost_query = cost_query.filter(ImportInvoiceItem.import_invoice_id != excluded_invoice_id)
        costs = {pid: Decimal(str(amount)) / Decimal(str(qty))
                 for pid, qty, amount in cost_query.group_by(ImportInvoiceItem.product_id).all() if qty and amount}

    lines = {line["product_id"]: dict(line) for line in singles}
    snapshots = []
    dong = Decimal("1")
    for group in groups:
        total = group["bundle_price"] * group["sets"]
        parts = group["parts"]
        if group["allocation_mode"] == "equal":
            quantities = [part["quantity_per_set"] * group["sets"] for part in parts]
            unit_count = sum(quantities)
            if total < unit_count:
                raise ValidationError(f"Giá combo '{group['name']}' quá thấp để chia cho từng sản phẩm")
            base, remainder = divmod(int(total), unit_count)
            amounts = []
            for quantity in quantities:
                extra = min(remainder, quantity)
                amounts.append(Decimal(base * quantity + extra))
                remainder -= extra
        elif group["allocation_mode"] == "supplier_prices":
            unit_prices = [validate_money_amount(p["unit_price"], "Giá nhà cung cấp báo cho một món", allow_zero=False, minimum=None)
                           for p in parts]
            if any(price != price.quantize(dong) for price in unit_prices):
                raise ValidationError("Giá nhà cung cấp báo cho từng món phải là số đồng nguyên")
            amounts = [price * part["quantity_per_set"] * group["sets"]
                       for price, part in zip(unit_prices, parts)]
            if sum(amounts) != total:
                raise ValidationError(f"Tổng giá từng món do nhà cung cấp báo trong combo '{group['name']}' phải bằng giá trọn combo × số bộ ({total} đồng)")
        elif group["allocation_mode"] == "auto":
            if any(costs.get(p["product_id"], 0) <= 0 for p in parts):
                raise ValidationError(f"Combo '{group['name']}' có sản phẩm chưa có giá nhập tham khảo. Hãy chọn tự chia giá combo cho từng sản phẩm.")
            weights = [costs[p["product_id"]] * p["quantity_per_set"] for p in parts]
            weight_sum = sum(weights)
            amounts = []
            remaining = total
            for index, weight in enumerate(weights[:-1]):
                suggested = (total * weight / weight_sum).quantize(dong, rounding=ROUND_HALF_UP)
                amount = max(dong, min(suggested, remaining - dong * (len(parts) - index - 1)))
                amounts.append(amount)
                remaining -= amount
            amounts.append(remaining)
        elif group["allocation_mode"] == "manual":
            amounts = [validate_money_amount(p["allocated_total"], "Phần giá combo của sản phẩm", allow_zero=False, minimum=None)
                       for p in parts]
            if any(amount != amount.quantize(dong) for amount in amounts):
                raise ValidationError("Phần giá combo của sản phẩm phải là số đồng nguyên")
            if sum(amounts) != total:
                raise ValidationError(f"Tổng phần giá combo tính cho các sản phẩm trong '{group['name']}' phải bằng {total} đồng")
        else:
            raise ValidationError("Cách chia giá combo không hợp lệ")
        snapshot_parts = []
        for index, (part, amount) in enumerate(zip(parts, amounts)):
            if amount <= 0:
                raise ValidationError("Phần giá combo của mỗi sản phẩm phải lớn hơn 0")
            pid = part["product_id"]
            quantity = part["quantity_per_set"] * group["sets"]
            line = lines.setdefault(pid, {"product_id": pid, "quantity": 0,
                                          "line_total": Decimal("0"), "unit_price": Decimal("0")})
            line["quantity"] += quantity
            line["line_total"] += amount
            snapshot_part = {"product_id": pid, "quantity_per_set": part["quantity_per_set"],
                             "allocated_total": str(amount)}
            if group["allocation_mode"] == "supplier_prices":
                snapshot_part["unit_price"] = str(unit_prices[index])
            snapshot_parts.append(snapshot_part)
        snapshots.append({"name": group["name"], "sets": group["sets"],
                          "bundle_price": str(group["bundle_price"]),
                          "allocation_mode": group["allocation_mode"], "parts": snapshot_parts})
    for line in lines.values():
        line["unit_price"] = (line["line_total"] / line["quantity"]).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return list(lines.values()), snapshots


def preview_import_combos_service(items, combo_groups, imported_at=None, invoice_id=None, employee_id=None):
    date = parse_date(imported_at) if imported_at not in (None, "") else datetime.now()
    excluded_id = None
    if invoice_id not in (None, ""):
        excluded_id = validate_positive_integer(invoice_id, "Mã phiếu nhập")
        invoice_warehouse_id = db.session.query(ImportInvoice.warehouse_id).filter_by(id=excluded_id).scalar()
        if invoice_warehouse_id is None:
            raise NotFoundError("Phiếu nhập không tồn tại")
        ensure_warehouse_access(employee_id, invoice_warehouse_id)
    lines, groups = _prepare_import_lines(items or [], combo_groups or [], excluded_id, date)
    return {
        "combo_groups": groups,
        "total_amount": float(sum((line["line_total"] for line in lines), Decimal("0"))),
    }


def _resolve_supplier(supplier_id, supplier_data=None, employee_role=None):
    if supplier_data is not None and employee_role != EmployeeRole.QUAN_LY:
        raise ForbiddenError("Chỉ quản lý được thêm nhà cung cấp mới")
    supplier_id = validate_positive_integer(supplier_id, "Mã nhà cung cấp") if supplier_id not in (None, "") else None
    if supplier_id:
        supplier = Supplier.query.get(supplier_id)
        if not supplier:
            raise NotFoundError("Nhà cung cấp không tồn tại")
        return supplier

    if not isinstance(supplier_data, dict):
        raise ValidationError("Vui lòng chọn nhà cung cấp hoặc nhập nhà cung cấp mới")
    supplier, _ = get_or_create_supplier(
        supplier_data.get("name"),
        supplier_data.get("address"),
        supplier_data.get("phone"),
    )
    return supplier


def _import_line_total(item):
    if item.line_total is not None:
        return Decimal(str(item.line_total))
    return Decimal(str(item.quantity)) * Decimal(str(item.unit_price))


def _calculate_import_total(invoice):
    return sum((_import_line_total(item) for item in invoice.items), Decimal("0"))


def _supplier_paid_total(invoice):
    return sum(Decimal(str(payment.amount)) for payment in invoice.payments)


def _validate_supplier_payment(invoice_total, amount, payment_method):
    amount = validate_money_amount(amount, "Sá»‘ tiá»n tráº£ nhÃ  cung cáº¥p")
    if amount <= 0:
        return None
    payment_method = parse_payment_method(payment_method)
    if amount > invoice_total:
        raise ValidationError("Sá»‘ tiá»n tráº£ khÃ´ng Ä‘Æ°á»£c vÆ°á»£t quÃ¡ tá»•ng tiá»n phiáº¿u nháº­p")
    return {"amount": amount, "payment_method": payment_method, "note": None}


def serialize_import_invoice(invoice):
                                                       
    items_data = []
    total_decimal = Decimal("0")

    for item in invoice.items:
        item_total_decimal = _import_line_total(item)
        total_decimal += item_total_decimal
        item_total = float(item_total_decimal)

        items_data.append({
            "id": item.id,
            "product_id": item.product_id,
            "product_name": item.product.name,
            "unit": item.product.unit,
            "quantity": int(item.quantity),
            "unit_price": float(item.unit_price),
            "total": item_total
        })

    paid_amount = _supplier_paid_total(invoice)
    remaining_amount = max(Decimal("0"), total_decimal - paid_amount)
    return {
        "id": invoice.id,
        "inbound_fee": float(invoice.inbound_fee or 0),
        "imported_at": invoice.imported_at.isoformat() if invoice.imported_at else None,
        "note": invoice.note,
        "combo_groups": invoice.combo_groups or [],
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
        "total_amount": float(total_decimal),
        "paid_amount": float(paid_amount),
        "remaining_amount": float(remaining_amount),
        "payment_status": "paid" if remaining_amount <= 0 else ("partial" if paid_amount > 0 else "unpaid"),
        "payments": [
            {
                "id": payment.id,
                "amount": float(payment.amount),
                "payment_method": payment.payment_method.value,
                "paid_at": payment.paid_at.isoformat() if payment.paid_at else None,
                "note": payment.note,
                "employee_id": payment.employee_id,
            }
            for payment in invoice.payments
        ]
    }


def serialize_import_invoice_summary(invoice):
                                                        
    total_decimal = _calculate_import_total(invoice)
    paid_amount = _supplier_paid_total(invoice)
    remaining_amount = max(Decimal("0"), total_decimal - paid_amount)
    return {
        "id": invoice.id,
        "inbound_fee": float(invoice.inbound_fee or 0),
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
        "total_amount": float(total_decimal),
        "paid_amount": float(paid_amount),
        "remaining_amount": float(remaining_amount),
        "payment_status": "paid" if remaining_amount <= 0 else ("partial" if paid_amount > 0 else "unpaid"),
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


def update_import_inbound_fee_service(invoice_id, employee_id, inbound_fee):
    invoice = ImportInvoice.query.filter_by(id=invoice_id).with_for_update().first()
    if invoice is None:
        raise NotFoundError("Phiếu nhập không tồn tại")
    ensure_warehouse_access(employee_id, invoice.warehouse_id)
    invoice.inbound_fee = _validate_inbound_fee(inbound_fee)
    db.session.commit()
    return import_invoice_dao.get_import_invoice_by_id(invoice.id)


def create_import_invoice_service(employee_id, warehouse_id, supplier_id, supplier_data=None, note="", items=None, combo_groups=None, is_return=False, imported_at=None, payment_amount=0, payment_method=None, inbound_fee=0):
       
                    
    if not items and not combo_groups:
        raise ValidationError("Phiếu nhập phải có ít nhất 1 sản phẩm")

                               
    imported_at = parse_date(imported_at) if imported_at not in (None, "") else datetime.now()
    employee = Employee.query.get(employee_id)
    if not employee:
        raise NotFoundError("Nhân viên không tồn tại")

    validated_items, combo_snapshots = _prepare_import_lines(items or [], combo_groups or [], imported_at=imported_at)

                                
    warehouse = resolve_document_warehouse(employee_id, warehouse_id)
    warehouse_id = warehouse.id

                               
    supplier = _resolve_supplier(supplier_id, supplier_data, employee.role)
    supplier_id = supplier.id

    if (validate_money_amount(payment_amount, "Số tiền trả nhà cung cấp") > 0
            or payment_method not in (None, "")):
        raise ValidationError("Kế toán ghi nhận thanh toán sau khi lập phiếu nhập")

                                
    final_note = note.strip() if note else ""
    if is_return:
        final_note = f"[TRẢ HÀNG] {final_note}" if final_note else "[TRẢ HÀNG]"

                        
    invoice = import_invoice_dao.create_import_invoice(
        warehouse_id=warehouse_id,
        supplier_id=supplier_id,
        employee_id=employee_id,
        imported_at=imported_at,
        note=final_note,
        items=validated_items,
        combo_groups=combo_snapshots,
        inbound_fee=_validate_inbound_fee(inbound_fee),
        payment=None,
    )

    return invoice


def record_supplier_payment_service(invoice_id, employee_id, amount, payment_method, note=""):
    require_accountant(employee_id)
    # Serialize concurrent payments for the same invoice so two requests cannot
    # both observe the same remaining balance and overpay the supplier.
    invoice = ImportInvoice.query.with_for_update().filter_by(id=invoice_id).first()
    if not invoice:
        raise NotFoundError("Phiáº¿u nháº­p khÃ´ng tá»“n táº¡i")

    invoice_total = _calculate_import_total(invoice)
    paid_amount = _supplier_paid_total(invoice)
    remaining_amount = invoice_total - paid_amount
    payment = _validate_supplier_payment(remaining_amount, amount, payment_method)
    if not payment:
        raise ValidationError("Sá»‘ tiá»n tráº£ nhÃ  cung cáº¥p pháº£i lá»›n hÆ¡n hoáº·c báº±ng 500")
    payment["note"] = str(note or "").strip() or None
    payment_record = SupplierPayment(
        supplier_id=invoice.supplier_id,
        import_invoice_id=invoice.id,
        employee_id=employee_id,
        amount=payment["amount"],
        payment_method=payment["payment_method"],
        note=payment["note"],
    )
    try:
        db.session.add(payment_record)
        db.session.flush()
        record_fund_movement(
            payment_record.payment_method, "out", payment_record.amount,
            "supplier_payment", payment_record.id, employee_id,
            f"Trả nhà cung cấp · Phiếu nhập #{invoice.id}", payment_record.note,
        )
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise
    return import_invoice_dao.get_import_invoice_by_id(invoice.id), payment_record


def update_import_invoice_service(invoice_id, employee_id, warehouse_id, supplier_id, supplier_data=None, note="", items=None, combo_groups=None, is_return=False, imported_at=None, inbound_fee=0):
       
                              
    invoice = import_invoice_dao.get_import_invoice_by_id(invoice_id)
    if not invoice:
        raise NotFoundError("Phiếu nhập không tồn tại")

    employee = Employee.query.get(employee_id)
    if not employee:
        raise NotFoundError("Nhân viên không tồn tại")

    if invoice.payments:
        raise ValidationError("KhÃ´ng thá»ƒ sá»­a phiáº¿u nháº­p Ä‘Ã£ phÃ¡t sinh thanh toÃ¡n cho nhÃ  cung cáº¥p")

    # Authorize the existing document before accepting a client-supplied
    # warehouse_id. Otherwise a warehouse-scoped employee could edit a
    # document from another warehouse by submitting their own warehouse id.
    ensure_warehouse_access(employee_id, invoice.warehouse_id)

                    
    if not items and not combo_groups:
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

                               
    validated_items, combo_snapshots = _prepare_import_lines(items or [], combo_groups or [], invoice_id, imported_at)

    supplier = _resolve_supplier(supplier_id, supplier_data, employee.role)
    supplier_id = supplier.id


    old_items = {item.product_id: float(item.quantity) for item in invoice.items}
    old_product_names = {item.product_id: item.product.name for item in invoice.items}

    if invoice.warehouse_id != warehouse_id:
        old_stock_by_product = product_dao.calculate_available_stock_for_items_at_warehouse(
            list(old_items),
            invoice.warehouse_id,
        )
        for product_id, old_quantity in old_items.items():
            old_stock = old_stock_by_product[product_id]
            if old_stock["available_stock"] - old_quantity < 0:
                raise ValidationError(
                    f"KhÃ´ng thá»ƒ chuyá»ƒn phiáº¿u nháº­p vÃ¬ sáº£n pháº©m '{old_product_names[product_id]}' "
                    f"Ä‘Ã£ Ä‘Æ°á»£c báº£n hoáº·c xuáº¥t khá»i kho cÅ©."
                )
    
                                    
    new_items_by_product = {
        item["product_id"]: item["quantity"]
        for item in validated_items
    }
    stock_by_product = product_dao.calculate_available_stock_for_items_at_warehouse(
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
                raise ValidationError(
                    f"Không thể sửa phiếu nhập vì sản phẩm '{old_product_names[product_id]}' "
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
        items=validated_items,
        combo_groups=combo_snapshots,
        inbound_fee=_validate_inbound_fee(inbound_fee),
    )

    return updated_invoice


def delete_import_invoice_service(invoice_id):
       
                              
    invoice = import_invoice_dao.get_import_invoice_by_id(invoice_id)
    if not invoice:
        raise NotFoundError("Phiếu nhập không tồn tại")

                                                          
    if invoice.payments:
        raise ValidationError("KhÃ´ng thá»ƒ xÃ³a phiáº¿u nháº­p Ä‘Ã£ phÃ¡t sinh thanh toÃ¡n cho nhÃ  cung cáº¥p")

    stock_by_product = product_dao.calculate_available_stock_for_items_at_warehouse(
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
