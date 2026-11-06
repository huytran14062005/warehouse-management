"""Manage reusable product sets suggested while preparing a sales invoice."""

from decimal import Decimal, ROUND_CEILING, ROUND_FLOOR

from sqlalchemy import func, inspect
from sqlalchemy.orm import selectinload

from web import db
from web.models import Product, ProductCombo, ProductComboItem
from web.services.exceptions import NotFoundError, ValidationError
from web.services.validators import MIN_MONEY_AMOUNT, validate_money_amount


SALE_PRICE_TOLERANCE = Decimal("0.10")
_combo_schema_ready = False


def _tables_exist():
    inspector = inspect(db.engine)
    return inspector.has_table(ProductCombo.__tablename__) and inspector.has_table(ProductComboItem.__tablename__)


def _ensure_tables():
    global _combo_schema_ready
    if _combo_schema_ready:
        return
    ProductCombo.__table__.create(bind=db.engine, checkfirst=True)
    ProductComboItem.__table__.create(bind=db.engine, checkfirst=True)
    inspector = inspect(db.engine)
    combo_columns = {column["name"] for column in inspector.get_columns(ProductCombo.__tablename__)}
    if "sale_price" not in combo_columns:
        with db.engine.begin() as connection:
            connection.exec_driver_sql(
                "ALTER TABLE `product_combos` ADD COLUMN `sale_price` DECIMAL(14, 2) NULL"
            )
    # Creating MySQL tables ends the authentication query's transaction.
    db.session.remove()
    _combo_schema_ready = True


def _unit_price_bounds(default_price):
    base = Decimal(str(default_price or 0))
    if base < MIN_MONEY_AMOUNT:
        return None
    return (
        max(
            MIN_MONEY_AMOUNT,
            (base * (1 - SALE_PRICE_TOLERANCE)).to_integral_value(rounding=ROUND_CEILING),
        ),
        (base * (1 + SALE_PRICE_TOLERANCE)).to_integral_value(rounding=ROUND_FLOOR),
    )


def _price_bounds(calculated_price, items=None, products_by_id=None):
    if items is not None and products_by_id is not None:
        unit_bounds = [
            _unit_price_bounds(products_by_id[item["product_id"]].default_sale_price)
            for item in items
        ]
        if any(bounds is None for bounds in unit_bounds):
            return None
        return (
            sum((bounds[0] * item["quantity"] for bounds, item in zip(unit_bounds, items)), Decimal("0")),
            sum((bounds[1] * item["quantity"] for bounds, item in zip(unit_bounds, items)), Decimal("0")),
        )
    base = Decimal(str(calculated_price or 0))
    if base < MIN_MONEY_AMOUNT:
        return None
    return _unit_price_bounds(base)


def _calculate_price(items, products_by_id):
    return sum(
        (
            Decimal(str(products_by_id[item["product_id"]].default_sale_price or 0))
            * item["quantity"]
            for item in items
        ),
        Decimal("0"),
    )


def _validate_sale_price(value, calculated_price, items, products_by_id):
    bounds = _price_bounds(calculated_price, items, products_by_id)
    if bounds is None:
        raise ValidationError("Tổng giá bán mặc định của combo phải từ 500 đồng")
    sale_price = validate_money_amount(value, "Giá combo", allow_zero=False)
    minimum, maximum = bounds
    if not minimum <= sale_price <= maximum:
        raise ValidationError(
            f"Giá combo phải từ {minimum:,.0f} đến {maximum:,.0f} đồng (±10% giá hệ thống)"
        )
    return sale_price


def _serialize(combo):
    calculated_price = _calculate_price(
        [{"product_id": item.product_id, "quantity": item.quantity} for item in combo.items],
        {item.product_id: item.product for item in combo.items},
    )
    combo_items = [{"product_id": item.product_id, "quantity": item.quantity} for item in combo.items]
    products_by_id = {item.product_id: item.product for item in combo.items}
    bounds = _price_bounds(calculated_price, combo_items, products_by_id)
    sale_price = Decimal(str(combo.sale_price)) if combo.sale_price is not None else calculated_price
    return {
        "id": combo.id,
        "name": combo.name,
        "calculated_price": float(calculated_price),
        "sale_price": float(sale_price),
        "price_min": float(bounds[0]) if bounds else None,
        "price_max": float(bounds[1]) if bounds else None,
        "items": [
            {
                "product_id": item.product_id,
                "product_name": item.product.name,
                "unit": item.product.unit,
                "default_sale_price": float(item.product.default_sale_price or 0),
                "quantity": item.quantity,
            }
            for item in combo.items
        ],
    }


