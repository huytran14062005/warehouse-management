import os
import subprocess
import sys
import unittest
from datetime import date
from decimal import Decimal
from io import BytesIO
from pathlib import Path
from unittest.mock import patch

from openpyxl import load_workbook

from web import app
from web.services.overdue_debt_report_service import _build_workbook, _recipient_emails


ROOT = Path(__file__).resolve().parent.parent


class SecurityHardeningTest(unittest.TestCase):
    def test_production_report_requires_explicit_recipients(self):
        with app.app_context(), patch.dict(app.config, {
            "IS_PRODUCTION": True,
            "OVERDUE_REPORT_RECIPIENTS": (),
        }):
            self.assertEqual(_recipient_emails(), [])

    def test_missing_report_recipient_has_no_built_in_address(self):
        environment = os.environ.copy()
        environment["OVERDUE_REPORT_RECIPIENTS"] = ""
        result = subprocess.run(
            [sys.executable, "-c", "from web.config import Config; assert Config.OVERDUE_REPORT_RECIPIENTS == ()"],
            cwd=ROOT, env=environment, capture_output=True, text=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_overdue_report_treats_customer_fields_as_text(self):
        rows = [{
            "full_name": "=1+1",
            "phone": "=2+2",
            "address": "=3+3",
            "invoice_count": 1,
            "overdue_amount": Decimal("1000"),
            "oldest_due_date": date(2026, 10, 1),
            "days_overdue": 32,
            "invoice_ids": "=4+4",
        }]
        workbook = load_workbook(BytesIO(_build_workbook(rows, date(2026, 11, 2))))
        sheet = workbook.active
        for column, expected in ((2, "=1+1"), (3, "=2+2"), (4, "=3+3"), (9, "=4+4")):
            with self.subTest(column=column):
                cell = sheet.cell(5, column)
                self.assertEqual(cell.value, expected)
                self.assertEqual(cell.data_type, "s")
        self.assertEqual(sheet.cell(5, 6).value, 1000)

    def test_vercel_production_rejects_missing_explicit_secret(self):
        environment = os.environ.copy()
        environment.update({
            "APP_ENV": "development",
            "VERCEL_ENV": "",
            "VERCEL_TARGET_ENV": "production",
            "SECRET_KEY": "",
            "JWT_SECRET": "j" * 40,
            "FRONTEND_ORIGINS": "https://example.test",
            "DATABASE_URL": "sqlite:///:memory:",
        })
        result = subprocess.run(
            [sys.executable, "-c", "import web"],
            cwd=ROOT, env=environment, capture_output=True, text=True,
            check=False,
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("SECRET_KEY must be explicitly configured", result.stderr)

    def test_demo_reset_cannot_run_in_production(self):
        environment = os.environ.copy()
        environment.update({
            "APP_ENV": "development",
            "VERCEL_ENV": "production",
            "SECRET_KEY": "s" * 40,
            "JWT_SECRET": "j" * 40,
            "FRONTEND_ORIGINS": "https://example.test",
            "DATABASE_URL": "sqlite:///:memory:",
        })
        result = subprocess.run(
            [sys.executable, "init_db.py"],
            cwd=ROOT, env=environment, capture_output=True, text=True,
            check=False,
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Demo database reset is disabled in production", result.stderr)

    def test_development_server_cannot_run_in_production(self):
        environment = os.environ.copy()
        environment.update({
            "APP_ENV": "production",
            "SECRET_KEY": "s" * 40,
            "JWT_SECRET": "j" * 40,
            "FRONTEND_ORIGINS": "https://example.test",
            "DATABASE_URL": "sqlite:///:memory:",
        })
        for entrypoint in ("app.py", "web/index.py"):
            with self.subTest(entrypoint=entrypoint):
                result = subprocess.run(
                    [sys.executable, entrypoint],
                    cwd=ROOT, env=environment, capture_output=True, text=True,
                    check=False, timeout=10,
                )
                self.assertNotEqual(result.returncode, 0)
                self.assertIn("Use a production application server", result.stderr)


if __name__ == "__main__":
    unittest.main()
