import unittest
from datetime import datetime, timedelta
from unittest.mock import patch

from flask import Flask
from sqlalchemy import inspect

from web import db, ensure_business_columns
from web.models import ImportInvoice, ImportInvoiceItem, OperatingExpense, PricingCycle, PricingPolicy, Product, vietnam_payment_time
from web.services.import_invoice_service import update_import_inbound_fee_service
from web.services.pricing_service import (
    apply_suggested_price, pricing_catalog, save_pricing_cycle, save_pricing_policy,
)
from web.services.exceptions import ValidationError


class PricingFormulaTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = Flask("pricing-formula-tests")
        cls.app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
        db.init_app(cls.app)

    def setUp(self):
        self.context = self.app.app_context()
        self.context.push()
        db.create_all()
        today = vietnam_payment_time().date()
        db.session.add_all([
            Product(id=1, name="A", unit="cái", default_sale_price=0),
            Product(id=2, name="B", unit="mét", default_sale_price=0),
            ImportInvoice(id=1, warehouse_id=1, supplier_id=1, employee_id=1,
                          imported_at=datetime.combine(today, datetime.min.time()), inbound_fee=4000),
            ImportInvoiceItem(import_invoice_id=1, product_id=1, quantity=10,
                              unit_price=1000, line_total=10000),
            ImportInvoiceItem(import_invoice_id=1, product_id=2, quantity=10,
                              unit_price=3000, line_total=30000),
            OperatingExpense(id=1, category="fuel", amount=44000,
                             occurred_on=today - timedelta(days=45),
                             description="Chi phí chung", created_by_id=1),
        ])
        db.session.commit()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.context.pop()

    def test_price_uses_inbound_fee_and_old_shared_expense_without_sales(self):
        catalog = pricing_catalog()
        self.assertEqual(catalog["pricing_operating_expenses"], 44000)
        self.assertEqual(catalog["pricing_period_start"],
                         (vietnam_payment_time().date() - timedelta(days=45)).isoformat())
        self.assertEqual(
            [(row["estimated_unit_cost"], row["expense_per_unit"], row["suggested_price"])
             for row in catalog["products"]],
            [(1100, 110, 2000), (3300, 330, 5000)],
        )
        self.assertEqual(apply_suggested_price(1, 0, 2000)["new_price"], 2000)

    def test_plan_and_profit_amount_recalculate_allocation(self):
        save_pricing_policy(1, 2, {"planned_quantity": 50, "desired_profit_per_unit": 1000})
        row = pricing_catalog()["products"][1]
        self.assertEqual(row["expense_per_unit"], 528)
        self.assertEqual(row["desired_profit_per_unit"], 1000)
        self.assertEqual(row["suggested_price"], 5000)

    def test_existing_markup_becomes_initial_profit_amount(self):
        db.session.add(PricingPolicy(product_id=1, planned_quantity=100,
                                     markup_percent=10, updated_by_id=1))
        db.session.commit()
        row = pricing_catalog()["products"][0]
        self.assertEqual(row["desired_profit_per_unit"], 110)
        self.assertEqual(row["suggested_price"], 2000)

    def test_planned_quantity_above_old_limit_is_preserved_exactly(self):
        quantity = "9223372036854775807"
        save_pricing_policy(1, 1, {"planned_quantity": quantity, "desired_profit_per_unit": 220})
        row = pricing_catalog()["products"][0]
        self.assertEqual(row["planned_quantity"], quantity)
        self.assertEqual(row["suggested_price"], 2000)
        with self.assertRaises(ValidationError):
            save_pricing_policy(1, 1, {"planned_quantity": "9223372036854775808",
                                       "desired_profit_per_unit": 220})

    def test_inbound_fee_can_be_added_to_existing_import(self):
        with patch("web.services.import_invoice_service.ensure_warehouse_access"):
            update_import_inbound_fee_service(1, 1, 8000)
        rows = pricing_catalog()["products"]
        self.assertEqual([row["estimated_unit_cost"] for row in rows], [1200, 3600])

    def test_new_cycle_excludes_previous_period_only_when_explicitly_set(self):
        today = vietnam_payment_time().date()
        save_pricing_cycle(1, {"start_date": today.isoformat()})
        catalog = pricing_catalog()
        self.assertEqual(catalog["pricing_operating_expenses"], 0)
        self.assertEqual(catalog["products"][0]["expense_per_unit"], 0)

    def test_existing_database_gets_new_pricing_columns(self):
        db.session.remove()
        PricingCycle.__table__.drop(bind=db.engine)
        with db.engine.begin() as connection:
            connection.exec_driver_sql("ALTER TABLE import_invoices DROP COLUMN inbound_fee")
            connection.exec_driver_sql("ALTER TABLE pricing_policies DROP COLUMN desired_profit_per_unit")
        with patch("web._business_schema_ready", False), self.app.test_request_context("/api/pricing/catalog"):
            ensure_business_columns()
        inspector = inspect(db.engine)
        self.assertTrue(inspector.has_table("pricing_cycles"))
        self.assertIn("inbound_fee", {column["name"] for column in inspector.get_columns("import_invoices")})
        self.assertIn("desired_profit_per_unit", {column["name"] for column in inspector.get_columns("pricing_policies")})


if __name__ == "__main__":
    unittest.main()