def get_product_combos_service():
    _ensure_tables()
    if not _tables_exist():
        return []
    combos = (
        ProductCombo.query
        .options(selectinload(ProductCombo.items).selectinload(ProductComboItem.product))
        .order_by(ProductCombo.name.asc())
        .all()
    )
    return [_serialize(combo) for combo in combos]


def get_product_combo_catalog_service():
    return [
        {
            "id": product.id,
            "name": product.name,
            "unit": product.unit,
            "default_sale_price": float(product.default_sale_price or 0),
        }
        for product in Product.query.order_by(Product.name.asc()).all()
    ]


def _validated_payload(name, items):
    clean_name = str(name or "").strip()
    if not clean_name or len(clean_name) > 150:
        raise ValidationError("Tên combo phải có từ 1 đến 150 ký tự")
    if not isinstance(items, list) or not 2 <= len(items) <= 20:
        raise ValidationError("Combo cần từ 2 đến 20 sản phẩm")

    clean_items = []
    product_ids = set()
    for item in items:
        if not isinstance(item, dict):
            raise ValidationError("Sản phẩm trong combo không hợp lệ")
        try:
            product_id = int(item.get("product_id"))
            quantity = int(item.get("quantity"))
        except (TypeError, ValueError):
            raise ValidationError("Cần chọn sản phẩm và nhập số lượng nguyên dương")
        if isinstance(item.get("quantity"), bool) or product_id <= 0 or quantity <= 0 or quantity > 100000:
            raise ValidationError("Số lượng mỗi sản phẩm phải là số nguyên từ 1 đến 100.000")
        if product_id in product_ids:
            raise ValidationError("Mỗi sản phẩm chỉ được xuất hiện một lần trong combo")
        product_ids.add(product_id)
        clean_items.append({"product_id": product_id, "quantity": quantity})

    products_by_id = {
        product.id: product
        for product in Product.query.filter(Product.id.in_(product_ids)).all()
    }
    if set(products_by_id) != product_ids:
        raise ValidationError("Có sản phẩm trong combo không còn tồn tại")
    return clean_name, clean_items, products_by_id


def save_product_combo_service(combo_id, name, items, sale_price=None):
    _ensure_tables()
    clean_name, clean_items, products_by_id = _validated_payload(name, items)
    calculated_price = _calculate_price(clean_items, products_by_id)
    normalized_sale_price = _validate_sale_price(
        calculated_price if sale_price in (None, "") else sale_price,
        calculated_price,
        clean_items,
        products_by_id,
    )
    combo = db.session.get(ProductCombo, combo_id) if combo_id is not None else None
    if combo_id is not None and combo is None:
        raise NotFoundError("Combo không tồn tại")
    duplicate = ProductCombo.query.filter(
        func.lower(ProductCombo.name) == clean_name.lower(),
        ProductCombo.id != (combo_id or 0),
    ).first()
    if duplicate:
        raise ValidationError("Tên combo đã được sử dụng")

    if combo is None:
        combo = ProductCombo(name=clean_name, sale_price=normalized_sale_price)
        db.session.add(combo)
    else:
        combo.name = clean_name
        combo.sale_price = normalized_sale_price
    existing = {item.product_id: item for item in combo.items}
    selected_ids = {item["product_id"] for item in clean_items}
    for item in list(combo.items):
        if item.product_id not in selected_ids:
            combo.items.remove(item)
    for item in clean_items:
        current = existing.get(item["product_id"])
        if current is not None:
            current.quantity = item["quantity"]
        else:
            combo.items.append(ProductComboItem(**item))
    db.session.commit()
    return _serialize(combo)


def delete_product_combo_service(combo_id):
    _ensure_tables()
    if not _tables_exist():
        raise NotFoundError("Combo không tồn tại")
    combo = db.session.get(ProductCombo, combo_id)
    if combo is None:
        raise NotFoundError("Combo không tồn tại")
    db.session.delete(combo)
    db.session.commit()
