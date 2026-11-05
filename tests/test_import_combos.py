"""Financial checks for supplier-priced bundles without a separate combo table."""

import os
import unittest
from decimal import Decimal

os.environ["DATABASE_URL"] = "sqlite://"

from web import app, db  # noqa: E402
from web.models import Employee, EmployeeRole, ImportInvoiceItem, Product, Supplier, Warehouse  # noqa: E402
from web.services.import_invoice_service import (  # noqa: E402
    _prepare_import_lines, create_import_invoice_service, serialize_import_invoice,
    update_import_invoice_service,
)
from web.services.exceptions import ValidationError  # noqa: E402


class ImportComboTests(unittest.TestCase):
    def setUp(self):
        self.context = app.app_context()
        self.context.push()
        db.create_all()
        db.session.add_all([
            Product(id=1, name="A", unit="cái", default_sale_price=0),
            Product(id=2, name="B", unit="cái", default_sale_price=0),
        ])
        db.session.commit()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.context.pop()

    def test_manual_allocation_keeps_exact_bundle_total_with_odd_quantity(self):
        lines, groups = _prepare_import_lines([], [{
            "name": "Bộ thử", "sets": 1, "bundle_price": 1000,
            "allocation_mode": "manual",
            "parts": [
                {"product_id": 1, "quantity_per_set": 3, "allocated_total": 700},
                {"product_id": 2, "quantity_per_set": 1, "allocated_total": 300},
            ],
        }])
        self.assertEqual(sum(line["line_total"] for line in lines), Decimal("1000"))
        self.assertEqual(lines[0]["quantity"], 3)
        self.assertNotEqual(lines[0]["unit_price"] * 3, lines[0]["line_total"])
        self.assertEqual(groups[0]["parts"][0]["allocated_total"], "700.00")

    def test_equal_split_counts_every_piece_and_preserves_total(self):
        lines, groups = _prepare_import_lines([], [{
            "name": "Bộ A+B", "sets": 2, "bundle_price": 1001,
            "parts": [{"product_id": 1, "quantity_per_set": 2},
                      {"product_id": 2, "quantity_per_set": 1}],
        }])
        by_product = {line["product_id"]: line for line in lines}
        self.assertEqual(groups[0]["allocation_mode"], "equal")
        self.assertEqual(by_product[1]["quantity"], 4)
        self.assertEqual(by_product[2]["quantity"], 2)
        self.assertEqual(by_product[1]["line_total"], Decimal("1336"))
        self.assertEqual(by_product[2]["line_total"], Decimal("666"))
        self.assertEqual(sum(line["line_total"] for line in lines), Decimal("2002"))

    def test_supplier_unit_prices_must_match_bundle_total(self):
        group = {
            "name": "Bộ A+B", "sets": 2, "bundle_price": 1000,
            "allocation_mode": "supplier_prices",
            "parts": [{"product_id": 1, "quantity_per_set": 2, "unit_price": 300},
                      {"product_id": 2, "quantity_per_set": 1, "unit_price": 400}],
        }
        lines, groups = _prepare_import_lines([], [group])
        self.assertEqual([line["line_total"] for line in lines], [Decimal("1200"), Decimal("800")])
        self.assertEqual(groups[0]["parts"][0]["unit_price"], "300.00")
        group["parts"][1]["unit_price"] = 399
        with self.assertRaisesRegex(ValidationError, "phải bằng giá trọn combo"):
            _prepare_import_lines([], [group])

    def test_auto_allocation_uses_one_weighted_cost_query_and_merges_single(self):
        db.session.add_all([
            ImportInvoiceItem(import_invoice_id=999, product_id=1, quantity=2,
                              unit_price=200, line_total=400),
            ImportInvoiceItem(import_invoice_id=999, product_id=2, quantity=1,
                              unit_price=100, line_total=100),
        ])
        db.session.commit()
        lines, groups = _prepare_import_lines(
            [{"product_id": 1, "quantity": 1, "unit_price": 500}],
            [{"name": "Bộ A+B", "sets": 1, "bundle_price": 900,
              "allocation_mode": "auto",
              "parts": [{"product_id": 1, "quantity_per_set": 2},
                        {"product_id": 2, "quantity_per_set": 1}]}],
        )
        by_product = {line["product_id"]: line for line in lines}
        self.assertEqual(by_product[1]["quantity"], 3)
        self.assertEqual(by_product[1]["line_total"], Decimal("1220"))
        self.assertEqual(by_product[2]["line_total"], Decimal("180"))
        self.assertEqual(groups[0]["bundle_price"], "900.00")

    def test_create_invoice_keeps_supplier_total_and_snapshot(self):
        warehouse = Warehouse(name="Kho", address="Địa chỉ kho")
        supplier = Supplier(name="Công ty bán", address="Địa chỉ nhà cung cấp")
        employee = Employee(full_name="Quản lý", phone="0900000000", username="quanly",
                            email="quanly@example.com", password_hash="test",
                            role=EmployeeRole.QUAN_LY, is_approved=True)
        db.session.add_all([warehouse, supplier, employee])
        db.session.commit()
        invoice = create_import_invoice_service(
            employee_id=employee.id, warehouse_id=warehouse.id, supplier_id=supplier.id,
            items=[], combo_groups=[{
                "name": "Bộ thử", "sets": 1, "bundle_price": 1000,
                "allocation_mode": "supplier_prices",
                "parts": [{"product_id": 1, "quantity_per_set": 3, "unit_price": 200},
                          {"product_id": 2, "quantity_per_set": 1, "unit_price": 400}],
            }],
        )
        result = serialize_import_invoice(invoice)
        self.assertEqual(result["total_amount"], 1000)
        self.assertEqual(result["combo_groups"][0]["name"], "Bộ thử")
        self.assertEqual(result["combo_groups"][0]["parts"][0]["unit_price"], "200.00")
        self.assertEqual(sum(item["total"] for item in result["items"]), 1000)
        updated = update_import_invoice_service(
            invoice_id=invoice.id, employee_id=employee.id, warehouse_id=warehouse.id,
            supplier_id=supplier.id, items=[], combo_groups=[{
                "name": "Bộ thử", "sets": 2, "bundle_price": 1000,
                "allocation_mode": "equal",
                "parts": [{"product_id": 1, "quantity_per_set": 3},
                          {"product_id": 2, "quantity_per_set": 1}],
            }],
        )
        updated_result = serialize_import_invoice(updated)
        self.assertEqual(updated_result["total_amount"], 2000)
        self.assertEqual(updated_result["combo_groups"][0]["allocation_mode"], "equal")
        self.assertEqual({item["product_id"]: item["quantity"] for item in updated_result["items"]},
                         {1: 6, 2: 2})


if __name__ == "__main__":
    unittest.main()
