from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from sqlalchemy.orm import selectinload

from web import db
from web.models import (
    Customer,
    CustomerPayment,
    Employee,
    InvoiceStatus,
    PaymentStatus,
    PaymentType,
    SalesInvoice,
)
from web.services.exceptions import NotFoundError, ValidationError
from web.services.validators import validate_money_amount


def validate_payment_amount(value, field_name="Số tiền thanh toán"):
    return validate_money_amount(value, field_name)


def _allocate_payment_to_open_invoices(customer_id, payment_amount):
    """Allocate debt collection to the oldest due invoices in one locked batch."""
    amount_left = Decimal(str(payment_amount))
    if amount_left <= 0:
        return

    invoices = (
        SalesInvoice.query
        .options(selectinload(SalesInvoice.items))
        .filter(
            SalesInvoice.customer_id == customer_id,
            SalesInvoice.status == InvoiceStatus.COMPLETED,
            SalesInvoice.payment_status != PaymentStatus.PAID,
        )
        .order_by(
            SalesInvoice.payment_due_date.is_(None),
            SalesInvoice.payment_due_date.asc(),
            SalesInvoice.sold_at.asc(),
            SalesInvoice.id.asc(),
        )
        .with_for_update()
        .all()
    )
    for invoice in invoices:
        total = sum(
            Decimal(str(item.quantity)) * Decimal(str(item.unit_price))
            for item in invoice.items
        ) - Decimal(str(invoice.discount_amount or 0))
        already_paid = Decimal(str(invoice.paid_amount or 0))
        remaining = max(Decimal("0"), total - already_paid)
        if remaining <= 0:
            invoice.payment_status = PaymentStatus.PAID
            continue

        allocated = min(amount_left, remaining)
        invoice.paid_amount = already_paid + allocated
        invoice.payment_status = (
            PaymentStatus.PAID
            if invoice.paid_amount >= total
            else PaymentStatus.PARTIAL
        )
        amount_left -= allocated
        if amount_left <= 0:
            break


def record_old_debt_payment_service(customer_id, employee_id, amount, note=""):
    payment_amount = validate_payment_amount(amount)
    if payment_amount <= 0:
        raise ValidationError("Số tiền trả nợ phải lớn hơn 0")

    customer = (
        Customer.query
        .filter(Customer.id == customer_id)
        .with_for_update()
        .first()
    )
    if not customer:
        raise NotFoundError("Khách hàng không tồn tại")
    if payment_amount > Decimal(str(customer.debt_amount)):
        raise ValidationError("Số tiền trả vượt quá công nợ hiện tại")

    collector = Employee.query.get(employee_id)
    if not collector:
        raise NotFoundError("Nhân viên không tồn tại")

    try:
        old_debt = Decimal(str(customer.debt_amount))
        customer.debt_amount = old_debt - payment_amount
        _allocate_payment_to_open_invoices(customer.id, payment_amount)
        payment = CustomerPayment(
            customer_id=customer.id,
            employee_id=collector.id,
            amount=payment_amount,
            payment_type=PaymentType.OLD_DEBT,
            note=str(note or "").strip() or None,
        )
        db.session.add(payment)
        db.session.commit()
        return payment, old_debt, customer.debt_amount, customer
    except Exception as error:
        db.session.rollback()
        raise Exception(f"Lỗi ghi nhận trả nợ cũ: {error}")
