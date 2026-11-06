import inspect
import importlib
import unittest
from datetime import datetime
from types import SimpleNamespace
from unittest.mock import patch

from flask import request

from web import app
from web.models import EmployeeRole
from web.services import employee_account_service as service


class EmployeeAccountNotificationTests(unittest.TestCase):
    def setUp(self):
        self.manager = SimpleNamespace(id=1, role=EmployeeRole.QUAN_LY)
        self.employee = SimpleNamespace(
            id=2,
            role=EmployeeRole.NHAN_VIEN_GIAO_HANG,
            email="employee@example.com",
            full_name="Test Employee",
            phone="0123456789",
            username="employee",
            is_approved=True,
            is_locked=False,
            approved_at=datetime(2025, 1, 1),
            created_at=datetime(2025, 1, 1),
        )

    def _lookup(self, employee_id):
        return self.manager if employee_id == self.manager.id else self.employee

    def test_lock_remains_successful_when_smtp_rejects_email(self):
        def lock(employee, locked):
            employee.is_locked = locked
            return employee

        with app.app_context(), patch.dict(app.config, {
            "MAIL_SERVER": "smtp.gmail.com",
            "MAIL_USERNAME": "sender@example.com",
            "MAIL_PASSWORD": "test-password",
            "MAIL_DEFAULT_SENDER": ("Warehouse Management", "sender@example.com"),
        }), patch.object(service.dao, "get_employee_by_id", side_effect=self._lookup), \
                patch.object(service.dao, "set_employee_locked", side_effect=lock) as update, \
                patch.object(service, "revoke_all_refresh_sessions") as revoke, \
                patch.object(service, "send_account_locked_email", side_effect=RuntimeError("SMTP unavailable")), \
                patch.object(app.logger, "exception") as log:
            employee, email_sent = service.set_employee_lock_service(2, 1, True)

        self.assertTrue(employee.is_locked)
        self.assertFalse(email_sent)
        update.assert_called_once()
        revoke.assert_called_once_with(2)
        log.assert_called_once()

    def test_missing_sender_skips_email_without_undoing_approval(self):
        def approve(employee):
            employee.is_approved = True
            return employee

        self.employee.is_approved = False
        with app.app_context(), patch.dict(app.config, {
            "MAIL_DEFAULT_SENDER": ("Warehouse Management", ""),
        }), patch.object(service.dao, "get_employee_by_id", side_effect=self._lookup), \
                patch.object(service.dao, "approve_employee", side_effect=approve), \
                patch.object(service, "send_account_approved_email") as send:
            employee, email_sent = service.approve_employee_service(2, 1)

        self.assertTrue(employee.is_approved)
        self.assertFalse(email_sent)
        send.assert_not_called()

    def test_missing_gmail_credentials_skip_smtp_attempt(self):
        with app.app_context(), patch.dict(app.config, {
            "MAIL_SERVER": "smtp.gmail.com",
            "MAIL_USERNAME": "",
            "MAIL_PASSWORD": "",
            "MAIL_DEFAULT_SENDER": ("Warehouse Management", "sender@example.com"),
        }), patch.object(service, "send_account_locked_email") as send:
            email_sent = service._send_status_notification(
                self.employee, send, "Account lock"
            )

        self.assertFalse(email_sent)
        send.assert_not_called()

    def test_unlock_succeeds_even_if_email_fails(self):
        def unlock(employee, locked):
            employee.is_locked = locked
            return employee

        self.employee.is_locked = True
        with app.app_context(), patch.dict(app.config, {
            "MAIL_SERVER": "smtp.gmail.com",
            "MAIL_USERNAME": "sender@example.com",
            "MAIL_PASSWORD": "test-password",
            "MAIL_DEFAULT_SENDER": ("Warehouse Management", "sender@example.com"),
        }), patch.object(service.dao, "get_employee_by_id", side_effect=self._lookup), \
                patch.object(service.dao, "set_employee_locked", side_effect=unlock), \
                patch.object(service, "send_account_unlocked_email", side_effect=RuntimeError("SMTP unavailable")), \
                patch.object(app.logger, "exception"):
            employee, email_sent = service.set_employee_lock_service(2, 1, False)

        self.assertFalse(employee.is_locked)
        self.assertFalse(email_sent)

    def test_successful_email_is_reported(self):
        def lock(employee, locked):
            employee.is_locked = locked
            return employee

        with app.app_context(), patch.dict(app.config, {
            "MAIL_SERVER": "smtp.gmail.com",
            "MAIL_USERNAME": "sender@example.com",
            "MAIL_PASSWORD": "test-password",
            "MAIL_DEFAULT_SENDER": ("Warehouse Management", "sender@example.com"),
        }), patch.object(service.dao, "get_employee_by_id", side_effect=self._lookup), \
                patch.object(service.dao, "set_employee_locked", side_effect=lock), \
                patch.object(service, "revoke_all_refresh_sessions"), \
                patch.object(service, "send_account_locked_email") as send:
            employee, email_sent = service.set_employee_lock_service(2, 1, True)

        self.assertTrue(employee.is_locked)
        self.assertTrue(email_sent)
        send.assert_called_once_with(employee)

    def test_lock_response_reports_committed_change_and_email_warning(self):
        module = importlib.import_module("web.blueprints.employee_accounts_bp")

        # Call the route body directly so this test does not depend on JWT or a database.
        route = inspect.unwrap(module.update_employee_lock)
        self.employee.is_locked = True
        with app.test_request_context(json={"is_locked": True}), \
                patch.object(module, "set_employee_lock_service", return_value=(self.employee, False)):
            request.employee_id = self.manager.id
            response, status = route(self.employee.id)

        payload = response.get_json()
        self.assertEqual(status, 200)
        self.assertTrue(payload["employee"]["is_locked"])
        self.assertFalse(payload["email_sent"])
        self.assertIn("Đã khóa tài khoản", payload["message"])
        self.assertIn("chưa được gửi", payload["warning"])


if __name__ == "__main__":
    unittest.main()
