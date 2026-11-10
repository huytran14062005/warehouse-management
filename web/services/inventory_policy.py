"""Shared inventory rules used by stock calculations and movement reports."""

from sqlalchemy import and_, or_

from web.models import InvoiceStatus, SalesInvoice


# A central-warehouse sale consumes physical stock as soon as it leaves draft.
# Keeping this list in one place prevents inventory screens and movement reports
# from silently using different status filters.
STOCK_DEDUCTING_SALES_STATUSES = (
    InvoiceStatus.PROCESSING,
    InvoiceStatus.DELIVERING,
    InvoiceStatus.COMPLETED,
)


def stock_deducting_sales_filter():
    """Keep dispatched, cancelled goods out of stock until return receipt."""
    return or_(
        SalesInvoice.status.in_(STOCK_DEDUCTING_SALES_STATUSES),
        and_(
            SalesInvoice.status == InvoiceStatus.CANCELLED,
            SalesInvoice.return_pending.is_(True),
        ),
    )
