"""Manage reusable product sets suggested while preparing a sales invoice."""

from sqlalchemy import func, inspect
from sqlalchemy.orm import selectinload

from web import db
from web.models import Product, ProductCombo, ProductComboItem
from web.services.exceptions import NotFoundError, ValidationError


def _tables_exist():
    inspector = inspect(db.engine)
    return inspector.has_table(ProductCombo.__tablename__) and inspector.has_table(ProductComboItem.__tablename__)


def _ensure_tables():
    ProductCombo.__table__.create(bind=db.engine, checkfirst=True)
    ProductComboItem.__table__.create(bind=db.engine, checkfirst=True)
    # Creating MySQL tables ends the authentication query's transaction.
    db.session.remove()


def _serialize(combo):
    return {
        "id": combo.id,
        "name": combo.name,
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

    existing_ids = {
        product.id for product in Product.query.filter(Product.id.in_(product_ids)).all()
    }
    if existing_ids != product_ids:
        raise ValidationError("Có sản phẩm trong combo không còn tồn tại")
    return clean_name, clean_items


def save_product_combo_service(combo_id, name, items):
    _ensure_tables()
    clean_name, clean_items = _validated_payload(name, items)
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
        combo = ProductCombo(name=clean_name)
        db.session.add(combo)
    else:
        combo.name = clean_name
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
    if not _tables_exist():
        raise NotFoundError("Combo không tồn tại")
    combo = db.session.get(ProductCombo, combo_id)
    if combo is None:
        raise NotFoundError("Combo không tồn tại")
    db.session.delete(combo)
    db.session.commit()
