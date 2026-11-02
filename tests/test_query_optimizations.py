import os
import unittest
from datetime import datetime

from web import app, db
from web.dao.product_dao import get_products_with_inventory
from web.dao.reports_dao import get_movements_report, get_movements_report_aggregated
from web.models import (
    Customer, DamageReport, DamageReportItem, DamageReportStatus,
    Employee, EmployeeRole, ImportInvoice, ImportInvoiceItem, InvoiceStatus,
    Product, SaleSource, SalesInvoice, SalesInvoiceItem, StockTransfer,
    StockTransferItem, Supplier, Warehouse,
)
from web.services.sales_invoice_service import get_status_tracking_board_service


@unittest.skipUnless(os.environ.get("DATABASE_URL", "").startswith("sqlite"), "Requires an isolated SQLite database")
class QueryOptimizationTest(unittest.TestCase):
    def setUp(self):
        self.context = app.app_context()
        self.context.push()
        db.create_all()

        first = Warehouse(name="Kho A", address="A")
        second = Warehouse(name="Kho B", address="B")
        supplier = Supplier(name="Nhà cung cấp", address="A")
        customer = Customer(full_name="Khách", phone="0911000001", address="A")
        product = Product(name="Sản phẩm", unit="Cái", default_sale_price=150)
        db.session.add_all([first, second, supplier, customer, product])
        db.session.flush()
        self.first_id = first.id
        self.product_id = product.id
        self.customer_id = customer.id

        def employee(number, role):
            person = Employee(
                full_name=f"Nhân viên {number}", phone=f"09000000{number:02d}",
                username=f"query{number}", email=f"query{number}@example.invalid",
                password_hash="x", role=role, is_approved=True, is_locked=False,
            )
            db.session.add(person)
            db.session.flush()
            return person.id

        seller = employee(1, EmployeeRole.NHAN_VIEN_BAN_HANG)
        self.seller_id = seller
        keeper = employee(2, EmployeeRole.THU_KHO)
        manager = employee(3, EmployeeRole.QUAN_LY)

        imported = ImportInvoice(
            warehouse_id=first.id, supplier_id=supplier.id, employee_id=keeper,
            imported_at=datetime(2026, 1, 1, 9),
        )
        imported.items.append(ImportInvoiceItem(product_id=product.id, quantity=10, unit_price=100))
        transfer = StockTransfer(
            warehouse_id=first.id, employee_id=seller, created_by_employee_id=manager,
            transferred_at=datetime(2026, 1, 2, 9),
        )
        transfer.items.append(StockTransferItem(product_id=product.id, quantity=3))
        central_sale = SalesInvoice(
            warehouse_id=first.id, customer_id=customer.id, employee_id=seller,
            status=InvoiceStatus.COMPLETED, sale_source=SaleSource.CENTRAL_WAREHOUSE,
            sold_at=datetime(2026, 1, 3, 9),
        )
        central_sale.items.append(SalesInvoiceItem(product_id=product.id, quantity=2, unit_price=150))
        field_sale = SalesInvoice(
            warehouse_id=second.id, customer_id=customer.id, employee_id=seller,
            status=InvoiceStatus.COMPLETED, sale_source=SaleSource.EMPLOYEE_STOCK,
            sold_at=datetime(2026, 1, 4, 9),
        )
        field_sale.items.append(SalesInvoiceItem(product_id=product.id, quantity=1, unit_price=150))
        seller_damage = DamageReport(
            warehouse_id=second.id, reported_by_employee_id=seller,
            status=DamageReportStatus.PENDING, reported_at=datetime(2026, 1, 5, 9),
        )
        seller_damage.items.append(DamageReportItem(product_id=product.id, quantity=1))
        keeper_damage = DamageReport(
            warehouse_id=first.id, reported_by_employee_id=keeper,
            status=DamageReportStatus.PENDING, reported_at=datetime(2026, 1, 6, 9),
        )
        keeper_damage.items.append(DamageReportItem(product_id=product.id, quantity=1))
        db.session.add_all([imported, transfer, central_sale, field_sale, seller_damage, keeper_damage])
        db.session.commit()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.context.pop()

    def test_aggregated_report_matches_existing_business_rules(self):
        for from_date, to_date, warehouse_id in (
            (None, None, None),
            (None, None, self.first_id),
            (datetime(2026, 1, 3), datetime(2026, 1, 6, 23, 59), None),
        ):
            with self.subTest(from_date=from_date, warehouse_id=warehouse_id):
                old = get_movements_report(from_date, to_date, warehouse_id)
                new = get_movements_report_aggregated(from_date, to_date, warehouse_id)
                self.assertEqual(new["by_product"], old["by_product"])
                for key, collection in (
                    ("import_invoices_count", "import_invoices"),
                    ("sales_invoices_count", "sales_invoices"),
                    ("damage_reports_count", "damage_reports"),
                    ("stock_transfers_count", "stock_transfers"),
                ):
                    self.assertEqual(new["totals"][key], len(old[collection]))
                self.assertEqual(new["totals"]["total_import_amount"], sum(
                    float(item.quantity) * float(item.unit_price)
                    for invoice in old["import_invoices"] for item in invoice.items
                ))
                self.assertEqual(new["totals"]["total_export_amount"], sum(
                    float(item.quantity) * float(item.unit_price)
                    for invoice in old["sales_invoices"] for item in invoice.items
                ))

    def test_inventory_status_and_status_board_still_match(self):
        inventory = get_products_with_inventory(status="available", warehouse_id=self.first_id)
        self.assertEqual(inventory[1], 1)
        self.assertEqual(inventory[0][0]["inventory"]["available_stock"], 4)
        db.session.add_all([
            SalesInvoice(
                warehouse_id=self.first_id, customer_id=self.customer_id,
                employee_id=self.seller_id, status=InvoiceStatus.DRAFT,
                warehouse_submitted_at=datetime(2026, 1, 7, 9),
            ),
            SalesInvoice(
                warehouse_id=self.first_id, customer_id=self.customer_id,
                employee_id=self.seller_id, status=InvoiceStatus.DELIVERING,
                accounting_handoff_at=datetime(2026, 1, 7, 9),
            ),
        ])
        db.session.commit()
        groups = {group["status"]: group["total"] for group in get_status_tracking_board_service()}
        self.assertEqual(groups[InvoiceStatus.COMPLETED.value], 2)
        self.assertEqual(groups[InvoiceStatus.DRAFT.value], 0)
        self.assertEqual(groups["chờ kho"], 1)
        self.assertEqual(groups[InvoiceStatus.DELIVERING.value], 0)
        self.assertEqual(groups["chờ kế toán"], 1)


if __name__ == "__main__":
    unittest.main()
