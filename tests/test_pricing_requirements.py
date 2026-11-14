"""The nine pricing requirements, exercised only against in-memory SQLite."""

import os
import unittest
from datetime import datetime, timedelta
from decimal import Decimal

os.environ["DATABASE_URL"] = "sqlite:///:memory:"

from web import app, db
from web.dao.product_dao import calculate_inventory_for_products
from web.models import (Customer, Employee, EmployeeRole, ImportInvoice, ImportInvoiceItem,
                        InvoiceStatus, Product, SalesInvoice, SalesInvoiceItem, Supplier, Warehouse,
                        vietnam_payment_time)
from web.services.exceptions import ValidationError
from web.services.import_invoice_service import create_import_invoice_service
from web.services.sales_invoice_service import _validate_sales_items
from web.services.pricing_service import (apply_suggested_price, create_expense, pricing_breakdown, pricing_catalog,
                                          profitability_report, save_pricing_cycle, save_pricing_policy)


class PricingRequirements(unittest.TestCase):
    def setUp(self):
        assert app.config["SQLALCHEMY_DATABASE_URI"] == "sqlite:///:memory:"
        self.context = app.app_context()
        self.context.push()
        db.drop_all()
        db.create_all()
        manager = Employee(full_name="Manager", phone="0910000000", username="manager",
                           email="manager@example.test", password_hash="x", role=EmployeeRole.QUAN_LY,
                           is_approved=True)
        warehouse = Warehouse(name="Test warehouse", address="Test")
        supplier = Supplier(name="Test supplier", address="Test")
        customer = Customer(full_name="Test buyer", phone="0920000000", address="Test")
        product = Product(name="Bát 10p trắng", unit="cái", default_sale_price=4500,
                          unit_conversions={"bao": "1200", "bịch": "500"},
                          weight_per_unit=1, volume_per_unit=1)
        db.session.add_all([manager, warehouse, supplier, customer, product])
        db.session.commit()
        self.manager_id = manager.id
        self.warehouse_id = warehouse.id
        self.supplier_id = supplier.id
        self.customer_id = customer.id
        self.product_id = product.id
        self.today = vietnam_payment_time().date()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.context.pop()

    def import_product(self, *, fee=0, vat=0):
        return create_import_invoice_service(
            self.manager_id, self.warehouse_id, self.supplier_id,
            imported_at=self.today.isoformat(), inbound_fee=fee,
            deductible_input_vat=vat,
            items=[{"product_id": self.product_id, "quantity": 1, "unit": "bao",
                    "unit_price": 3800, "price_unit": "cái"}],
        )

    def confirm_plan(self, *, rounding=100):
        save_pricing_cycle(self.manager_id, {"planned_revenue_amount": 200_000_000})
        save_pricing_policy(self.manager_id, self.product_id, {
            "planned_quantity": 1200, "reference_price": 4500,
            "markup_percent": 20, "rounding_step": rounding,
        })

    def row(self):
        return next(row for row in pricing_catalog()["products"]
                    if row["product_id"] == self.product_id)

    def test_01_salary_revenue_share_and_rounding(self):
        self.import_product()
        self.confirm_plan()
        create_expense(self.manager_id, {"category": "sales_salary", "amount": 15_000_000,
                                         "occurred_on": self.today.isoformat(), "description": "Lương tháng"})
        row = self.row()
        self.assertEqual(row["planned_revenue"], 5_400_000)
        self.assertEqual(row["shared_expense_per_unit"], 337.5)
        self.assertEqual(row["full_cost_per_unit"], 4137.5)
        self.assertEqual(row["profit_at_current_price_per_unit"], 362.5)
        self.assertEqual(row["markup_at_current_price_percent"], 8.76)
        self.assertEqual(row["suggested_price"], 5000)
        self.assertEqual(row["current_price"], 4500)
        self.assertEqual(sum(part["per_unit"] for part in pricing_breakdown(self.product_id)["shared"]), 337.5)

    def test_02_overtime_and_markup_leave_official_price_alone(self):
        self.import_product()
        self.confirm_plan()
        create_expense(self.manager_id, {"category": "sales_salary", "amount": 15_000_000,
                                         "occurred_on": self.today.isoformat(), "description": "Lương tháng"})
        before = self.row()
        create_expense(self.manager_id, {"category": "overtime", "amount": 500_000,
                                         "occurred_on": self.today.isoformat(), "description": "Tăng ca"})
        after = self.row()
        self.assertEqual(after["shared_expense_per_unit"], 348.75)
        self.assertEqual(after["current_price"], 4500)
        self.assertGreater(after["full_cost_per_unit"], before["full_cost_per_unit"])
        save_pricing_policy(self.manager_id, self.product_id, {"planned_quantity": 1200,
                            "reference_price": 4500, "markup_percent": 30, "rounding_step": 100})
        marked = self.row()
        self.assertEqual(marked["full_cost_per_unit"], after["full_cost_per_unit"])
        self.assertEqual(marked["current_price"], 4500)
        self.assertGreater(marked["suggested_price"], after["suggested_price"])

    def test_02b_confirmed_salary_plan_is_replaced_by_recorded_salary(self):
        self.import_product()
        self.confirm_plan()
        save_pricing_cycle(self.manager_id, {"planned_salary_amount": 15_000_000,
                                             "planned_revenue_amount": 200_000_000})
        self.assertEqual(self.row()["shared_expense_per_unit"], 337.5)
        self.assertEqual(profitability_report(self.today.isoformat(), self.today.isoformat())["expenses"], 0)
        create_expense(self.manager_id, {"category": "sales_salary", "amount": 15_000_000,
                      "occurred_on": self.today.isoformat(), "description": "Lương tháng chưa thanh toán"})
        self.assertEqual(self.row()["shared_expense_per_unit"], 337.5)
        self.assertEqual(profitability_report(self.today.isoformat(), self.today.isoformat())["expenses"], 15_000_000)

    def test_03_order_allocation_by_revenue_and_weight(self):
        self.import_product()
        self.confirm_plan()
        other = Product(name="B", unit="cái", default_sale_price=8000,
                        weight_per_unit=3, volume_per_unit=2)
        db.session.add(other)
        db.session.flush()
        invoice = SalesInvoice(warehouse_id=self.warehouse_id, customer_id=self.customer_id,
                               employee_id=self.manager_id, sold_at=datetime.combine(self.today, datetime.min.time()),
                               status=InvoiceStatus.COMPLETED)
        db.session.add(invoice)
        db.session.flush()
        db.session.add_all([
            SalesInvoiceItem(sales_invoice_id=invoice.id, product_id=self.product_id,
                             quantity=500, unit_price=4000),
            SalesInvoiceItem(sales_invoice_id=invoice.id, product_id=other.id,
                             quantity=1000, unit_price=8000),
        ])
        db.session.commit()
        expense = create_expense(self.manager_id, {"category": "fuel", "amount": 1_000_000,
                     "occurred_on": self.today.isoformat(), "invoice_id": invoice.id,
                     "description": "Xăng chuyến"})
        self.assertEqual(self.row()["direct_expense_per_unit"], 400)
        self.assertEqual(pricing_breakdown(self.product_id)["direct"][0]["per_unit"], 400)
        self.assertEqual(pricing_catalog()["pricing_shared_expenses"], 0)
        from web.services.pricing_service import update_expense
        update_expense(self.manager_id, expense["id"], {"category": "fuel", "amount": 1_000_000,
                       "occurred_on": self.today.isoformat(), "invoice_id": invoice.id,
                       "description": "Xăng chuyến", "allocation_basis": "weight"})
        self.assertAlmostEqual(self.row()["direct_expense_per_unit"], 1_000_000 / 3500, places=5)

    def test_04_pack_conversion_landed_cost_and_input_vat(self):
        invoice = self.import_product(fee=120_000)
        item = invoice.items[0]
        self.assertEqual(item.quantity, Decimal("1200"))
        self.assertEqual(item.line_total, Decimal("4560000"))
        self.assertEqual(item.unit_price, Decimal("3800"))
        stock = calculate_inventory_for_products([self.product_id])[self.product_id]
        self.assertEqual(stock["available_stock"], 1200)
        self.confirm_plan()
        self.assertEqual(self.row()["estimated_unit_cost"], 3900)
        # A separate test invoice demonstrates that deductible VAT lowers cost.
        db.session.delete(invoice)
        db.session.commit()
        self.import_product(vat=456_000)
        self.assertEqual(self.row()["estimated_unit_cost"], 3420)

    def test_06_multi_order_trip_keeps_cost_out_of_shared_pool(self):
        self.import_product()
        self.confirm_plan()
        other = Product(name="B", unit="cái", default_sale_price=8000)
        db.session.add(other)
        db.session.flush()
        invoices = []
        for product_id, quantity, price in ((self.product_id, 500, 4000), (other.id, 1000, 8000)):
            invoice = SalesInvoice(warehouse_id=self.warehouse_id, customer_id=self.customer_id,
                employee_id=self.manager_id, sold_at=datetime.combine(self.today, datetime.min.time()),
                status=InvoiceStatus.COMPLETED)
            db.session.add(invoice)
            db.session.flush()
            db.session.add(SalesInvoiceItem(sales_invoice_id=invoice.id, product_id=product_id,
                                            quantity=quantity, unit_price=price))
            invoices.append(invoice.id)
        db.session.commit()
        create_expense(self.manager_id, {"category": "fuel", "amount": 1_000_000,
            "occurred_on": self.today.isoformat(), "description": "Chuyến giao hai đơn",
            "trip_invoice_ids": invoices, "allocation_basis": "revenue"})
        self.assertEqual(self.row()["direct_expense_per_unit"], 400)
        self.assertEqual(pricing_breakdown(self.product_id)["direct"][0]["trip_invoice_ids"], invoices)
        self.assertEqual(pricing_catalog()["pricing_shared_expenses"], 0)
        report = profitability_report(self.today.isoformat(), self.today.isoformat())
        by_product = {row["product_id"]: row for row in report["products"]}
        self.assertEqual(by_product[self.product_id]["operating_expenses"], 200_000)
        self.assertEqual(by_product[other.id]["operating_expenses"], 800_000)
        create_expense(self.manager_id, {"category": "lodging", "amount": 100_000,
            "occurred_on": self.today.isoformat(), "description": "Nghỉ trên chuyến",
            "invoice_id": invoices[0]})
        breakdown = pricing_breakdown(self.product_id)
        self.assertEqual(breakdown["product"]["direct_expense_per_unit"], 600)
        self.assertAlmostEqual(sum(item["per_unit"] for item in breakdown["direct"]), 600)

    def test_07_late_direct_expense_is_not_reallocated_as_shared(self):
        self.import_product()
        old_day = self.today.replace(day=1) - timedelta(days=1)
        old_invoice = SalesInvoice(warehouse_id=self.warehouse_id, customer_id=self.customer_id,
            employee_id=self.manager_id, sold_at=datetime.combine(old_day, datetime.min.time()),
            status=InvoiceStatus.COMPLETED)
        current_invoice = SalesInvoice(warehouse_id=self.warehouse_id, customer_id=self.customer_id,
            employee_id=self.manager_id, sold_at=datetime.combine(self.today, datetime.min.time()),
            status=InvoiceStatus.COMPLETED)
        db.session.add_all([old_invoice, current_invoice])
        db.session.flush()
        db.session.add_all([
            SalesInvoiceItem(sales_invoice_id=old_invoice.id, product_id=self.product_id,
                             quantity=1, unit_price=4500),
            SalesInvoiceItem(sales_invoice_id=current_invoice.id, product_id=self.product_id,
                             quantity=1, unit_price=4500),
        ])
        db.session.commit()
        create_expense(self.manager_id, {"category": "fuel", "amount": 1_000_000,
            "occurred_on": self.today.isoformat(), "invoice_id": old_invoice.id,
            "description": "Chi phí chuyến cũ ghi nhận tháng này"})
        report = profitability_report(self.today.isoformat(), self.today.isoformat())
        self.assertEqual(report["products"][0]["operating_expenses"], 0)
        self.assertEqual(report["unallocated_expenses"], 1_000_000)
        self.assertEqual(report["estimated_operating_profit"], -999_300)

    def test_05_missing_plan_unpaid_cost_abnormal_and_fractional_metre(self):
        self.import_product()
        self.assertIsNone(self.row()["full_cost_per_unit"])
        self.assertIsNone(self.row()["suggested_price"])
        with self.assertRaises(ValidationError):
            apply_suggested_price(self.product_id, 4500, 5000)
        with self.assertRaises(ValidationError):
            save_pricing_cycle(self.manager_id, {"planned_revenue_amount": 0})
        empty_invoice = SalesInvoice(warehouse_id=self.warehouse_id, customer_id=self.customer_id,
            employee_id=self.manager_id, sold_at=datetime.combine(self.today, datetime.min.time()),
            status=InvoiceStatus.DRAFT)
        db.session.add(empty_invoice)
        db.session.commit()
        with self.assertRaises(ValidationError):
            create_expense(self.manager_id, {"category": "fuel", "amount": 1000,
                "occurred_on": self.today.isoformat(), "invoice_id": empty_invoice.id,
                "description": "Đơn chưa có hàng"})
        self.confirm_plan()
        create_expense(self.manager_id, {"category": "vehicle_repair", "amount": 2_000_000,
                     "occurred_on": self.today.isoformat(), "description": "Đại tu xe", "is_abnormal": True})
        self.assertEqual(self.row()["estimated_unit_cost"], self.row()["full_cost_per_unit"])
        self.assertEqual(self.row()["current_price"], 4500)
        create_expense(self.manager_id, {"category": "sales_salary", "amount": 100_000,
                     "occurred_on": self.today.isoformat(), "description": "Lương chưa thanh toán"})
        invoice = SalesInvoice(warehouse_id=self.warehouse_id, customer_id=self.customer_id,
                               employee_id=self.manager_id, sold_at=datetime.combine(self.today, datetime.min.time()),
                               status=InvoiceStatus.COMPLETED)
        db.session.add(invoice)
        db.session.flush()
        db.session.add(SalesInvoiceItem(sales_invoice_id=invoice.id, product_id=self.product_id,
                                        quantity=1, unit_price=4500))
        db.session.commit()
        report = profitability_report(self.today.isoformat(), self.today.isoformat())
        self.assertEqual(report["expenses"], 2_100_000)
        self.assertEqual(report["estimated_operating_profit"], -2_099_300)
        self.assertEqual(pricing_catalog()["pricing_shared_expenses"], 100_000)
        rail = Product(name="Ray rèm", unit="mét", default_sale_price=5000,
                       unit_conversions={"cây": "6"})
        db.session.add(rail)
        db.session.commit()
        from web.services.unit_conversion import to_base_quantity
        self.assertEqual(to_base_quantity(rail, "0.5", "mét")[0], Decimal("0.5"))
        self.assertEqual(to_base_quantity(rail, 1, "cây")[0], Decimal("6"))
        create_import_invoice_service(self.manager_id, self.warehouse_id, self.supplier_id,
            imported_at=self.today.isoformat(), items=[{"product_id": rail.id, "unit": "cây",
            "quantity": 1, "unit_price": 5000}])
        self.assertEqual(_validate_sales_items([{"product_id": rail.id, "unit": "mét",
            "quantity": 0.5, "unit_price": 5000}])[0]["quantity"], Decimal("0.5"))
        save_pricing_policy(self.manager_id, rail.id, {"planned_quantity": "1.5",
                            "reference_price": 5000, "markup_percent": 20, "rounding_step": 100})
        self.assertEqual(next(row for row in pricing_catalog()["products"]
                              if row["product_id"] == rail.id)["planned_quantity"], "1.500")
        rail_sale = SalesInvoice(warehouse_id=self.warehouse_id, customer_id=self.customer_id,
            employee_id=self.manager_id, sold_at=datetime.combine(self.today, datetime.min.time()),
            status=InvoiceStatus.COMPLETED)
        db.session.add(rail_sale)
        db.session.flush()
        db.session.add(SalesInvoiceItem(sales_invoice_id=rail_sale.id, product_id=rail.id,
            quantity=Decimal("0.5"), unit_price=5000, entered_unit="mét", entered_quantity=Decimal("0.5")))
        db.session.commit()
        self.assertEqual(calculate_inventory_for_products([rail.id])[rail.id]["available_stock"], 5.5)
        with self.assertRaises(ValidationError):
            to_base_quantity(rail, 1, "bao")


if __name__ == "__main__":
    unittest.main()
