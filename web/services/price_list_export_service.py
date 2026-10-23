from datetime import datetime
from io import BytesIO
from pathlib import Path
from xml.sax.saxutils import escape

from flask import current_app
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    Image,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from web import dao
from web.config import BASE_DIR, Config
from web.services.exceptions import ValidationError
from web.services.product_service import (
    parse_inventory_status,
    parse_optional_price,
)


_FONT_REGISTERED = False


def _format_currency(value):
    return f"{float(value or 0):,.0f} đ".replace(",", ".")


def _parse_filters(keyword, min_price_value, max_price_value, status_value):
    min_price = parse_optional_price(min_price_value, "Giá từ")
    max_price = parse_optional_price(max_price_value, "Giá đến")
    if min_price is not None and max_price is not None and min_price > max_price:
        raise ValidationError("Giá từ không được lớn hơn giá đến")

    return {
        "keyword": str(keyword or "").strip() or None,
        "min_price": min_price,
        "max_price": max_price,
        "status": parse_inventory_status(status_value),
    }


def get_price_list_products(keyword=None, min_price_value=None, max_price_value=None, status_value=None):
    filters = _parse_filters(keyword, min_price_value, max_price_value, status_value)
    max_items = max(1, int(current_app.config.get("REPORT_MAX_ITEMS", 5000)))
    products_data, total = dao.get_products_with_inventory(
        page=1,
        per_page=max_items,
        keyword=filters["keyword"],
        min_price=filters["min_price"],
        max_price=filters["max_price"],
        status=filters["status"],
    )
    if total > max_items:
        raise ValidationError(
            f"Bảng báo giá có {total} sản phẩm, vượt giới hạn xuất {max_items} sản phẩm. "
            "Vui lòng lọc theo tên hoặc khoảng giá trước khi xuất."
        )

    return [item["product"] for item in products_data], filters


def _company_details():
    return {
        "name": current_app.config.get("COMPANY_NAME") or Config.COMPANY_NAME,
        "address": current_app.config.get("COMPANY_ADDRESS") or "",
        "phone": current_app.config.get("COMPANY_PHONE") or "",
        "email": current_app.config.get("COMPANY_EMAIL") or "",
    }


def _register_pdf_fonts():
    global _FONT_REGISTERED
    if _FONT_REGISTERED:
        return "ReportFont", "ReportFontBold"

    candidates = []
    configured = current_app.config.get("REPORT_FONT_PATH") or Config.REPORT_FONT_PATH
    if configured:
        candidates.append(Path(configured))
    candidates.extend(
        [
            BASE_DIR / "assets" / "DejaVuSans.ttf",
            Path(r"C:\Windows\Fonts\arial.ttf"),
            Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
        ]
    )
    regular = next((path for path in candidates if path.is_file()), None)
    if not regular:
        return "Helvetica", "Helvetica-Bold"

    bold_candidates = [
        regular.with_name("DejaVuSans-Bold.ttf"),
        regular.with_name("arialbd.ttf"),
    ]
    bold = next((path for path in bold_candidates if path.is_file()), regular)
    try:
        pdfmetrics.registerFont(TTFont("ReportFont", str(regular)))
        pdfmetrics.registerFont(TTFont("ReportFontBold", str(bold)))
        _FONT_REGISTERED = True
        return "ReportFont", "ReportFontBold"
    except Exception:
        current_app.logger.warning("Không thể nạp font PDF từ %s", regular, exc_info=True)
        return "Helvetica", "Helvetica-Bold"


def _report_logo_path():
    configured = current_app.config.get("REPORT_LOGO_PATH") or Config.REPORT_LOGO_PATH
    candidates = [
        Path(configured) if configured else None,
        BASE_DIR / "assets" / "official_logo.jpg",
        BASE_DIR.parent / "warehouse-management-front-end" / "public" / "official_logo.jpg",
    ]
    return next((path for path in candidates if path and path.is_file()), None)


