from decimal import Decimal

from sqlalchemy import func
from web import app, db
from web.models import (
    DamageReport,
    DamageReportItem,
    DamageReportStatus,
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


def apply_pagination(query, page, page_size=None):
                                        
    total = query.count()

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
            SalesInvoice.status == InvoiceStatus.COMPLETED,
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
        .join(Warehouse, DamageReport.warehouse_id == Warehouse.id)
        .filter(
            DamageReportItem.product_id.in_(product_ids),
            DamageReport.status == DamageReportStatus.APPROVED,
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
        data["available_stock"] = max(
            0,
            data["total_imported"]
            - data["total_sold"]
            - data["total_damaged"]
            - data["total_transferred"],
        )

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
        }
        for product_id, data in inventory.items()
    }


def calculate_reserved_stock_for_items_at_warehouse(product_ids, warehouse_id, exclude_invoice_id=None):
    """Return quantities reserved by active central-warehouse sales orders."""
    product_ids = list({int(product_id) for product_id in product_ids})
    if not product_ids:
        return {}

    query = (
        db.session.query(
            SalesInvoiceItem.product_id,
            func.sum(SalesInvoiceItem.quantity).label("quantity"),
        )
        .join(SalesInvoice, SalesInvoiceItem.sales_invoice_id == SalesInvoice.id)
        .filter(
            SalesInvoice.warehouse_id == warehouse_id,
            SalesInvoice.sale_source == SaleSource.CENTRAL_WAREHOUSE,
            SalesInvoice.status.in_((InvoiceStatus.PROCESSING, InvoiceStatus.DELIVERING)),
            SalesInvoiceItem.product_id.in_(product_ids),
        )
    )
    if exclude_invoice_id is not None:
        query = query.filter(SalesInvoice.id != exclude_invoice_id)

    return {
        product_id: int(quantity or 0)
        for product_id, quantity in query.group_by(SalesInvoiceItem.product_id).all()
    }


def calculate_inventory_for_products(product_ids, warehouse_id=None):
    return _inventory_for_products(product_ids, warehouse_id=warehouse_id)


def _inventory_status_key(inventory):
    stock = Decimal(str(inventory.get("available_stock", 0) or 0))
    imported = Decimal(str(inventory.get("total_imported", 0) or 0))

    if stock <= 0:
        return "empty"
    if imported > 0 and stock <= imported * Decimal("0.25"):
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
        all_products = query.all()
        all_inventory = _inventory_for_products(
            [product.id for product in all_products],
            warehouse_id=warehouse_id,
        )
        filtered_products = [
            product
            for product in all_products
            if _inventory_status_key(
                all_inventory.get(product.id, _empty_inventory())
            ) == status
        ]
        total = len(filtered_products)
        page_size = per_page or app.config.get("APPLICATION_SIZE", 10)
        page = page if page and page > 0 else 1
        start = (page - 1) * page_size
        products = filtered_products[start : start + page_size]
        inventory_by_product = {
            product.id: all_inventory.get(product.id, _empty_inventory())
            for product in products
        }
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
