import json
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

from sqlalchemy import func

from web import db
from web.models import Promotion
from web.services.exceptions import NotFoundError, ValidationError
from web.services.validators import MIN_MONEY_AMOUNT, validate_money_amount


CONDITION_MIN_QUANTITY = "min_quantity"
CONDITION_MIN_ORDER_AMOUNT = "min_order_amount"
CONDITION_HOLIDAY = "holiday"
DISCOUNT_FIXED_AMOUNT = "fixed_amount"
DISCOUNT_PERCENTAGE = "percentage"
PROMOTION_NOTE_PREFIX = "__PROMOTION_V1__:"
BUSINESS_TIMEZONE = timezone(timedelta(hours=7))

CONDITION_TYPES = {
    CONDITION_MIN_QUANTITY,
    CONDITION_MIN_ORDER_AMOUNT,
    CONDITION_HOLIDAY,
}
DISCOUNT_TYPES = {DISCOUNT_FIXED_AMOUNT, DISCOUNT_PERCENTAGE}


def _money(value, field_name, allow_none=False, minimum=MIN_MONEY_AMOUNT):
    if allow_none and value in (None, ""):
        return None
    return validate_money_amount(value, field_name, minimum=minimum)


def _positive_integer(value, field_name, allow_none=False):
    if allow_none and value in (None, ""):
        return None
    try:
        number = int(value)
        if isinstance(value, bool) or number <= 0 or float(value) != number:
            raise ValueError
    except (TypeError, ValueError):
        raise ValidationError(f"{field_name} phải là số nguyên lớn hơn 0")
    return number


def _date(value, field_name, allow_none=True):
    if allow_none and value in (None, ""):
        return None
    if isinstance(value, date):
        return value
    try:
        return datetime.strptime(str(value), "%Y-%m-%d").date()
    except (TypeError, ValueError):
        raise ValidationError(f"{field_name} không hợp lệ")


def _boolean(value, default=True):
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    normalized = str(value).strip().lower()
    if normalized in {"true", "1", "yes"}:
        return True
    if normalized in {"false", "0", "no"}:
        return False
    raise ValidationError("Trạng thái khuyến mãi không hợp lệ")


def _format_vnd(value):
    return f"{float(value or 0):,.0f}".replace(",", ".") + " đ"


def condition_summary(promotion):
    if promotion.condition_type == CONDITION_MIN_QUANTITY:
        summary = f"Mua từ {promotion.min_quantity} sản phẩm"
    elif promotion.condition_type == CONDITION_MIN_ORDER_AMOUNT:
        summary = f"Đơn hàng từ {_format_vnd(promotion.min_order_amount)}"
    else:
        summary = "Khuyến mãi theo dịp/ngày lễ"

    if promotion.start_date and promotion.end_date:
        summary += (
            f" · {promotion.start_date.strftime('%d/%m/%Y')}"
            f"–{promotion.end_date.strftime('%d/%m/%Y')}"
        )
    elif promotion.start_date:
        summary += f" · từ {promotion.start_date.strftime('%d/%m/%Y')}"
    elif promotion.end_date:
        summary += f" · đến {promotion.end_date.strftime('%d/%m/%Y')}"
    return summary


def benefit_summary(promotion):
    if promotion.discount_type == DISCOUNT_PERCENTAGE:
        value = f"{float(promotion.discount_value):g}%"
        if promotion.max_discount_amount not in (None, 0):
            value += f" (tối đa {_format_vnd(promotion.max_discount_amount)})"
        return f"Giảm {value}"
    return f"Giảm {_format_vnd(promotion.discount_value)}"


