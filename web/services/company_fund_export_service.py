"""Plain Excel export for the company cash book."""

from decimal import Decimal
from io import BytesIO
import re

from openpyxl import Workbook
from openpyxl.cell import WriteOnlyCell
from openpyxl.styles import Font, PatternFill
from openpyxl.utils import get_column_letter

from web.services.exceptions import ValidationError


EXCEL_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
_INVALID_XML = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f]")
_METHOD_LABELS = {"cash": "Tiền mặt", "bank_transfer": "Ngân hàng"}
_HEADERS = (
    "Thời gian", "Nội dung", "Quỹ", "Thu", "Chi",
    "Số dư sau giao dịch", "Người ghi nhận",
)


def _text_cell(sheet, value):
    cell = WriteOnlyCell(sheet, value=_INVALID_XML.sub(" ", str(value or ""))[:32767])
    cell.data_type = "s"
    return cell


def _money_cell(sheet, value):
    if value is None:
        return None
    amount = Decimal(str(value))
    cell = WriteOnlyCell(sheet, value=amount)
    cell.number_format = "#,##0" if amount == amount.to_integral_value() else "#,##0.00"
    return cell


def build_company_fund_history_workbook(rows, method=None):
    book = Workbook(write_only=True)
    book.properties.title = "Lịch sử thu chi"
    sheet = book.create_sheet("Lịch sử thu chi")
    sheet.freeze_panes = "A5"
    for column, width in enumerate((23, 48, 17, 18, 18, 24, 26), start=1):
        sheet.column_dimensions[get_column_letter(column)].width = width

    title = _text_cell(sheet, "Lịch sử thu chi")
    title.font = Font(bold=True, size=13)
    sheet.append([title])
    sheet.append([_text_cell(sheet, f"Quỹ: {_METHOD_LABELS.get(method, 'Tất cả')}")])
    sheet.append([])

    header_cells = []
    for label in _HEADERS:
        cell = _text_cell(sheet, label)
        cell.font = Font(bold=True)
        cell.fill = PatternFill("solid", fgColor="F2F2F2")
        header_cells.append(cell)
    sheet.append(header_cells)

    for index, entry in enumerate(rows, start=5):
        if index > 1_048_576:
            raise ValidationError("Số giao dịch vượt giới hạn một trang tính Excel")
        occurred_at = WriteOnlyCell(sheet, value=entry.occurred_at)
        occurred_at.number_format = "dd/mm/yyyy hh:mm:ss"
        sheet.append([
            occurred_at,
            _text_cell(sheet, entry.description),
            _text_cell(sheet, _METHOD_LABELS.get(entry.method, entry.method)),
            _money_cell(sheet, entry.amount if entry.direction == "in" else None),
            _money_cell(sheet, entry.amount if entry.direction == "out" else None),
            _money_cell(sheet, entry.balance_after),
            _text_cell(sheet, entry.employee_name),
        ])

    output = BytesIO()
    book.save(output)
    return output.getvalue()
