"""Create the warehouse movement workbook from the same rows as the screen."""

from datetime import date
from io import BytesIO
import re

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

from web.services.exceptions import ValidationError


EXCEL_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
_ILLEGAL_XML_CHARS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f]")
_HEADERS = (
    "Sản phẩm", "Đơn vị", "Nhập trong kỳ", "Xuất bán", "Điều chuyển",
    "Hư hỏng", "Tồn hiện tại", "Trạng thái",
)


def _text(value):
    """Keep untrusted product names as literal Excel strings and valid XML."""
    return _ILLEGAL_XML_CHARS.sub(" ", str(value or ""))[:32767]


def _status(row, percentage):
    stock = int(row.get("current_stock") or 0)
    imported = int(row.get("total_imported") or 0)
    if stock <= 0:
        return "Hết hàng"
    if imported > 0 and stock <= imported * percentage / 100:
        return "Sắp hết hàng"
    return "Còn hàng"


def build_warehouse_report_workbook(report):
    rows = report["by_product"]
    if len(rows) > 1_048_572:
        raise ValidationError("Số sản phẩm vượt giới hạn một trang tính Excel")

    percentage = float(report["summary"]["low_stock_percentage"])
    book = Workbook()
    book.properties.title = "Báo cáo nhập xuất kho"
    sheet = book.active
    sheet.title = "Nhập xuất kho"
    sheet.merge_cells("A1:H1")
    sheet["A1"] = "Báo cáo nhập – xuất kho"
    sheet["A1"].font = Font(size=13, bold=True)
    sheet.row_dimensions[1].height = 24

    sheet.merge_cells("A2:B2")
    warehouse = report.get("warehouse")
    sheet["A2"] = _text(f"Kho: {warehouse['name']}" if warehouse else "Tất cả kho")
    sheet["A2"].data_type = "s"
    sheet["D2"] = "Từ ngày"
    sheet["G2"] = "Đến ngày"
    for cell, raw in ((sheet["E2"], report["period"]["from"]),
                      (sheet["H2"], report["period"]["to"])):
        if raw:
            cell.value = date.fromisoformat(raw)
            cell.number_format = "dd/mm/yyyy"
        else:
            cell.value = "Tất cả"

    for column, label in enumerate(_HEADERS, start=1):
        cell = sheet.cell(4, column, label)
        cell.fill = PatternFill("solid", fgColor="F2F2F2")
        cell.font = Font(bold=True)
        cell.alignment = Alignment(vertical="center", wrap_text=True)
    sheet.row_dimensions[4].height = 28

    for row_number, product in enumerate(rows, start=5):
        values = (
            product.get("product_name"), product.get("unit"),
            product.get("imported"), product.get("exported"),
            product.get("transferred"), product.get("damaged"),
            product.get("current_stock"), _status(product, percentage),
        )
        for column, value in enumerate(values, start=1):
            cell = sheet.cell(row_number, column)
            if column in (1, 2, 8):
                cell.value = _text(value)
                cell.data_type = "s"
            else:
                cell.value = int(value or 0)
                cell.number_format = "#,##0"
                cell.alignment = Alignment(horizontal="right")

    for index, width in enumerate((33, 14, 19, 16, 17, 15, 18, 19), start=1):
        sheet.column_dimensions[get_column_letter(index)].width = width
    sheet.freeze_panes = "C5"
    sheet.auto_filter.ref = f"A4:H{max(4, 4 + len(rows))}"

    output = BytesIO()
    book.save(output)
    return output.getvalue()
