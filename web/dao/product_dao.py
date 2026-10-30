from decimal import Decimal

from sqlalchemy import func
from web import app, db
from web.models import (
    DamageReport,
    DamageReportItem,
    DamageReportStatus,
    Employee,
    EmployeeRole,
    ImportInvoice,
    ImportInvoiceItem,
    InvoiceStatus,
    Product,
    SalesInvoice,
    SalesInvoiceItem,
    SaleSource,
    StockTransfer,
    StockTransferItem,
    Warehouse,
)
from web.services.inventory_policy import STOCK_DEDUCTING_SALES_STATUSES
from web.services.inventory_settings_service import get_low_stock_percentage
from .stock_allocation import allocate_field_movements_to_transfers


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


def _empty_inventory():
    return {
        "total_imported": 0,
        "total_sold": 0,
        "total_damaged": 0,
        "total_transferred": 0,
        "available_stock": 0,
        "warehouses": {},
    }


def calculate_allocated_employee_stock_movements(product_ids, employee_id=None):
    """Return field sales and damage allocated to their source transfer lots."""
    product_ids = list({int(product_id) for product_id in product_ids})
    if not product_ids:
        return {}, {}, {}, {}

    lots_query = (
        db.session.query(
            StockTransferItem.id.label("item_id"),
            StockTransferItem.product_id.label("product_id"),
            StockTransferItem.quantity.label("quantity"),
            StockTransfer.id.label("transfer_id"),
            StockTransfer.employee_id.label("employee_id"),
            StockTransfer.warehouse_id.label("warehouse_id"),
            StockTransfer.transferred_at.label("transferred_at"),
        )
        .join(StockTransfer, StockTransfer.id == StockTransferItem.stock_transfer_id)
        .filter(StockTransferItem.product_id.in_(product_ids))
    )
    if employee_id is not None:
        lots_query = lots_query.filter(StockTransfer.employee_id == employee_id)
    lots = lots_query.all()
    if not lots:
        return {}, {}, {}, {}

    employee_ids = {lot.employee_id for lot in lots}
    sales = (
        db.session.query(
            SalesInvoiceItem.id.label("sale_item_id"),
            SalesInvoiceItem.product_id.label("product_id"),
            SalesInvoiceItem.quantity.label("quantity"),
            SalesInvoice.id.label("invoice_id"),
            SalesInvoice.employee_id.label("employee_id"),
            SalesInvoice.sold_at.label("sold_at"),
        )
        .join(SalesInvoice, SalesInvoice.id == SalesInvoiceItem.sales_invoice_id)
        .filter(
            SalesInvoiceItem.product_id.in_(product_ids),
            SalesInvoice.employee_id.in_(employee_ids),
            SalesInvoice.sale_source == SaleSource.EMPLOYEE_STOCK,
            SalesInvoice.status == InvoiceStatus.COMPLETED,
        )
        .all()
    )
    damages = (
        db.session.query(
            DamageReportItem.id.label("damage_item_id"),
            DamageReportItem.product_id.label("product_id"),
            DamageReportItem.quantity.label("quantity"),
            DamageReport.id.label("report_id"),
            DamageReport.reported_by_employee_id.label("employee_id"),
            DamageReport.reported_at.label("reported_at"),
        )
        .join(DamageReport, DamageReport.id == DamageReportItem.damage_report_id)
        .join(Employee, Employee.id == DamageReport.reported_by_employee_id)
        .filter(
            DamageReportItem.product_id.in_(product_ids),
            DamageReport.reported_by_employee_id.in_(employee_ids),
            DamageReport.status != DamageReportStatus.REJECTED,
            Employee.role == EmployeeRole.NHAN_VIEN_BAN_HANG,
        )
        .all()
    )
    sold_by_item, damaged_by_item = allocate_field_movements_to_transfers(lots, sales, damages)
    sold_by_product_warehouse = {}
    damaged_by_product_warehouse = {}
    for lot in lots:
        key = (lot.product_id, lot.warehouse_id)
        sold_by_product_warehouse[key] = sold_by_product_warehouse.get(key, 0) + sold_by_item.get(lot.item_id, 0)
        damaged_by_product_warehouse[key] = damaged_by_product_warehouse.get(key, 0) + damaged_by_item.get(lot.item_id, 0)
    return sold_by_item, damaged_by_item, sold_by_product_warehouse, damaged_by_product_warehouse


