from sqlalchemy import func
from sqlalchemy.orm import selectinload
from web import db
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
from web.dao.product_dao import calculate_inventory_for_products


def get_inventory_report(warehouse_id=None, product_id=None, keyword=None):
       
    from web.dao.product_dao import get_products_with_inventory
    
                                                          
    products_data, total = get_products_with_inventory(
        page=1,
        per_page=10000,           
        keyword=keyword,
        warehouse_id=warehouse_id,
        product_id=product_id,
    )

    return products_data


def get_movements_report(from_date, to_date, warehouse_id=None):
       
                                                  
    import_query = ImportInvoice.query.options(
        selectinload(ImportInvoice.items).selectinload(ImportInvoiceItem.product),
        selectinload(ImportInvoice.warehouse),
        selectinload(ImportInvoice.supplier),
        selectinload(ImportInvoice.created_by_employee),
    )
    
    if from_date:
        import_query = import_query.filter(ImportInvoice.imported_at >= from_date)
    if to_date:
        import_query = import_query.filter(ImportInvoice.imported_at <= to_date)
    if warehouse_id:
        import_query = import_query.filter(ImportInvoice.warehouse_id == warehouse_id)
    
    import_invoices = import_query.order_by(ImportInvoice.imported_at.desc()).all()
    
                                                                           
    sales_query = SalesInvoice.query.options(
        selectinload(SalesInvoice.items).selectinload(SalesInvoiceItem.product),
        selectinload(SalesInvoice.customer),
        selectinload(SalesInvoice.warehouse),
        selectinload(SalesInvoice.created_by_employee),
    ).filter(
        SalesInvoice.status == InvoiceStatus.COMPLETED,
        SalesInvoice.sale_source == SaleSource.CENTRAL_WAREHOUSE,
    )
    
    if from_date:
        sales_query = sales_query.filter(SalesInvoice.sold_at >= from_date)
    if to_date:
        sales_query = sales_query.filter(SalesInvoice.sold_at <= to_date)
    if warehouse_id:
        sales_query = sales_query.filter(SalesInvoice.warehouse_id == warehouse_id)
    
    sales_invoices = sales_query.order_by(SalesInvoice.sold_at.desc()).all()

    damage_query = DamageReport.query.options(
        selectinload(DamageReport.items).selectinload(DamageReportItem.product),
        selectinload(DamageReport.warehouse),
        selectinload(DamageReport.reported_by_employee),
        selectinload(DamageReport.reviewed_by_employee),
    ).filter(DamageReport.status == DamageReportStatus.APPROVED)
    if from_date:
        damage_query = damage_query.filter(DamageReport.reported_at >= from_date)
    if to_date:
        damage_query = damage_query.filter(DamageReport.reported_at <= to_date)
    if warehouse_id:
        damage_query = damage_query.filter(DamageReport.warehouse_id == warehouse_id)
    damage_reports = damage_query.order_by(DamageReport.reported_at.desc()).all()

    transfer_query = StockTransfer.query.options(
        selectinload(StockTransfer.items).selectinload(StockTransferItem.product),
        selectinload(StockTransfer.warehouse),
        selectinload(StockTransfer.recipient_employee),
        selectinload(StockTransfer.created_by_employee),
    )
    if from_date:
        transfer_query = transfer_query.filter(StockTransfer.transferred_at >= from_date)
    if to_date:
        transfer_query = transfer_query.filter(StockTransfer.transferred_at <= to_date)
    if warehouse_id:
        transfer_query = transfer_query.filter(StockTransfer.warehouse_id == warehouse_id)
    stock_transfers = transfer_query.order_by(StockTransfer.transferred_at.desc()).all()
    
                            
    all_products = Product.query.order_by(Product.name.asc()).all()
    product_summary = {
        product.id: {
            "product_id": product.id,
            "product_name": product.name,
            "unit": product.unit,
            "imported": 0,
            "exported": 0,
            "damaged": 0,
            "transferred": 0,
        }
        for product in all_products
    }
    
                                       
    for invoice in import_invoices:
        for item in invoice.items:
            if item.product_id not in product_summary:
                product_summary[item.product_id] = {
                    "product_id": item.product_id,
                    "product_name": item.product.name,
                    "unit": item.product.unit,
                    "imported": 0,
                    "exported": 0,
                    "damaged": 0,
                    "transferred": 0,
                }
            product_summary[item.product_id]["imported"] += int(item.quantity)
    
                                      
    for invoice in sales_invoices:
        for item in invoice.items:
            if item.product_id not in product_summary:
                product_summary[item.product_id] = {
                    "product_id": item.product_id,
                    "product_name": item.product.name,
                    "unit": item.product.unit,
                    "imported": 0,
                    "exported": 0,
                    "damaged": 0,
                    "transferred": 0,
                }
            product_summary[item.product_id]["exported"] += int(item.quantity)

    for report in damage_reports:
        for item in report.items:
            if item.product_id not in product_summary:
                product_summary[item.product_id] = {
                    "product_id": item.product_id,
                    "product_name": item.product.name,
                    "unit": item.product.unit,
                    "imported": 0,
                    "exported": 0,
                    "damaged": 0,
                    "transferred": 0,
                }
            product_summary[item.product_id]["damaged"] += int(item.quantity)

    for transfer in stock_transfers:
        for item in transfer.items:
            if item.product_id not in product_summary:
                product_summary[item.product_id] = {
                    "product_id": item.product_id,
                    "product_name": item.product.name,
                    "unit": item.product.unit,
                    "imported": 0,
                    "exported": 0,
                    "damaged": 0,
                    "transferred": 0,
                }
            product_summary[item.product_id]["transferred"] += int(item.quantity)
    
                                               
    inventory_by_product = calculate_inventory_for_products(
        list(product_summary.keys()),
        warehouse_id=warehouse_id,
    )
    by_product = []
    for product_id, data in product_summary.items():
        data["net_change"] = data["imported"] - data["exported"] - data["damaged"] - data["transferred"]
        data["current_stock"] = inventory_by_product.get(
            product_id,
            {"available_stock": 0},
        )["available_stock"]
        
        by_product.append(data)
    
                               
    by_product.sort(key=lambda x: x["product_name"])
    
    return {
        "import_invoices": import_invoices,
        "sales_invoices": sales_invoices,
        "damage_reports": damage_reports,
        "stock_transfers": stock_transfers,
        "by_product": by_product
    }
