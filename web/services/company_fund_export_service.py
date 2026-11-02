"""Plain Excel export for the company cash book."""

from decimal import Decimal
from io import BytesIO
import re

from openpyxl import Workbook
from openpyxl.cell import WriteOnlyCell
from openpyxl.styles import Alignment, Font, PatternFill
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


def _summary_row(sheet, label, amount, background, foreground, size=13):
    label_cell = _text_cell(sheet, label)
    value_cell = _money_cell(sheet, amount)
    for cell in (label_cell, value_cell):
        cell.font = Font(bold=True, size=size, color=foreground)
        cell.fill = PatternFill("solid", fgColor=background)
        cell.alignment = Alignment(horizontal="left", vertical="center", indent=1)
    sheet.append([label_cell, value_cell])


def build_company_fund_history_workbook(rows, method, summary):
    book = Workbook(write_only=True)
    book.properties.title = "Lịch sử thu chi"
    sheet = book.create_sheet("Lịch sử thu chi")
    sheet.freeze_panes = "A11"
    for column, width in enumerate((30, 48, 17, 18, 18, 24, 26), start=1):
        sheet.column_dimensions[get_column_letter(column)].width = width
    for row, height in ((4, 32), (5, 32), (6, 38), (7, 27)):
        sheet.row_dimensions[row].height = height

    title = _text_cell(sheet, "Lịch sử thu chi")
    title.font = Font(bold=True, size=13)
    sheet.append([title])
    sheet.append([_text_cell(sheet, f"Quỹ: {_METHOD_LABELS.get(method, 'Tất cả')}")])
    sheet.append([])

    _summary_row(sheet, "TỔNG THU (đ)", summary.get("total_in", 0), "E5F4E9", "17603B")
    _summary_row(sheet, "TỔNG CHI (đ)", summary.get("total_out", 0), "FFF0E8", "9B3F22")
    _summary_row(sheet, "CÒN LẠI (đ)", summary.get("remaining", 0), "0B3158", "FFFFFF", size=16)
    _summary_row(sheet, "Trong đó: số dư ban đầu", summary.get("opening_balance", 0), "F1F5F9", "334155", size=11)
    sheet.append([_text_cell(sheet, "Tổng thu gồm số dư ban đầu; thu/chi gồm các khoản điều chỉnh.")])
    sheet.append([])

    header_cells = []
    for label in _HEADERS:
        cell = _text_cell(sheet, label)
        cell.font = Font(bold=True)
        cell.fill = PatternFill("solid", fgColor="F2F2F2")
        header_cells.append(cell)
    sheet.append(header_cells)

    for index, entry in enumerate(rows, start=11):
        if index > 1_048_576:
            raise ValidationError("Số giao dịch vượt giới hạn một trang tính Excel")
        occurred_at = WriteOnlyCell(sheet, value=entry.occurred_at)
        occurred_at.number_format = 'dd/mm/yyyy"   "hh:mm:ss'
        occurred_at.alignment = Alignment(horizontal="left", indent=1)
        description = _text_cell(sheet, entry.description)
        description.alignment = Alignment(horizontal="left", indent=1)
        sheet.append([
            occurred_at,
            description,
            _text_cell(sheet, _METHOD_LABELS.get(entry.method, entry.method)),
            _money_cell(sheet, entry.amount if entry.direction == "in" else None),
            _money_cell(sheet, entry.amount if entry.direction == "out" else None),
            _money_cell(sheet, entry.balance_after),
            _text_cell(sheet, entry.employee_name),
        ])

    output = BytesIO()
    book.save(output)
    return output.getvalue()