def calculate_allocated_employee_stock_sales(product_ids, employee_id=None):
    sold, _, sold_by_warehouse, _ = calculate_allocated_employee_stock_movements(product_ids, employee_id)
    return sold, sold_by_warehouse


def _inventory_for_products(product_ids, warehouse_id=None, exclude_invoice_id=None):
    product_ids = list({int(product_id) for product_id in product_ids})
    if not product_ids:
        return {}

    inventory = {product_id: _empty_inventory() for product_id in product_ids}

    import_rows = (
        db.session.query(
            ImportInvoiceItem.product_id,
            Warehouse.id.label("warehouse_id"),
            Warehouse.name.label("warehouse_name"),
            func.sum(ImportInvoiceItem.quantity).label("quantity"),
        )
        .join(ImportInvoice, ImportInvoiceItem.import_invoice_id == ImportInvoice.id)
        .join(Warehouse, ImportInvoice.warehouse_id == Warehouse.id)
        .filter(ImportInvoiceItem.product_id.in_(product_ids))
    )
    sales_rows = (
        db.session.query(
            SalesInvoiceItem.product_id,
            Warehouse.id.label("warehouse_id"),
            Warehouse.name.label("warehouse_name"),
            func.sum(SalesInvoiceItem.quantity).label("quantity"),
        )
        .join(SalesInvoice, SalesInvoiceItem.sales_invoice_id == SalesInvoice.id)
        .join(Warehouse, SalesInvoice.warehouse_id == Warehouse.id)
        .filter(
            SalesInvoiceItem.product_id.in_(product_ids),
            # Once an order leaves draft, its goods are considered sold from
            # the central warehouse. Draft and cancelled orders do not reduce
            # stock and therefore are intentionally excluded here.
            SalesInvoice.status.in_(STOCK_DEDUCTING_SALES_STATUSES),
            SalesInvoice.sale_source == SaleSource.CENTRAL_WAREHOUSE,
        )
    )
    transfer_rows = (
        db.session.query(
            StockTransferItem.product_id,
            Warehouse.id.label("warehouse_id"),
            Warehouse.name.label("warehouse_name"),
            func.sum(StockTransferItem.quantity).label("quantity"),
        )
        .join(StockTransfer, StockTransferItem.stock_transfer_id == StockTransfer.id)
        .join(Warehouse, StockTransfer.warehouse_id == Warehouse.id)
        .filter(StockTransferItem.product_id.in_(product_ids))
    )
    damage_rows = (
        db.session.query(
            DamageReportItem.product_id,
            Warehouse.id.label("warehouse_id"),
            Warehouse.name.label("warehouse_name"),
            func.sum(DamageReportItem.quantity).label("quantity"),
        )
        .join(DamageReport, DamageReportItem.damage_report_id == DamageReport.id)
        .join(Employee, Employee.id == DamageReport.reported_by_employee_id)
        .join(Warehouse, DamageReport.warehouse_id == Warehouse.id)
        .filter(
            DamageReportItem.product_id.in_(product_ids),
            DamageReport.status != DamageReportStatus.REJECTED,
            Employee.role != EmployeeRole.NHAN_VIEN_BAN_HANG,
        )
    )

    if warehouse_id is not None:
        import_rows = import_rows.filter(Warehouse.id == warehouse_id)
        sales_rows = sales_rows.filter(Warehouse.id == warehouse_id)
        damage_rows = damage_rows.filter(Warehouse.id == warehouse_id)
        transfer_rows = transfer_rows.filter(Warehouse.id == warehouse_id)
    if exclude_invoice_id is not None:
        sales_rows = sales_rows.filter(SalesInvoice.id != exclude_invoice_id)

    import_rows = import_rows.group_by(
        ImportInvoiceItem.product_id, Warehouse.id, Warehouse.name
    ).all()
    sales_rows = sales_rows.group_by(
        SalesInvoiceItem.product_id, Warehouse.id, Warehouse.name
    ).all()
    damage_rows = damage_rows.group_by(
        DamageReportItem.product_id, Warehouse.id, Warehouse.name
    ).all()
    transfer_rows = transfer_rows.group_by(
        StockTransferItem.product_id, Warehouse.id, Warehouse.name
    ).all()

    def add_rows(rows, field):
        total_field = {
            "imported": "total_imported",
            "sold": "total_sold",
            "damaged": "total_damaged",
            "transferred": "total_transferred",
        }[field]
        for row in rows:
            quantity = int(row.quantity or 0)
            data = inventory[row.product_id]
            data[total_field] += quantity
            warehouse = data["warehouses"].setdefault(
                row.warehouse_id,
                {
                    "warehouse_id": row.warehouse_id,
                    "warehouse_name": row.warehouse_name,
                    "imported": 0,
                    "sold": 0,
                    "damaged": 0,
                    "transferred": 0,
                    "stock": 0,
                },
            )
            warehouse[field] += quantity

    add_rows(import_rows, "imported")
    add_rows(sales_rows, "sold")
    add_rows(damage_rows, "damaged")
    add_rows(transfer_rows, "transferred")

    # A transfer remains "issued" only while the employee still holds it.
    # Field sales move the consumed quantity from issued to sold, leaving
    # warehouse stock unchanged because the goods left at transfer time.
    _, _, field_sales_by_warehouse, field_damage_by_warehouse = (
        calculate_allocated_employee_stock_movements(product_ids)
        if transfer_rows else ({}, {}, {}, {})
    )
    for (product_id, source_warehouse_id), quantity in field_sales_by_warehouse.items():
        if warehouse_id is not None and source_warehouse_id != warehouse_id:
            continue
        data = inventory[product_id]
        source = data["warehouses"].get(source_warehouse_id)
        if source is None:
            continue
        data["total_sold"] += quantity
        data["total_transferred"] -= quantity
        source["sold"] += quantity
        source["transferred"] -= quantity

    for (product_id, source_warehouse_id), quantity in field_damage_by_warehouse.items():
        if warehouse_id is not None and source_warehouse_id != warehouse_id:
            continue
        data = inventory[product_id]
        source = data["warehouses"].get(source_warehouse_id)
        if source is None:
            continue
        data["total_damaged"] += quantity
        data["total_transferred"] -= quantity
        source["damaged"] += quantity
        source["transferred"] -= quantity

    for data in inventory.values():
        for warehouse in data["warehouses"].values():
            warehouse["stock"] = max(
                0,
                warehouse["imported"]
                - warehouse["sold"]
                - warehouse["damaged"]
                - warehouse["transferred"],
            )
        data["warehouses"] = sorted(
            data["warehouses"].values(),
            key=lambda warehouse: warehouse["warehouse_id"],
        )
        physical_stock = max(
            0,
            data["total_imported"]
            - data["total_sold"]
            - data["total_damaged"]
            - data["total_transferred"],
        )
        data["available_stock"] = physical_stock

    return inventory