def _normalize_payload(data, current=None):
    name = str(data.get("name", current.name if current else "") or "").strip()
    if not name:
        raise ValidationError("Tên khuyến mãi không được để trống")
    if len(name) > 150:
        raise ValidationError("Tên khuyến mãi không được vượt quá 150 ký tự")

    condition_type = str(
        data.get("condition_type", current.condition_type if current else "") or ""
    ).strip()
    if condition_type not in CONDITION_TYPES:
        raise ValidationError("Loại điều kiện khuyến mãi không hợp lệ")

    discount_type = str(
        data.get("discount_type", current.discount_type if current else "") or ""
    ).strip()
    if discount_type not in DISCOUNT_TYPES:
        raise ValidationError("Kiểu giảm khuyến mãi không hợp lệ")

    min_quantity = _positive_integer(
        data.get("min_quantity", current.min_quantity if current else None),
        "Số lượng tối thiểu",
        allow_none=True,
    )
    min_order_amount = _money(
        data.get(
            "min_order_amount",
            current.min_order_amount if current else None,
        ),
        "Giá trị đơn tối thiểu",
        allow_none=True,
    )
    start_date = _date(
        data.get("start_date", current.start_date if current else None),
        "Ngày bắt đầu",
    )
    end_date = _date(
        data.get("end_date", current.end_date if current else None),
        "Ngày kết thúc",
    )
    discount_value = _money(
        data.get("discount_value", current.discount_value if current else None),
        "Mức khuyến mãi",
        minimum=Decimal("0.01") if discount_type == DISCOUNT_PERCENTAGE else MIN_MONEY_AMOUNT,
    )
    max_discount_amount = _money(
        data.get(
            "max_discount_amount",
            current.max_discount_amount if current else None,
        ),
        "Mức giảm tối đa",
        allow_none=True,
    )
    is_active = _boolean(
        data.get("is_active"),
        default=current.is_active if current else True,
    )

    if discount_value <= 0:
        raise ValidationError("Mức khuyến mãi phải lớn hơn 0")
    if discount_type == DISCOUNT_PERCENTAGE and discount_value > 100:
        raise ValidationError("Phần trăm khuyến mãi không được vượt quá 100%")
    if discount_type == DISCOUNT_FIXED_AMOUNT:
        max_discount_amount = None
    if condition_type == CONDITION_MIN_QUANTITY:
        if min_quantity is None:
            raise ValidationError("Vui lòng nhập số lượng sản phẩm tối thiểu")
        min_order_amount = None
    elif condition_type == CONDITION_MIN_ORDER_AMOUNT:
        if min_order_amount is None or min_order_amount <= 0:
            raise ValidationError("Giá trị đơn tối thiểu phải lớn hơn 0")
        min_quantity = None
    else:
        min_quantity = None
        min_order_amount = None
        if not start_date or not end_date:
            raise ValidationError("Khuyến mãi dịp/ngày lễ phải có ngày bắt đầu và kết thúc")
    if start_date and end_date and start_date > end_date:
        raise ValidationError("Ngày bắt đầu không được sau ngày kết thúc")

    return {
        "name": name,
        "condition_type": condition_type,
        "min_quantity": min_quantity,
        "min_order_amount": min_order_amount,
        "start_date": start_date,
        "end_date": end_date,
        "discount_type": discount_type,
        "discount_value": discount_value,
        "max_discount_amount": max_discount_amount,
        "is_active": is_active,
    }


def evaluate_promotion(
    promotion,
    subtotal,
    total_quantity,
    evaluation_date=None,
    allow_inactive=False,
    ignore_validity_period=False,
):
    subtotal = _money(subtotal, "Tiền hàng", minimum=None)
    try:
        total_quantity = int(total_quantity or 0)
        if total_quantity < 0:
            raise ValueError
    except (TypeError, ValueError):
        raise ValidationError("Tổng số lượng sản phẩm không hợp lệ")
    evaluation_date = evaluation_date or datetime.now(BUSINESS_TIMEZONE).date()

    if not promotion.is_active and not allow_inactive:
        return False, Decimal("0"), "Khuyến mãi đã ngừng áp dụng"
    if not ignore_validity_period:
        if promotion.start_date and evaluation_date < promotion.start_date:
            return False, Decimal("0"), "Khuyến mãi chưa đến thời gian áp dụng"
        if promotion.end_date and evaluation_date > promotion.end_date:
            return False, Decimal("0"), "Khuyến mãi đã hết hạn"
    if (
        promotion.condition_type == CONDITION_MIN_QUANTITY
        and total_quantity < promotion.min_quantity
    ):
        missing = promotion.min_quantity - total_quantity
        return False, Decimal("0"), f"Cần mua thêm {missing} sản phẩm"
    if (
        promotion.condition_type == CONDITION_MIN_ORDER_AMOUNT
        and subtotal < promotion.min_order_amount
    ):
        missing = promotion.min_order_amount - subtotal
        return False, Decimal("0"), f"Cần mua thêm {_format_vnd(missing)}"

    if promotion.discount_type == DISCOUNT_PERCENTAGE:
        discount = subtotal * promotion.discount_value / Decimal("100")
        if promotion.max_discount_amount not in (None, 0):
            discount = min(discount, promotion.max_discount_amount)
    else:
        discount = promotion.discount_value
    discount = min(discount, subtotal).quantize(
        Decimal("0.01"),
        rounding=ROUND_HALF_UP,
    )
    if discount <= 0:
        return False, Decimal("0"), "Đơn hàng chưa phát sinh giá trị để giảm"
    return True, discount, "Đủ điều kiện áp dụng"


