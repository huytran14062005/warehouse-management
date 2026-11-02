import os
import unittest
from datetime import datetime, timedelta
from decimal import Decimal
from io import BytesIO

from openpyxl import load_workbook

from web import app, db
from web.models import CompanyFund, CompanyFundEntry, Employee, EmployeeRole
from web.services.company_fund_export_service import build_company_fund_history_workbook
from web.services.company_fund_service import (
    get_company_fund_export_rows, get_company_fund_export_summary,
)


@unittest.skipUnless(os.environ.get("DATABASE_URL", "").startswith("sqlite"), "Requires an isolated SQLite database")
class CompanyFundExportTest(unittest.TestCase):
    def setUp(self):
        self.context = app.app_context()
        self.context.push()
        db.create_all()

        employee = Employee(
            full_name="Người ghi sổ", phone="0900000099", username="fundexport",
            email="fundexport@example.invalid", password_hash="x",
            role=EmployeeRole.KE_TOAN, is_approved=True, is_locked=False,
        )
        db.session.add(employee)
        db.session.flush()

        now = datetime(2026, 11, 2, 9, 30, 0)
        for method, opening, remaining in (
            ("cash", "100.25", "115.50"),
            ("bank_transfer", "50.00", "40.00"),
        ):
            db.session.add(CompanyFund(
                method=method, opening_balance=Decimal(opening),
                balance=Decimal(remaining), opened_at=now, opened_by_id=employee.id,
            ))
        db.session.flush()

        entries = (
            ("cash", "in", "opening", "100.25", "100.25"),
            ("bank_transfer", "in", "opening", "50.00", "50.00"),
            ("cash", "in", "customer_receipt", "20.25", "120.50"),
            ("bank_transfer", "out", "supplier_payment", "10.00", "40.00"),
            ("cash", "out", "balance_adjustment", "5.00", "115.50"),
        )
        for index, (method, direction, entry_type, amount, balance) in enumerate(entries, start=1):
            db.session.add(CompanyFundEntry(
                method=method, direction=direction, entry_type=entry_type,
                amount=Decimal(amount), balance_after=Decimal(balance),
                occurred_at=now + timedelta(seconds=index),
                source_type=entry_type, source_id=index,
                description=f"Giao dịch {index}", employee_id=employee.id,
            ))
        db.session.commit()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.context.pop()

    def test_totals_match_ledger_and_fund_filter(self):
        all_funds = get_company_fund_export_summary()
        self.assertEqual(all_funds, {
            "total_in": Decimal("170.50"),
            "total_out": Decimal("15.00"),
            "opening_balance": Decimal("150.25"),
            "remaining": Decimal("155.50"),
        })
        self.assertEqual(all_funds["total_in"] - all_funds["total_out"], all_funds["remaining"])

        cash = get_company_fund_export_summary("cash")
        self.assertEqual(cash["total_in"], Decimal("120.50"))
        self.assertEqual(cash["total_out"], Decimal("5.00"))
        self.assertEqual(cash["remaining"], Decimal("115.50"))

        combined_book = load_workbook(BytesIO(build_company_fund_history_workbook(
            get_company_fund_export_rows(), None, all_funds,
        )))
        combined = combined_book.active
        self.assertEqual((combined["B4"].value, combined["B5"].value, combined["B6"].value),
                         (170.5, 15, 155.5))
        self.assertEqual(combined.max_row, 15)

        book = load_workbook(BytesIO(build_company_fund_history_workbook(
            get_company_fund_export_rows("cash"), "cash", cash,
        )))
        sheet = book.active
        self.assertEqual(sheet["A2"].value, "Quỹ: Tiền mặt")
        self.assertEqual((sheet["A4"].value, sheet["B4"].value), ("TỔNG THU (đ)", 120.5))
        self.assertEqual((sheet["A5"].value, sheet["B5"].value), ("TỔNG CHI (đ)", 5))
        self.assertEqual((sheet["A6"].value, sheet["B6"].value), ("CÒN LẠI (đ)", 115.5))
        self.assertEqual(sheet["B7"].value, 100.25)
        self.assertEqual(sheet["A10"].value, "Thời gian")
        self.assertEqual(sheet["A11"].value, datetime(2026, 11, 2, 9, 30, 5))
        self.assertEqual(sheet.freeze_panes, "A11")
        self.assertEqual(sheet["A6"].fill.fgColor.rgb, "000B3158")
        self.assertEqual(sheet["B4"].number_format, "#,##0.00")


if __name__ == "__main__":
    unittest.main()