def build_price_list_pdf(products):
    details = _company_details()
    generated_at = datetime.now().strftime("%d/%m/%Y %H:%M")
    regular_font, bold_font = _register_pdf_fonts()
    output = BytesIO()
    document = SimpleDocTemplate(
        output,
        pagesize=A4,
        rightMargin=15 * mm,
        leftMargin=15 * mm,
        topMargin=18 * mm,
        bottomMargin=16 * mm,
        title="Bảng báo giá",
        author=details["name"],
    )
    styles = getSampleStyleSheet()
    company_style = ParagraphStyle("Company", parent=styles["Normal"], fontName=bold_font, fontSize=13, leading=16, textColor=colors.HexColor("#0B3158"))
    title_style = ParagraphStyle("Title", parent=styles["Normal"], fontName=bold_font, fontSize=18, leading=22, alignment=TA_CENTER, textColor=colors.HexColor("#0B3158"), spaceAfter=4 * mm)
    meta_style = ParagraphStyle("Meta", parent=styles["Normal"], fontName=regular_font, fontSize=9, leading=12, textColor=colors.HexColor("#5D7188"))
    cell_style = ParagraphStyle("Cell", parent=styles["Normal"], fontName=regular_font, fontSize=9, leading=12, textColor=colors.HexColor("#1B2D40"))
    cell_right_style = ParagraphStyle("CellRight", parent=cell_style, alignment=TA_RIGHT)
    header_style = ParagraphStyle("Header", parent=cell_style, fontName=bold_font, textColor=colors.white, alignment=TA_CENTER)

    header_parts = []
    logo_path = _report_logo_path()
    if logo_path:
        try:
            header_parts.append(Image(str(logo_path), width=24 * mm, height=18 * mm))
        except Exception:
            header_parts.append("")
    else:
        header_parts.append("")
    header_parts.append(Paragraph(escape(details["name"]), company_style))
    story = [Table([header_parts], colWidths=[30 * mm, 145 * mm], style=TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 4)])), Spacer(1, 5 * mm)]
    story.append(Paragraph("BẢNG BÁO GIÁ", title_style))
    story.append(Paragraph(f"Ngày xuất: {generated_at}", meta_style))
    story.append(Spacer(1, 5 * mm))

    table_data = [[
        Paragraph("STT", header_style),
        Paragraph("SẢN PHẨM", header_style),
        Paragraph("ĐƠN VỊ TÍNH", header_style),
        Paragraph("ĐƠN GIÁ BÁN", header_style),
    ]]
    for index, product in enumerate(products, start=1):
        table_data.append([
            Paragraph(str(index), cell_style),
            Paragraph(escape(product.name), cell_style),
            Paragraph(escape(product.unit), cell_style),
            Paragraph(_format_currency(product.default_sale_price), cell_right_style),
        ])

    price_table = Table(table_data, colWidths=[15 * mm, 85 * mm, 35 * mm, 40 * mm], repeatRows=1)
    table_commands = [
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0B3158")),
        ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#D9E2EC")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]
    for row in range(1, len(table_data)):
        if row % 2 == 0:
            table_commands.append(("BACKGROUND", (0, row), (-1, row), colors.HexColor("#F3F7FA")))
    price_table.setStyle(TableStyle(table_commands))
    story.append(price_table)
    story.extend([
        Spacer(1, 7 * mm),
        Paragraph("Ghi chú: Giá bán có thể thay đổi theo chính sách kinh doanh tại thời điểm đặt hàng.", meta_style),
    ])

    def draw_footer(canvas, document):
        canvas.saveState()
        canvas.setFont(regular_font, 8)
        canvas.setFillColor(colors.HexColor("#71849A"))
        canvas.drawRightString(A4[0] - 15 * mm, 9 * mm, f"Trang {document.page}")
        canvas.restoreState()

    document.build(story, onFirstPage=draw_footer, onLaterPages=draw_footer)
    output.seek(0)
    return output


def build_price_list_export(format_value, keyword=None, min_price_value=None, max_price_value=None, status_value=None):
    products, _ = get_price_list_products(keyword, min_price_value, max_price_value, status_value)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    normalized = str(format_value or "pdf").strip().lower()
    if normalized != "pdf":
        raise ValidationError("Định dạng xuất không hợp lệ. Chỉ hỗ trợ PDF.")
    return build_price_list_pdf(products), f"bang_bao_gia_{timestamp}.pdf", "application/pdf"
