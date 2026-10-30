"""Internal cash book. Its balances describe recorded money, not bank transfers."""

from datetime import datetime
from decimal import Decimal, InvalidOperation

from sqlalchemy import inspect
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from web import db
from web.models import CompanyFund, CompanyFundAdjustment, CompanyFundEntry, EmployeeRole, FundEntryType, PaymentMethod
from web.services.authorization import get_employee_or_404
from web.services.exceptions import ForbiddenError, ValidationError
from web.utils.pagination import build_pagination


FUND_METHODS = (PaymentMethod.CASH.value, PaymentMethod.BANK_TRANSFER.value)
MAX_MONEY = Decimal("999999999999.99")


def _parse_balance(value, label):
    try:
        if isinstance(value, bool):
            raise InvalidOperation
        amount = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        raise ValidationError(f"{label} không hợp lệ")
    if not amount.is_finite() or amount < 0 or amount > MAX_MONEY or amount.as_tuple().exponent < -2:
        raise ValidationError(f"{label} phải từ 0 đồng và có tối đa 2 chữ số thập phân")
    return amount


def _parse_opening_balance(value, name):
    return _parse_balance(value, f"Số dư ban đầu của {name}")


def _fund_tables_exist():
    # Reuse the caller's transaction connection. Opening a second connection
    # during a payment can roll back an in-memory SQLite transaction.
    inspector = inspect(db.session.connection())
    return inspector.has_table(CompanyFund.__tablename__) and inspector.has_table(CompanyFundEntry.__tablename__)


def serialize_fund(fund):
    return {
        "method": fund.method,
        "opening_balance": float(fund.opening_balance),
        "balance": float(fund.balance),
        "opened_at": fund.opened_at.isoformat(),
        "opened_by": fund.opened_by.full_name if fund.opened_by else None,
    }


def get_company_funds():
    if not _fund_tables_exist():
        return {"initialized": False, "funds": [], "total_balance": 0, "total_opening_balance": 0}
    funds = CompanyFund.query.order_by(CompanyFund.method).all()
    if len(funds) not in (0, 2):
        raise ValidationError("Sổ quỹ chưa được khởi tạo đầy đủ. Vui lòng liên hệ quản lý.")
    return {
        "initialized": len(funds) == 2,
        "funds": [serialize_fund(fund) for fund in funds],
        "total_balance": float(sum((fund.balance for fund in funds), Decimal("0"))),
        "total_opening_balance": float(sum((fund.opening_balance for fund in funds), Decimal("0"))),
    }


def initialize_company_funds(employee_id, cash_balance, bank_balance):
    employee = get_employee_or_404(employee_id)
    if employee.role != EmployeeRole.QUAN_LY:
        raise ForbiddenError("Chỉ quản lý được đặt số dư ban đầu của công ty")
    amounts = {
        PaymentMethod.CASH.value: _parse_opening_balance(cash_balance, "tiền mặt"),
        PaymentMethod.BANK_TRANSFER.value: _parse_opening_balance(bank_balance, "ngân hàng"),
    }

    # Authorization has already read employees in this request. On MySQL that
    # read transaction holds a metadata lock on employees; creating a table
    # with an employee foreign key on another connection would wait for itself.
    db.session.rollback()

    # DDL is separate from the fund transaction. Existing databases gain the
    # two new tables without changing historical customer/supplier payments.
    CompanyFund.__table__.create(bind=db.engine, checkfirst=True)
    CompanyFundEntry.__table__.create(bind=db.engine, checkfirst=True)
    CompanyFundAdjustment.__table__.create(bind=db.engine, checkfirst=True)
    with Session(db.engine) as session:
        try:
            if session.query(CompanyFund).count():
                raise ValidationError("Số dư ban đầu đã được đặt và không thể đặt lại")
            now = datetime.now()
            for method, amount in amounts.items():
                fund = CompanyFund(
                    method=method, opening_balance=amount, balance=amount,
                    opened_at=now, opened_by_id=employee_id,
                )
                session.add(fund)
                if amount > 0:
                    session.add(CompanyFundEntry(
                        method=method, direction="in", entry_type=FundEntryType.OPENING.value,
                        amount=amount, balance_after=amount, occurred_at=now,
                        source_type=FundEntryType.OPENING.value,
                        source_id=1 if method == PaymentMethod.CASH.value else 2,
                        description="Số dư ban đầu", employee_id=employee_id,
                    ))
            session.commit()
        except IntegrityError:
            session.rollback()
            raise ValidationError("Sổ quỹ đã được khởi tạo. Vui lòng tải lại trang.")
    # Authentication opened a read transaction before the separate DDL/write
    # session. End that snapshot so MySQL can see the newly committed funds.
    db.session.rollback()
    return get_company_funds()


