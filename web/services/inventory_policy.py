"""Shared inventory rules used by stock calculations and movement reports."""

from web.models import InvoiceStatus


# A central-warehouse sale consumes physical stock as soon as it leaves draft.
# Keeping this list in one place prevents inventory screens and movement reports
# from silently using different status filters.
STOCK_DEDUCTING_SALES_STATUSES = (
    InvoiceStatus.PROCESSING,
    InvoiceStatus.DELIVERING,
    InvoiceStatus.COMPLETED,
)