def calculate_stock_for_items_at_warehouse(product_ids, warehouse_id, exclude_invoice_id=None):
    inventory = _inventory_for_products(
        product_ids,
        warehouse_id=warehouse_id,
        exclude_invoice_id=exclude_invoice_id,
    )
    return {
        product_id: {
            "total_imported": data["total_imported"],
            "total_sold": data["total_sold"],
            "total_damaged": data["total_damaged"],
            "available_stock": data["available_stock"],
            "physical_stock": data["available_stock"],
        }
        for product_id, data in inventory.items()
    }


def calculate_available_stock_for_items_at_warehouse(
    product_ids,
    warehouse_id,
    exclude_invoice_id=None,
):
    """Return stock available for a new operation.

    Confirmed sales are already included in ``total_sold`` above, so no
    second reservation subtraction is applied here.
    """
    return calculate_stock_for_items_at_warehouse(
        product_ids,
        warehouse_id,
        exclude_invoice_id=exclude_invoice_id,
    )


def calculate_inventory_for_products(
    product_ids,
    warehouse_id=None,
    exclude_invoice_id=None,
):
    return _inventory_for_products(
        product_ids,
        warehouse_id=warehouse_id,
        exclude_invoice_id=exclude_invoice_id,
    )


def _inventory_status_key(inventory, low_stock_percentage):
    stock = Decimal(str(inventory.get("available_stock", 0) or 0))
    imported = Decimal(str(inventory.get("total_imported", 0) or 0))

    if stock <= 0:
        return "empty"
    if imported > 0 and stock <= imported * Decimal(str(low_stock_percentage)) / Decimal("100"):
        return "low"
    return "available"


