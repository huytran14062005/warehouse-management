"""Regression checks for the prelaunch order, stock, payment and pricing checklist.

Run with: .venv/Scripts/python -m unittest discover -s tests -v
The database is forced to SQLite in memory before importing the application.
"""

import os
import unittest
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from unittest.mock import patch

os.environ["DATABASE_URL"] = "sqlite:///:memory:"

import jwt

from web import app, db
from web.dao.product_dao import calculate_inventory_for_products
from web.models import (
    CompanyFund, CompanyFundEntry, Customer, CustomerPayment, DiscountStatus,
    Employee, EmployeeRole, ImportInvoice, ImportInvoiceItem, InvoiceStatus,
    PaymentStatus, Product, ProductCombo, ProductComboItem, Promotion,
    SaleSource, SalesInvoice, Supplier, Warehouse,
)
from web.services.exceptions import ValidationError
from web.services.pricing_service import create_expense, pricing_catalog, pay_expense
from web.services.pricing_service import profitability_report
from web.services.sales_invoice_service import (
    accept_sales_invoice_assignment_service, approve_discount_service,
    cancel_invoice_service, complete_sales_invoice_service,
    confirm_sales_invoice_return_service, create_sales_invoice_service,
    handoff_sales_invoice_accounting_service, prepare_sales_invoice_delivery_service,
    record_sales_invoice_payment_service, submit_sales_invoice_to_warehouse_service,
    update_invoice_status_service, update_sales_invoice_service, serialize_sales_invoice,
)


