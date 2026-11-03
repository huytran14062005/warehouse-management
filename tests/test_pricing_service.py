import os
import unittest
from datetime import datetime, timedelta

from web import app, db
from web.models import (
    CompanyFund, CompanyFundEntry, Customer, Employee, EmployeeRole, ImportInvoice, ImportInvoiceItem,
    InvoiceStatus, OperatingExpense, Product, SalesInvoice, SalesInvoiceItem,
    Supplier, Warehouse, vietnam_payment_time,
)
from web.services.pricing_service import (
    apply_suggested_price, create_expense, pay_expense, pricing_catalog, profitability_report,
    save_pricing_policy, void_expense,
)
from web.services.exceptions import ValidationError


@unittest.skipUnless(os.environ.get("DATABASE_URL", "").startswith("sqlite"), "Requires isolated SQLite")
class PricingServiceTest(unittest.TestCase):
    def setUp(self):
        self.context = app.app_context()
        self.context.push()
        db.create_all()
        today = vietnam_payment_time().date()
        self.today = today.isoformat()
        warehouse = Warehouse(name="Kho", address="Địa chỉ")
        supplier = Supplier(name="Nguồn hàng", address="Địa chỉ")
        customer = Customer(full_name="Khách", phone="0911000001", address="Địa chỉ")
        manager = Employee(full_name="Quản lý", phone="0900000001", username="pricing_manager", email="pricing@example.invalid", password_hash="x", role=EmployeeRole.QUAN_LY, is_approved=True, is_locked=False)
        first = Product(name="A", unit="Cái", default_sale_price=100)
        second = Product(name="B", unit="Cái", default_sale_price=100)
        db.session.add_all([warehouse, supplier, customer, manager, first, second])
        db.session.flush()
        self.manager_id = manager.id
        self.first_id = first.id
        self.second_id = second.id
        self.invoice_id = None
        imported = ImportInvoice(warehouse_id=warehouse.id, supplier_id=supplier.id, employee_id=manager.id, imported_at=datetime.combine(today - timedelta(days=1), datetime.min.time()))
        imported.items.extend([
            ImportInvoiceItem(product_id=first.id, quantity=10, unit_price=50),
            ImportInvoiceItem(product_id=second.id, quantity=10, unit_price=30),
        ])
        sale = SalesInvoice(warehouse_id=warehouse.id, customer_id=customer.id, employee_id=manager.id, status=InvoiceStatus.COMPLETED, sold_at=datetime.combine(today, datetime.min.time()), discount_amount=30, delivery_method="third_party", shipping_fee=15, shipping_charged_at=datetime.combine(today, datetime.min.time()))
        sale.items.extend([
            SalesInvoiceItem(product_id=first.id, quantity=2, unit_price=100),
            SalesInvoiceItem(product_id=second.id, quantity=1, unit_price=100),
        ])
        db.session.add_all([imported, sale])
        db.session.commit()
        self.invoice_id = sale.id

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.context.pop()

    def test_expenses_are_counted_once_and_allocated_to_products(self):
        create_expense(self.manager_id, {"category": "fuel", "amount": 30, "occurred_on": self.today, "invoice_id": self.invoice_id, "description": "Xăng giao đơn"})
        create_expense(self.manager_id, {"category": "sales_salary", "amount": 27, "occurred_on": self.today, "description": "Lương bán hàng"})
        report = profitability_report(self.today, self.today)
        self.assertEqual(report["revenue"], 270)
        self.assertEqual(report["estimated_cogs"], 130)
        self.assertEqual(report["external_shipping"], 15)
        self.assertEqual(report["expenses"], 57)
        self.assertEqual(report["estimated_operating_profit"], 68)
        rows = {row["product_id"]: row for row in report["products"]}
        self.assertEqual(rows[self.first_id]["operating_expenses"], 38)
        self.assertEqual(rows[self.first_id]["estimated_operating_profit"], 32)
        self.assertEqual(rows[self.second_id]["operating_expenses"], 19)
        self.assertEqual(rows[self.second_id]["estimated_operating_profit"], 36)

    def test_pricing_uses_recent_cost_and_repair_reserve(self):
        save_pricing_policy(self.manager_id, self.first_id, {"planned_quantity": 2, "target_margin": 20})
        create_expense(self.manager_id, {"category": "vehicle_repair", "amount": 1200, "occurred_on": self.today, "description": "Sửa xe"})
        catalog = pricing_catalog()
        self.assertEqual(catalog["monthly_repair_allowance"], 100)
        self.assertEqual(catalog["monthly_expense_pool"], 115)
        first = next(row for row in catalog["products"] if row["product_id"] == self.first_id)
        self.assertEqual(first["estimated_unit_cost"], 50)
        self.assertEqual(first["planned_quantity"], 2)
        self.assertEqual(first["suggested_price"], 1000)

    def test_period_without_sales_still_reports_expense_loss(self):
        tomorrow_date = vietnam_payment_time().date() + timedelta(days=1)
        tomorrow = tomorrow_date.isoformat()
        db.session.add(OperatingExpense(category="lodging", amount=500, occurred_on=tomorrow_date, description="Nhà nghỉ", created_by_id=self.manager_id))
        db.session.commit()
        report = profitability_report(tomorrow, tomorrow)
        self.assertEqual(report["revenue"], 0)
        self.assertEqual(report["estimated_operating_profit"], -500)

    def test_paid_expense_and_void_reconcile_cash_and_profit(self):
        db.session.add(CompanyFund(method="cash", opening_balance=1000, balance=1000, opened_by_id=self.manager_id))
        db.session.commit()
        saved = create_expense(self.manager_id, {"category": "fuel", "amount": 200, "occurred_on": self.today, "description": "Xăng xe", "payment_method": "cash"})
        self.assertEqual(float(db.session.get(CompanyFund, "cash").balance), 800)
        self.assertEqual(profitability_report(self.today, self.today)["expenses"], 200)
        void_expense(self.manager_id, saved["id"], "Nhập nhầm")
        self.assertEqual(float(db.session.get(CompanyFund, "cash").balance), 1000)
        self.assertEqual(profitability_report(self.today, self.today)["expenses"], 0)
        self.assertEqual(CompanyFundEntry.query.filter(CompanyFundEntry.source_id == saved["id"]).count(), 2)

    def test_shipping_paid_outside_sale_period_is_counted_in_payment_period(self):
        tomorrow_date = vietnam_payment_time().date() + timedelta(days=1)
        invoice = db.session.get(SalesInvoice, self.invoice_id)
        invoice.shipping_charged_at = datetime.combine(tomorrow_date, datetime.min.time())
        db.session.commit()
        report = profitability_report(tomorrow_date.isoformat(), tomorrow_date.isoformat())
        self.assertEqual(report["revenue"], 0)
        self.assertEqual(report["external_shipping"], 15)
        self.assertEqual(report["estimated_operating_profit"], -15)

    def test_price_application_rejects_stale_confirmation(self):
        first = next(row for row in pricing_catalog()["products"] if row["product_id"] == self.first_id)
        applied = apply_suggested_price(self.first_id, first["current_price"], first["suggested_price"])
        self.assertEqual(applied["new_price"], first["suggested_price"])
        with self.assertRaises(ValidationError):
            apply_suggested_price(self.first_id, first["current_price"], first["suggested_price"])

    def test_unpaid_expense_can_be_paid_once_without_adding_profit_cost(self):
        db.session.add(CompanyFund(method="cash", opening_balance=1000, balance=1000, opened_by_id=self.manager_id))
        db.session.commit()
        saved = create_expense(self.manager_id, {"category": "lodging", "amount": 300, "occurred_on": self.today, "description": "Nhà nghỉ"})
        self.assertEqual(profitability_report(self.today, self.today)["expenses"], 300)
        pay_expense(self.manager_id, saved["id"], "cash")
        self.assertEqual(float(db.session.get(CompanyFund, "cash").balance), 700)
        self.assertEqual(profitability_report(self.today, self.today)["expenses"], 300)
        with self.assertRaises(ValidationError):
            pay_expense(self.manager_id, saved["id"], "cash")


if __name__ == "__main__":
    unittest.main()
