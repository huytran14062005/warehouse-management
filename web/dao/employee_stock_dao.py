from sqlalchemy import func
from web import db
from web.models import EmployeeStock, Product


def get_employee_stock_rows(employee_id, product_ids=None, for_update=False):
    query = (
        db.session.query(EmployeeStock, Product)
        .join(Product, Product.id == EmployeeStock.product_id)
        .filter(EmployeeStock.employee_id == employee_id)
        .order_by(Product.name.asc())
    )
    if product_ids:
        query = query.filter(EmployeeStock.product_id.in_(product_ids))
    if for_update:
        query = query.with_for_update()
    return query.all()


def get_employee_stock_map(employee_id, product_ids=None, for_update=False):
    rows = get_employee_stock_rows(
        employee_id=employee_id,
        product_ids=product_ids,
        for_update=for_update,
    )
    return {product.id: stock for stock, product in rows}


def get_employee_stock_list(employee_id, page=1, per_page=10):
    query = (
        db.session.query(EmployeeStock, Product)
        .join(Product, Product.id == EmployeeStock.product_id)
        .filter(EmployeeStock.employee_id == employee_id, EmployeeStock.quantity > 0)
        .order_by(Product.name.asc())
    )
    total = query.order_by(None).count()
    total_quantity = (
        db.session.query(func.coalesce(func.sum(EmployeeStock.quantity), 0))
        .filter(EmployeeStock.employee_id == employee_id, EmployeeStock.quantity > 0)
        .scalar()
    )
    rows = query.offset((page - 1) * per_page).limit(per_page).all()
    return [
        {"product": product, "quantity": int(stock.quantity)}
        for stock, product in rows
    ], total, int(total_quantity or 0)


def get_or_create_employee_stock(employee_id, product_id):
    stock = (
        EmployeeStock.query
        .filter(
            EmployeeStock.employee_id == employee_id,
            EmployeeStock.product_id == product_id,
        )
        .with_for_update()
        .first()
    )
    if stock:
        return stock

    stock = EmployeeStock(
        employee_id=employee_id,
        product_id=product_id,
        quantity=0,
    )
    db.session.add(stock)
    db.session.flush()
    return stock