class PrelaunchChecklist(unittest.TestCase):
    """Use real service transactions and stock queries; suppress only socket events."""

    def setUp(self):
        if app.config["SQLALCHEMY_DATABASE_URI"] != "sqlite:///:memory:":
            raise RuntimeError("Prelaunch tests may only run against in-memory SQLite")
        self.context = app.app_context()
        self.context.push()
        app.config["TESTING"] = True
        db.drop_all()
        db.create_all()
        self.notify_patch = patch("web.services.sales_invoice_service._notify_invoice_changed")
        self.notify_patch.start()

        warehouse = Warehouse(name="Central", address="Test")
        supplier = Supplier(name="Supplier", address="Test")
        customer = Customer(full_name="Buyer", phone="0900000000", address="Test")
        products = [
            Product(name="A", unit="cái", default_sale_price=Decimal("1000")),
            Product(name="B", unit="cái", default_sale_price=Decimal("1000")),
        ]
        roles = {
            "seller": EmployeeRole.NHAN_VIEN_BAN_HANG,
            "keeper": EmployeeRole.THU_KHO,
            "courier": EmployeeRole.NHAN_VIEN_GIAO_HANG,
            "accountant": EmployeeRole.KE_TOAN,
            "manager": EmployeeRole.QUAN_LY,
            "manager2": EmployeeRole.QUAN_LY,
        }
        people = [
            Employee(full_name=name, phone=f"09100000{i:02d}", username=name,
                     email=f"{name}@example.test", password_hash="test", role=role,
                     is_approved=True)
            for i, (name, role) in enumerate(roles.items(), 1)
        ]
        db.session.add_all([warehouse, supplier, customer, *products, *people])
        db.session.flush()
        for person in people:
            person.warehouse_id = warehouse.id
        imported = ImportInvoice(
            imported_at=datetime.now() - timedelta(days=1), warehouse_id=warehouse.id,
            supplier_id=supplier.id, employee_id=people[4].id, inbound_fee=Decimal("2000"),
        )
        db.session.add(imported)
        db.session.flush()
        db.session.add_all([
            ImportInvoiceItem(import_invoice_id=imported.id, product_id=p.id,
                              quantity=20, unit_price=Decimal("500"),
                              line_total=Decimal("10000"))
            for p in products
        ])
        for method in ("cash", "bank_transfer"):
            db.session.add(CompanyFund(
                method=method, opening_balance=Decimal("1000000"),
                balance=Decimal("1000000"), opened_by_id=people[4].id,
            ))
        db.session.commit()
        self.warehouse_id = warehouse.id
        self.customer_id = customer.id
        self.product_ids = [p.id for p in products]
        self.people = {name: person.id for name, person in zip(roles, people)}
        self.due_date = (date.today() + timedelta(days=30)).isoformat()

    def tearDown(self):
        db.session.remove()
        self.notify_patch.stop()
        db.drop_all()
        self.context.pop()

    def stock(self, product_id=None):
        product_id = product_id or self.product_ids[0]
        return calculate_inventory_for_products([product_id], self.warehouse_id)[product_id]["available_stock"]

    def item(self, quantity=1, price=1000, product_id=None, combo_id=None):
        return {"product_id": product_id or self.product_ids[0], "quantity": quantity,
                "unit_price": price, **({"combo_id": combo_id} if combo_id else {})}

    def create_sale(self, items=None, promotion_id=None):
        return create_sales_invoice_service(
            employee_id=self.people["seller"], warehouse_id=self.warehouse_id,
            customer_id=self.customer_id, items=items or [self.item()],
            promotion_id=promotion_id,
        )

    def dispatch(self, invoice_id):
        submit_sales_invoice_to_warehouse_service(
            invoice_id, self.people["seller"], self.people["keeper"])
        accept_sales_invoice_assignment_service(invoice_id, self.people["keeper"])
        update_invoice_status_service(invoice_id, self.people["keeper"], "processing")
        prepare_sales_invoice_delivery_service(invoice_id, self.people["keeper"], {
            "delivery_method": "internal", "delivery_employee_id": self.people["courier"],
        })
        accept_sales_invoice_assignment_service(invoice_id, self.people["courier"])
        update_invoice_status_service(invoice_id, self.people["courier"], "delivering")

    def handoff(self, invoice_id):
        handoff_sales_invoice_accounting_service(
            invoice_id, self.people["courier"], self.people["accountant"], "Buyer")
        accept_sales_invoice_assignment_service(invoice_id, self.people["accountant"])

    def complete(self, invoice_id, amount=0, method=None):
        return complete_sales_invoice_service(
            invoice_id, self.people["accountant"], payment_amount=amount,
            payment_method=method, payment_due_date=self.due_date,
        )

    def token(self, role_name, *, expired=False):
        person = db.session.get(Employee, self.people[role_name])
        now = datetime.now(timezone.utc)
        payload = {"employee_id": person.id, "role": person.role.value,
                   "iat": now - timedelta(minutes=20) if expired else now,
                   "exp": now - timedelta(seconds=1) if expired else now + timedelta(minutes=10)}
        return {"Authorization": "Bearer " + jwt.encode(payload, app.config["JWT_SECRET"], algorithm="HS256")}

    def test_01_normal_order_draft_edit_handoff_completion_money_and_stock(self):
        invoice = self.create_sale()
        self.assertEqual(invoice.status, InvoiceStatus.DRAFT)
        self.assertEqual(self.stock(), 20)
        invoice = update_sales_invoice_service(
            invoice.id, self.people["seller"], self.warehouse_id, self.customer_id,
            "edited", [self.item(quantity=2)],
        )
        self.assertEqual(invoice.note, "edited")
        self.dispatch(invoice.id)
        self.assertEqual(self.stock(), 18)
        self.handoff(invoice.id)
        completed = self.complete(invoice.id, amount=2500, method="cash")
        self.assertEqual(completed.status, InvoiceStatus.COMPLETED)
        self.assertEqual(Decimal(completed.paid_amount), Decimal("2000"))
        self.assertEqual(db.session.get(Customer, self.customer_id).debt_amount, 0)
        self.assertEqual(self.stock(), 18)
        payments = CustomerPayment.query.filter_by(sales_invoice_id=invoice.id).all()
        self.assertEqual(len(payments), 1)
        self.assertIn("500", payments[0].note)
        self.assertEqual(db.session.get(CompanyFund, "cash").balance, 1002000)

    def test_02_combo_multiple_sets_edit_and_complete_after_retail_price_change(self):
        combo = ProductCombo(name="Combo", sale_price=Decimal("1200"))
        db.session.add(combo)
        db.session.flush()
        db.session.add_all([
            ProductComboItem(combo_id=combo.id, product_id=self.product_ids[0], quantity=2),
            ProductComboItem(combo_id=combo.id, product_id=self.product_ids[1], quantity=1),
        ])
        db.session.commit()
        lines = [self.item(2, 0, self.product_ids[0], combo.id),
                 self.item(1, 1200, self.product_ids[1], combo.id)]
        invoice = self.create_sale(lines)
        edited = [self.item(4, 0, self.product_ids[0], combo.id),
                  self.item(2, 1200, self.product_ids[1], combo.id)]
        update_sales_invoice_service(invoice.id, self.people["seller"],
                                     self.warehouse_id, self.customer_id, "two sets", edited)
        self.dispatch(invoice.id)
        self.handoff(invoice.id)
        for product_id in self.product_ids:
            db.session.get(Product, product_id).default_sale_price = Decimal("5000")
        db.session.commit()
        completed = self.complete(invoice.id)
        self.assertEqual(completed.status, InvoiceStatus.COMPLETED)
        self.assertEqual(sum(i.quantity * i.unit_price for i in completed.items), Decimal("2400"))
        self.assertEqual(db.session.get(Customer, self.customer_id).debt_amount, Decimal("2400"))

    def test_03_sell_all_stock_then_cancel_dispatched_requires_return_receipt(self):
        invoice = self.create_sale([self.item(quantity=20)])
        competing = self.create_sale([self.item(quantity=20)])
        self.dispatch(invoice.id)
        self.assertEqual(self.stock(), 0)
        submit_sales_invoice_to_warehouse_service(
            competing.id, self.people["seller"], self.people["keeper"])
        accept_sales_invoice_assignment_service(competing.id, self.people["keeper"])
        with self.assertRaises(ValidationError):
            update_invoice_status_service(competing.id, self.people["keeper"], "processing")
        with self.assertRaises(ValidationError):
            self.create_sale([self.item(quantity=1)])
        cancelled = cancel_invoice_service(invoice.id, self.people["manager"])
        self.assertEqual(cancelled.status, InvoiceStatus.CANCELLED)
        self.assertTrue(cancelled.return_pending)
        self.assertEqual(self.stock(), 0)
        with self.assertRaises(ValidationError):
            update_invoice_status_service(competing.id, self.people["keeper"], "processing")
        response = app.test_client().post(
            f"/api/sales-invoices/{invoice.id}/confirm-return",
            headers=self.token("keeper"),
        )
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json["invoice"]["return_pending"])
        self.assertEqual(self.stock(), 20)
        update_invoice_status_service(competing.id, self.people["keeper"], "processing")
        self.assertEqual(self.stock(), 0)
        with self.assertRaises(ValidationError):
            confirm_sales_invoice_return_service(invoice.id, self.people["keeper"])

    def test_04_transfer_partial_installments_and_no_duplicate_fund_receipt(self):
        invoice = self.create_sale()
        self.dispatch(invoice.id)
        self.handoff(invoice.id)
        self.complete(invoice.id)
        first, _ = record_sales_invoice_payment_service(
            invoice.id, self.people["accountant"], 500, "bank_transfer", self.due_date)
        self.assertEqual(first.payment_status, PaymentStatus.PARTIAL)
        self.assertEqual(db.session.get(Customer, self.customer_id).debt_amount, 500)
        final, _ = record_sales_invoice_payment_service(
            invoice.id, self.people["accountant"], 1000, "cash")
        self.assertEqual(final.payment_status, PaymentStatus.PAID)
        self.assertEqual(Decimal(final.paid_amount), Decimal("1000"))
        self.assertEqual(db.session.get(Customer, self.customer_id).debt_amount, 0)
        self.assertEqual(db.session.get(CompanyFund, "cash").balance, 1000500)
        self.assertEqual(db.session.get(CompanyFund, "bank_transfer").balance, 1000500)
        self.assertEqual(CustomerPayment.query.filter_by(sales_invoice_id=invoice.id).count(), 2)
        self.assertEqual(CompanyFundEntry.query.filter_by(entry_type="customer_receipt").count(), 2)
        with self.assertRaises(ValidationError):
            record_sales_invoice_payment_service(invoice.id, self.people["accountant"], 500, "cash")
        self.assertEqual(CompanyFundEntry.query.filter_by(entry_type="customer_receipt").count(), 2)

    def test_05_promotion_eligibility_auto_approval_and_legacy_review(self):
        promotion = Promotion(
            name="Qty 2", condition_type="min_quantity", min_quantity=2,
            discount_type="fixed_amount", discount_value=Decimal("1000"),
            is_active=True, created_by=self.people["manager"],
        )
        db.session.add(promotion)
        db.session.commit()
        with self.assertRaises(ValidationError):
            self.create_sale([self.item(quantity=1)], promotion.id)
        invoice = self.create_sale([self.item(quantity=2)], promotion.id)
        self.assertEqual(invoice.discount_status, DiscountStatus.AUTO_APPROVED)
        self.assertEqual(invoice.discount_amount, Decimal("1000"))
        self.assertEqual(serialize_sales_invoice(invoice)["final_amount"], 1000)
        # Existing pending approvals still support both decisions; new valid
        # promotions are manager-approved in advance and auto-approved on use.
        invoice.discount_status = DiscountStatus.PENDING_APPROVAL
        db.session.commit()
        approved, _ = approve_discount_service(invoice.id, self.people["manager"], True)
        self.assertEqual(approved.discount_status, DiscountStatus.APPROVED)
        other = self.create_sale([self.item(quantity=2)], promotion.id)
        other.discount_status = DiscountStatus.PENDING_APPROVAL
        db.session.commit()
        rejected, _ = approve_discount_service(other.id, self.people["manager"], False)
        self.assertEqual(rejected.discount_status, DiscountStatus.REJECTED)
        self.assertEqual(rejected.discount_amount, 0)
        self.assertEqual(serialize_sales_invoice(rejected)["final_amount"], 2000)

    def test_06_api_roles_expiry_lock_and_changed_role(self):
        client = app.test_client()
        self.assertEqual(client.get("/api/pricing/catalog").status_code, 401)
        self.assertEqual(client.get("/api/pricing/catalog", headers=self.token("seller")).status_code, 403)
        self.assertEqual(client.get("/api/pricing/catalog", headers=self.token("manager")).status_code, 200)
        self.assertEqual(client.get("/api/pricing/catalog", headers=self.token("manager", expired=True)).status_code, 401)
        invoice = self.create_sale()
        route = f"/api/sales-invoices/{invoice.id}/confirm-return"
        self.assertEqual(client.post(route, headers=self.token("accountant")).status_code, 403)
        self.assertEqual(client.post(route, headers=self.token("courier")).status_code, 403)
        self.assertEqual(client.put(f"/api/sales-invoices/{invoice.id}/complete", headers=self.token("seller"), json={}).status_code, 403)
        old_token = self.token("seller")
        db.session.get(Employee, self.people["seller"]).role = EmployeeRole.QUAN_LY
        db.session.commit()
        self.assertEqual(client.get("/api/pricing/catalog", headers=old_token).status_code, 401)
        db.session.get(Employee, self.people["manager"]).is_locked = True
        db.session.commit()
        self.assertEqual(client.get("/api/pricing/catalog", headers=self.token("manager")).status_code, 403)

    def test_07_paid_cost_only_and_input_freight_in_pricing(self):
        before = pricing_catalog()["products"][0]
        self.assertGreater(before["estimated_unit_cost"], 500)
        unpaid = create_expense(self.people["manager"], {
            "category": "sales_salary", "amount": 100000,
            "occurred_on": date.today().isoformat(), "description": "Salary",
        })
        self.assertEqual(pricing_catalog()["pricing_allocated_expenses"], 0)
        pay_expense(self.people["manager"], unpaid["id"], "cash")
        after = pricing_catalog()
        self.assertEqual(after["pricing_allocated_expenses"], 100000)
        self.assertGreater(after["products"][0]["full_cost_per_unit"], before["full_cost_per_unit"])
        self.assertGreater(after["products"][0]["suggested_price"], before["suggested_price"])

    def test_08_report_period_and_pre_vat_price_formula(self):
        row = pricing_catalog()["products"][0]
        full_cost = Decimal(str(row["full_cost_per_unit"]))
        self.assertEqual(row["suggested_price"], int((full_cost * Decimal("1.2") / 1000).to_integral_value(rounding="ROUND_CEILING") * 1000))
        self.assertEqual(Decimal(str(row["actual_profit_per_unit"])),
                         Decimal(str(row["suggested_price"])) - full_cost)
        # The product quote is explicitly before output VAT. There is no VAT
        # amount/rate in this response; tax-invoice calculation needs staging.
        self.assertNotIn("vat_amount", row)
        invoice = self.create_sale()
        self.dispatch(invoice.id)
        self.handoff(invoice.id)
        self.complete(invoice.id)
        today = date.today()
        yesterday = today - timedelta(days=1)
        current = profitability_report(today.isoformat(), today.isoformat())
        previous = profitability_report(yesterday.isoformat(), yesterday.isoformat())
        self.assertEqual(current["revenue"], 1000)
        self.assertEqual(current["estimated_cogs"], 550)
        self.assertEqual(current["estimated_operating_profit"], 450)
        self.assertEqual(previous["revenue"], 0)

    def test_09_two_access_tokens_read_after_write_and_retry_completion(self):
        client = app.test_client()
        invoice = self.create_sale()
        route = f"/api/sales-invoices/{invoice.id}"
        first_token = self.token("seller")
        second_token = self.token("seller")
        updated = update_sales_invoice_service(
            invoice.id, self.people["seller"], self.warehouse_id,
            self.customer_id, "saved on server", [self.item(quantity=2)],
        )
        self.assertEqual(updated.note, "saved on server")
        for headers in (first_token, second_token):
            response = client.get(route, headers=headers)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json["note"], "saved on server")
        self.dispatch(invoice.id)
        self.handoff(invoice.id)
        self.complete(invoice.id, amount=2000, method="bank_transfer")
        entry_count = CompanyFundEntry.query.filter_by(entry_type="customer_receipt").count()
        with self.assertRaises(ValidationError):
            self.complete(invoice.id, amount=2000, method="bank_transfer")
        self.assertEqual(CompanyFundEntry.query.filter_by(entry_type="customer_receipt").count(), entry_count)


if __name__ == "__main__":
    unittest.main()
