from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

from web import db
from web.models import Customer, CustomerPayment, Employee, PaymentType
from web.services.exceptions import NotFoundError, ValidationError


def validate_payment_amount(value, field_name="Số tiền thanh toán"):
    try:
        amount = Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    except (InvalidOperation, TypeError, ValueError):
        raise ValidationError(f"{field_name} không hợp lệ")
    if not amount.is_finite() or amount < 0:
        raise ValidationError(f"{field_name} không được âm")
    return amount


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
