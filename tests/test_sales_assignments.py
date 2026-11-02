import os
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import jwt

from web import app, db
from web.models import (
    Customer, Employee, EmployeeRole, InvoiceStatus, Product,
    SalesInvoice, SalesInvoiceItem, Warehouse,
)
from web.realtime import socketio
from web.services.exceptions import ForbiddenError, ValidationError
from web.services.sales_invoice_service import (
    accept_sales_invoice_assignment_service,
    complete_sales_invoice_service,
    get_sales_invoice_action_count_service,
    handoff_sales_invoice_accounting_service,
    list_sales_invoice_assignees_service,
    prepare_sales_invoice_delivery_service,
    reassign_sales_invoice_service,
    submit_sales_invoice_to_warehouse_service,
    update_invoice_status_service,
    workflow_stage,
)


@unittest.skipUnless(os.environ.get("DATABASE_URL", "").startswith("sqlite"), "Requires an isolated SQLite database")
class SalesAssignmentTest(unittest.TestCase):
    def setUp(self):
        self.context = app.app_context()
        self.context.push()
        db.create_all()
        warehouse = Warehouse(name="Kho trung tâm", address="A")
        customer = Customer(full_name="Khách", phone="0911000000", address="A")
        product = Product(name="Món", unit="Cái", default_sale_price=100)
        db.session.add_all([warehouse, customer, product])
        db.session.flush()

        def employee(number, role):
            staff = Employee(
                full_name=f"Nhân viên {number}", phone=f"09000000{number:02d}",
                username=f"staff{number}", email=f"staff{number}@example.invalid",
                password_hash="x", role=role, is_approved=True, is_locked=False,
                warehouse_id=warehouse.id,
            )
            db.session.add(staff)
            db.session.flush()
            return staff.id

        self.seller = employee(1, EmployeeRole.NHAN_VIEN_BAN_HANG)
        self.keeper = employee(2, EmployeeRole.THU_KHO)
        self.other_keeper = employee(3, EmployeeRole.THU_KHO)
        self.accountant = employee(4, EmployeeRole.KE_TOAN)
        self.other_accountant = employee(5, EmployeeRole.KE_TOAN)
        self.courier = employee(6, EmployeeRole.NHAN_VIEN_GIAO_HANG)
        self.manager = employee(7, EmployeeRole.QUAN_LY)
        self.other_manager = employee(8, EmployeeRole.QUAN_LY)
        self.global_keeper = employee(9, EmployeeRole.THU_KHO)
        db.session.get(Employee, self.global_keeper).warehouse_id = None
        invoice = SalesInvoice(
            warehouse_id=warehouse.id, customer_id=customer.id, employee_id=self.seller,
            status=InvoiceStatus.DRAFT,
        )
        invoice.items.append(SalesInvoiceItem(product_id=product.id, quantity=1, unit_price=100))
        db.session.add(invoice)
        db.session.commit()
        self.invoice_id = invoice.id

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.context.pop()

    def test_assignment_acceptance_reassignment_and_accounting_handoff(self):
        with self.assertRaises(ValidationError):
            submit_sales_invoice_to_warehouse_service(self.invoice_id, self.seller, None)
        db.session.rollback()
        submitted = submit_sales_invoice_to_warehouse_service(self.invoice_id, self.seller, self.keeper)
        self.assertEqual(submitted.current_assignee_id, self.keeper)
        self.assertEqual(workflow_stage(submitted), "chờ kho")
        self.assertEqual(get_sales_invoice_action_count_service(self.keeper, EmployeeRole.THU_KHO), 1)
        self.assertEqual(get_sales_invoice_action_count_service(self.other_keeper, EmployeeRole.THU_KHO), 0)
        with self.assertRaises(ForbiddenError):
            accept_sales_invoice_assignment_service(self.invoice_id, self.other_keeper)
        db.session.rollback()
        accept_sales_invoice_assignment_service(self.invoice_id, self.keeper)
        reassigned = reassign_sales_invoice_service(self.invoice_id, self.manager, self.other_keeper)
        self.assertIsNone(reassigned.accepted_at)
        self.assertEqual(reassigned.current_assignee_id, self.other_keeper)
        with self.assertRaises(ForbiddenError):
            accept_sales_invoice_assignment_service(self.invoice_id, self.keeper)
        db.session.rollback()

        accept_sales_invoice_assignment_service(self.invoice_id, self.other_keeper)
        with self.assertRaises(ForbiddenError):
            update_invoice_status_service(self.invoice_id, self.keeper, "đang xử lý")
        db.session.rollback()
        with patch("web.services.sales_invoice_service._validate_items_available_in_warehouse"):
            update_invoice_status_service(self.invoice_id, self.other_keeper, "đang xử lý")
        with self.assertRaises(ForbiddenError):
            prepare_sales_invoice_delivery_service(self.invoice_id, self.keeper, {
                "delivery_method": "internal", "delivery_employee_id": self.courier,
            })
        db.session.rollback()
        prepared = prepare_sales_invoice_delivery_service(self.invoice_id, self.other_keeper, {
            "delivery_method": "internal", "delivery_employee_id": self.courier,
        })
        self.assertEqual(prepared.current_assignee_id, self.courier)
        with patch("web.services.sales_invoice_service._validate_items_available_in_warehouse"):
            update_invoice_status_service(self.invoice_id, self.courier, "đang giao")
        with self.assertRaises(ValidationError):
            complete_sales_invoice_service(self.invoice_id, self.accountant)
        db.session.rollback()
        with self.assertRaises(ForbiddenError):
            handoff_sales_invoice_accounting_service(self.invoice_id, self.manager, self.accountant, "Khách")
        db.session.rollback()
        handed = handoff_sales_invoice_accounting_service(
            self.invoice_id, self.courier, self.accountant, "Khách",
        )
        self.assertEqual(workflow_stage(handed), "chờ kế toán")
        self.assertEqual(handed.current_assignee_id, self.accountant)
        self.assertEqual(get_sales_invoice_action_count_service(self.accountant, EmployeeRole.KE_TOAN), 1)
        self.assertEqual(get_sales_invoice_action_count_service(self.other_accountant, EmployeeRole.KE_TOAN), 0)
        with self.assertRaises(ForbiddenError):
            complete_sales_invoice_service(self.invoice_id, self.other_accountant)
        db.session.rollback()
        with self.assertRaises(ValidationError):
            complete_sales_invoice_service(self.invoice_id, self.accountant)
        db.session.rollback()
        accept_sales_invoice_assignment_service(self.invoice_id, self.accountant)
        self.assertIsNotNone(db.session.get(SalesInvoice, self.invoice_id).accepted_at)

    def test_socket_receives_only_committed_changes_for_authorized_staff(self):
        now = datetime.now(timezone.utc)
        token = jwt.encode({
            "employee_id": self.keeper,
            "role": EmployeeRole.THU_KHO.value,
            "iat": now,
            "exp": now + timedelta(minutes=5),
        }, app.config["JWT_SECRET"], algorithm="HS256")
        client = socketio.test_client(app, auth={"token": token})
        self.assertTrue(client.is_connected())
        rejected = socketio.test_client(app, auth={"token": "invalid"})
        self.assertFalse(rejected.is_connected())
        with self.assertRaises(ValidationError):
            submit_sales_invoice_to_warehouse_service(self.invoice_id, self.seller, None)
        db.session.rollback()
        self.assertFalse(client.get_received())
        submit_sales_invoice_to_warehouse_service(self.invoice_id, self.seller, self.keeper)
        self.assertTrue(any(event["name"] == "sales-invoice:changed" for event in client.get_received()))
        client.disconnect()

    def test_third_party_manager_handoff_requires_current_owner(self):
        submit_sales_invoice_to_warehouse_service(self.invoice_id, self.seller, self.keeper)
        accept_sales_invoice_assignment_service(self.invoice_id, self.keeper)
        with patch("web.services.sales_invoice_service._validate_items_available_in_warehouse"):
            update_invoice_status_service(self.invoice_id, self.keeper, "đang xử lý")
        prepared = prepare_sales_invoice_delivery_service(self.invoice_id, self.keeper, {
            "delivery_method": "third_party", "delivery_service": "Đối tác A",
            "tracking_number": "TRACK123", "shipping_fee": 1000,
            "shipping_fund_method": "cash",
            "delivery_manager_id": self.manager,
        })
        self.assertEqual(prepared.current_assignee_id, self.manager)
        accept_sales_invoice_assignment_service(self.invoice_id, self.manager)
        with patch("web.services.sales_invoice_service._validate_items_available_in_warehouse"), \
             patch("web.services.sales_invoice_service.record_fund_movement"):
            update_invoice_status_service(self.invoice_id, self.manager, "đang giao")
        self.assertEqual(get_sales_invoice_action_count_service(self.manager, EmployeeRole.QUAN_LY), 1)
        reassigned = reassign_sales_invoice_service(self.invoice_id, self.manager, self.other_manager)
        self.assertIsNone(reassigned.accepted_at)
        self.assertEqual(get_sales_invoice_action_count_service(self.manager, EmployeeRole.QUAN_LY), 0)
        self.assertEqual(get_sales_invoice_action_count_service(self.other_manager, EmployeeRole.QUAN_LY), 1)
        with self.assertRaises(ForbiddenError):
            handoff_sales_invoice_accounting_service(
                self.invoice_id, self.manager, self.accountant, "Khách",
            )
        db.session.rollback()
        accept_sales_invoice_assignment_service(self.invoice_id, self.other_manager)
        handed = handoff_sales_invoice_accounting_service(
            self.invoice_id, self.other_manager, self.accountant, "Khách",
        )
        self.assertEqual(handed.current_assignee_id, self.accountant)

    def test_manager_repairs_legacy_delivery_without_method(self):
        invoice = db.session.get(SalesInvoice, self.invoice_id)
        invoice.status = InvoiceStatus.DELIVERING
        invoice.assignment_stage = "delivery"
        db.session.commit()
        repaired = prepare_sales_invoice_delivery_service(self.invoice_id, self.manager, {
            "delivery_method": "internal", "delivery_employee_id": self.courier,
        })
        self.assertEqual(repaired.current_assignee_id, self.courier)
        self.assertEqual(repaired.status, InvoiceStatus.DELIVERING)
        with self.assertRaises(ValidationError):
            handoff_sales_invoice_accounting_service(
                self.invoice_id, self.courier, self.accountant, "Khách",
            )
        db.session.rollback()
        accept_sales_invoice_assignment_service(self.invoice_id, self.courier)
        handed = handoff_sales_invoice_accounting_service(
            self.invoice_id, self.courier, self.accountant, "Khách",
        )
        self.assertEqual(workflow_stage(handed), "chờ kế toán")

    def test_approved_keeper_without_fixed_warehouse_can_receive_orders(self):
        warehouse_id = db.session.get(SalesInvoice, self.invoice_id).warehouse_id
        candidates = list_sales_invoice_assignees_service("warehouse", warehouse_id)
        self.assertIn(self.global_keeper, [person["id"] for person in candidates])
        submitted = submit_sales_invoice_to_warehouse_service(
            self.invoice_id, self.seller, self.global_keeper,
        )
        self.assertEqual(submitted.current_assignee_id, self.global_keeper)


if __name__ == "__main__":
    unittest.main()
