"""Creating sales areas from the customer form keeps names unique."""

import os
import time
import unittest
from unittest.mock import patch

import jwt

os.environ["DATABASE_URL"] = "sqlite://"

from web import app, db  # noqa: E402
from web.models import Customer, Employee, EmployeeRole, Product, SalesArea, Warehouse  # noqa: E402
from web.services.exceptions import ValidationError  # noqa: E402
from web.services.sales_area_service import create_sales_area_service  # noqa: E402
from web.services.sales_invoice_service import create_sales_invoice_service  # noqa: E402


class SalesAreaTests(unittest.TestCase):
    def setUp(self):
        self.context = app.app_context()
        self.context.push()
        db.create_all()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.context.pop()

    def test_create_area_normalizes_name_and_rejects_duplicate(self):
        area = create_sales_area_service("  North   region  ")
        self.assertEqual(area.name, "North region")
        self.assertTrue(area.is_active)
        self.assertEqual(SalesArea.query.count(), 1)

        with self.assertRaises(ValidationError) as caught:
            create_sales_area_service("north region")
        self.assertEqual(caught.exception.status_code, 409)
        self.assertEqual(SalesArea.query.count(), 1)

    def test_empty_area_name_is_rejected(self):
        with self.assertRaises(ValidationError):
            create_sales_area_service("   ")

    def test_sales_employee_can_create_area_through_api(self):
        employee = Employee(
            full_name="Sales employee", phone="0900000010", username="area_staff",
            email="area_staff@example.com", password_hash="test",
            role=EmployeeRole.NHAN_VIEN_BAN_HANG, is_approved=True,
        )
        db.session.add(employee)
        db.session.commit()
        now = int(time.time())
        token = jwt.encode({
            "employee_id": employee.id, "role": employee.role.value,
            "iat": now, "exp": now + 300,
        }, app.config["JWT_SECRET"], algorithm="HS256")
        response = app.test_client().post(
            "/api/sales-areas", json={"name": "West region"},
            headers={"Authorization": f"Bearer {token}"},
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json["sales_area"]["name"], "West region")
        self.assertEqual(SalesArea.query.count(), 1)

    def test_existing_customer_order_can_use_another_area_without_changing_customer(self):
        old_area = create_sales_area_service("Old region")
        new_area = create_sales_area_service("New region")
        warehouse = Warehouse(name="Central", address="Central address")
        product = Product(name="Product", unit="item", default_sale_price=1000)
        customer = Customer(full_name="Customer", phone="0900000020", address="Customer address",
                            sales_area_id=old_area.id)
        employee = Employee(
            full_name="Manager", phone="0900000021", username="area_manager",
            email="area_manager@example.com", password_hash="test",
            role=EmployeeRole.QUAN_LY, is_approved=True,
        )
        db.session.add_all([warehouse, product, customer, employee])
        db.session.commit()

        with patch("web.services.sales_invoice_service._validate_items_available_in_warehouse"):
            invoice = create_sales_invoice_service(
                employee_id=employee.id, warehouse_id=warehouse.id,
                customer_id=customer.id, sales_area_id=new_area.id,
                items=[{"product_id": product.id, "quantity": 1, "unit_price": 1000}],
            )
        self.assertEqual(invoice.sales_area_id, new_area.id)
        self.assertEqual(customer.sales_area_id, old_area.id)


if __name__ == "__main__":
    unittest.main()