def adjust_company_fund(employee_id, method, new_balance, expected_balance, reason):
    employee = get_employee_or_404(employee_id)
    if employee.role != EmployeeRole.QUAN_LY:
        raise ForbiddenError("Chỉ quản lý được điều chỉnh số dư công ty")
    if method not in FUND_METHODS:
        raise ValidationError("Quỹ cần điều chỉnh không hợp lệ")
    target = _parse_balance(new_balance, "Số dư mới")
    expected = _parse_balance(expected_balance, "Số dư hiện tại")
    reason = str(reason or "").strip()
    if not reason or len(reason) > 500:
        raise ValidationError("Vui lòng nhập lý do điều chỉnh, tối đa 500 ký tự")
    if not _fund_tables_exist():
        raise ValidationError("Sổ quỹ chưa được thiết lập")

    # Older installations may already have the two fund tables. Create the
    # adjustment audit table before opening the write transaction.
    db.session.rollback()
    CompanyFundAdjustment.__table__.create(bind=db.engine, checkfirst=True)
    try:
        fund = CompanyFund.query.filter_by(method=method).with_for_update().first()
        if fund is None:
            raise ValidationError("Sổ quỹ chưa được thiết lập")
        current = Decimal(str(fund.balance))
        if current != expected:
            raise ValidationError("Số dư đã thay đổi. Vui lòng kiểm tra lại trước khi điều chỉnh.", status_code=409)
        difference = target - current
        if difference == 0:
            raise ValidationError("Số dư mới phải khác số dư hiện tại")
        adjustment = CompanyFundAdjustment(
            method=method, previous_balance=current, new_balance=target,
            reason=reason, employee_id=employee_id,
        )
        db.session.add(adjustment)
        db.session.flush()
        fund_name = "tiền mặt" if method == PaymentMethod.CASH.value else "ngân hàng"
        record_fund_movement(
            method, "in" if difference > 0 else "out", abs(difference),
            "balance_adjustment", adjustment.id, employee_id,
            f"Điều chỉnh số dư {fund_name}", reason,
        )
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise
    return get_company_funds()


def record_fund_movement(method, direction, amount, source_type, source_id, employee_id, description, note=None):
    """Append one entry in the caller's transaction; never commit here.

    Historical payments are represented by the manager's opening balance and
    must never be backfilled into this ledger.
    """
    if not _fund_tables_exist():
        raise ValidationError("Quản lý cần thiết lập số dư ban đầu trước khi ghi nhận thanh toán")
    method = method.value if isinstance(method, PaymentMethod) else method
    if method not in FUND_METHODS or direction not in ("in", "out"):
        raise ValidationError("Phương thức hoặc chiều dòng tiền không hợp lệ")
    amount = Decimal(str(amount))
    if not amount.is_finite() or amount <= 0:
        raise ValidationError("Số tiền ghi sổ quỹ phải lớn hơn 0")
    fund = CompanyFund.query.filter_by(method=method).with_for_update().first()
    if fund is None:
        raise ValidationError("Quản lý cần thiết lập số dư ban đầu trước khi ghi nhận thanh toán")
    balance = Decimal(str(fund.balance))
    next_balance = balance + amount if direction == "in" else balance - amount
    if next_balance < 0:
        label = "tiền mặt" if method == PaymentMethod.CASH.value else "ngân hàng"
        raise ValidationError(f"Số dư {label} không đủ để trả nhà cung cấp")
    if next_balance > MAX_MONEY:
        raise ValidationError("Số dư quỹ vượt giới hạn cho phép")
    fund.balance = next_balance
    entry = CompanyFundEntry(
        method=method, direction=direction, entry_type=source_type,
        amount=amount, balance_after=next_balance,
        source_type=source_type, source_id=source_id, employee_id=employee_id,
        description=description, note=note,
    )
    db.session.add(entry)
    return entry


def list_company_fund_entries(method=None, page=1, per_page=20):
    if method and method not in FUND_METHODS:
        raise ValidationError("Quỹ cần xem không hợp lệ")
    try:
        page = int(page)
    except (TypeError, ValueError):
        raise ValidationError("Số trang không hợp lệ")
    if page < 1:
        raise ValidationError("Số trang không hợp lệ")
    if not _fund_tables_exist():
        return {"entries": [], "pagination": build_pagination(page, per_page, 0)}
    query = CompanyFundEntry.query
    if method:
        query = query.filter_by(method=method)
    total = query.count()
    rows = query.order_by(CompanyFundEntry.occurred_at.desc(), CompanyFundEntry.id.desc()).offset((page - 1) * per_page).limit(per_page).all()
    entries = [
        {
            "id": row.id,
            "method": row.method,
            "direction": row.direction,
            "entry_type": row.entry_type,
            "amount": float(row.amount),
            "balance_after": float(row.balance_after),
            "occurred_at": row.occurred_at.isoformat(),
            "description": row.description,
            "note": row.note,
            "employee_name": row.employee.full_name if row.employee else None,
        }
        for row in rows
    ]
    return {"entries": entries, "pagination": build_pagination(page, per_page, total)}