def serialize_promotion(
    promotion,
    subtotal=None,
    total_quantity=None,
    evaluation_date=None,
):
    result = {
        "id": promotion.id,
        "name": promotion.name,
        "condition_type": promotion.condition_type,
        "condition_summary": condition_summary(promotion),
        "min_quantity": promotion.min_quantity,
        "min_order_amount": (
            float(promotion.min_order_amount)
            if promotion.min_order_amount is not None
            else None
        ),
        "start_date": promotion.start_date.isoformat() if promotion.start_date else None,
        "end_date": promotion.end_date.isoformat() if promotion.end_date else None,
        "discount_type": promotion.discount_type,
        "discount_value": float(promotion.discount_value),
        "max_discount_amount": (
            float(promotion.max_discount_amount)
            if promotion.max_discount_amount is not None
            else None
        ),
        "benefit_summary": benefit_summary(promotion),
        "is_active": bool(promotion.is_active),
        "created_at": promotion.created_at.isoformat() if promotion.created_at else None,
        "updated_at": promotion.updated_at.isoformat() if promotion.updated_at else None,
    }
    if subtotal is not None and total_quantity is not None:
        eligible, discount, reason = evaluate_promotion(
            promotion,
            subtotal,
            total_quantity,
            evaluation_date=evaluation_date,
        )
        result.update(
            {
                "eligible": eligible,
                "calculated_discount": float(discount),
                "eligibility_reason": reason,
            }
        )
    return result


def list_promotions(include_inactive=False):
    query = Promotion.query
    if not include_inactive:
        query = query.filter(Promotion.is_active.is_(True))
    return query.order_by(Promotion.is_active.desc(), Promotion.id.desc()).all()


def create_promotion(data, employee_id):
    values = _normalize_payload(data)
    duplicate = Promotion.query.filter(
        func.lower(Promotion.name) == values["name"].lower()
    ).first()
    if duplicate:
        raise ValidationError("Tên khuyến mãi đã tồn tại")
    promotion = Promotion(**values, created_by=employee_id)
    db.session.add(promotion)
    db.session.commit()
    return promotion


def update_promotion(promotion_id, data):
    promotion = db.session.get(Promotion, promotion_id)
    if not promotion or not promotion.is_active:
        raise NotFoundError("Khuyến mãi không tồn tại")
    values = _normalize_payload(data, current=promotion)
    duplicate = Promotion.query.filter(
        func.lower(Promotion.name) == values["name"].lower(),
        Promotion.id != promotion.id,
    ).first()
    if duplicate:
        raise ValidationError("Tên khuyến mãi đã tồn tại")
    for field, value in values.items():
        setattr(promotion, field, value)
    db.session.commit()
    return promotion


def delete_promotion(promotion_id):
    promotion = db.session.get(Promotion, promotion_id)
    if not promotion or not promotion.is_active:
        raise NotFoundError("Khuyến mãi không tồn tại")
    promotion.is_active = False
    db.session.commit()


def get_promotion_for_invoice(
    promotion_id,
    subtotal,
    total_quantity,
    existing_promotion_id=None,
):
    try:
        promotion_id = int(promotion_id)
        if promotion_id <= 0:
            raise ValueError
    except (TypeError, ValueError):
        raise ValidationError("Mã khuyến mãi không hợp lệ")
    promotion = db.session.get(Promotion, promotion_id)
    if not promotion:
        raise NotFoundError("Khuyến mãi không tồn tại")
    is_existing = existing_promotion_id == promotion.id
    eligible, discount, reason = evaluate_promotion(
        promotion,
        subtotal,
        total_quantity,
        allow_inactive=is_existing,
        ignore_validity_period=is_existing,
    )
    if not eligible:
        raise ValidationError(f"Không thể áp dụng khuyến mãi: {reason}")
    return promotion, discount


def build_promotion_note(promotion, discount_amount):
    snapshot = serialize_promotion(promotion)
    snapshot["calculated_discount"] = float(discount_amount)
    payload = {"promotion": snapshot, "approval_notes": []}
    return PROMOTION_NOTE_PREFIX + json.dumps(payload, ensure_ascii=False, separators=(",", ":"))


def parse_promotion_note(note):
    if not note or not str(note).startswith(PROMOTION_NOTE_PREFIX):
        return None
    try:
        payload = json.loads(str(note)[len(PROMOTION_NOTE_PREFIX):])
    except (TypeError, ValueError, json.JSONDecodeError):
        return None
    return payload if isinstance(payload, dict) else None


def append_approval_note(note, label, message):
    payload = parse_promotion_note(note)
    if not payload:
        current = str(note or "").strip()
        addition = f"[{label}]: {message}" if message else f"[{label}]"
        return f"{current}\n{addition}".strip()
    payload.setdefault("approval_notes", []).append(
        {"label": label, "message": str(message or "").strip()}
    )
    return PROMOTION_NOTE_PREFIX + json.dumps(
        payload,
        ensure_ascii=False,
        separators=(",", ":"),
    )


def promotion_snapshot_from_note(note):
    payload = parse_promotion_note(note)
    promotion = payload.get("promotion") if payload else None
    return promotion if isinstance(promotion, dict) else None


def approval_notes_from_note(note):
    payload = parse_promotion_note(note)
    if payload:
        return payload.get("approval_notes", [])
    return []