def get_products_with_inventory(
    page=1,
    per_page=None,
    keyword=None,
    warehouse_id=None,
    product_id=None,
    min_price=None,
    max_price=None,
    status=None,
):
    query = Product.query

    if product_id:
        query = query.filter(Product.id == product_id)
    if keyword:
        kw = f"%{keyword.strip()}%"
        query = query.filter(Product.name.ilike(kw))
    if min_price is not None:
        query = query.filter(Product.default_sale_price >= min_price)
    if max_price is not None:
        query = query.filter(Product.default_sale_price <= max_price)

    query = query.order_by(Product.name.asc())

    if status:
        low_stock_percentage = get_low_stock_percentage()
        page_size = per_page or app.config.get("APPLICATION_SIZE", 10)
        page = page if page and page > 0 else 1
        start = (page - 1) * page_size
        end = start + page_size
        batch_size = 500
        last_name = None
        total = 0
        products = []
        inventory_by_product = {}

        # Inventory status depends on historical movements, so it cannot be
        # filtered by the product table alone. Scan in name order and compute
        # each bounded batch, retaining only the requested page in memory.
        while True:
            batch_query = query
            if last_name is not None:
                batch_query = batch_query.filter(Product.name > last_name)
            batch = batch_query.limit(batch_size).all()
            if not batch:
                break
            batch_inventory = _inventory_for_products(
                [product.id for product in batch],
                warehouse_id=warehouse_id,
            )
            for product in batch:
                inventory_data = batch_inventory.get(product.id, _empty_inventory())
                if _inventory_status_key(inventory_data, low_stock_percentage) != status:
                    continue
                if start <= total < end:
                    products.append(product)
                    inventory_by_product[product.id] = inventory_data
                total += 1
            if len(batch) < batch_size:
                break
            last_name = batch[-1].name
    else:
        query, total = apply_pagination(query, page, page_size=per_page)
        products = query.all()
        inventory_by_product = _inventory_for_products(
            [product.id for product in products],
            warehouse_id=warehouse_id,
        )
    result = []
    for product in products:
        inventory_data = inventory_by_product.get(product.id, _empty_inventory()).copy()
        result.append({
            "product": product,
            "inventory": inventory_data
        })

    return result, total


def calculate_product_inventory(product_id, warehouse_id=None):
    return _inventory_for_products([product_id], warehouse_id=warehouse_id).get(
        product_id,
        _empty_inventory(),
    )



def calculate_product_stock_at_warehouse(product_id, warehouse_id, exclude_invoice_id=None):
    return calculate_stock_for_items_at_warehouse(
        [product_id],
        warehouse_id,
        exclude_invoice_id=exclude_invoice_id,
    ).get(product_id, {
        "total_imported": 0.0,
        "total_sold": 0.0,
        "total_damaged": 0.0,
        "available_stock": 0.0,
    })
