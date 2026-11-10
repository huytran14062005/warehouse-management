import os

from flask import Flask, request
from flask_cors import CORS
from flask_mail import Mail
from flask_sqlalchemy import SQLAlchemy

from web.config import Config
import web.utils.query_cache  # Register cache invalidation on successful commits.


app = Flask(__name__)
app.config.from_object(Config)


def _validate_security_config():
    if not Config.IS_PRODUCTION:
        return

    for name in ("SECRET_KEY", "JWT_SECRET"):
        value = os.getenv(name, "")
        if not value or len(value) < 32:
            raise RuntimeError(f"{name} must be explicitly configured with at least 32 characters in production")

    if app.config.get("SECRET_KEY") == app.config.get("JWT_SECRET"):
        raise RuntimeError("SECRET_KEY and JWT_SECRET must be different in production")

    if not app.config.get("REFRESH_COOKIE_SECURE"):
        raise RuntimeError("REFRESH_COOKIE_SECURE must be true in production")

    if str(app.config.get("REFRESH_COOKIE_SAMESITE", "")).lower() not in {"lax", "strict", "none"}:
        raise RuntimeError("REFRESH_COOKIE_SAMESITE must be Lax, Strict, or None")

    origins = app.config.get("FRONTEND_ORIGINS", [])
    if not origins or any(not origin.lower().startswith("https://") for origin in origins):
        raise RuntimeError("Production frontend origins must use HTTPS")


_validate_security_config()

CORS(app, supports_credentials=True, resources={
    r"/api/*": {
        "origins": Config.FRONTEND_ORIGINS,
        "methods": ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"],
    }
})

db = SQLAlchemy(app=app)
mail = Mail(app)


_business_schema_ready = False


@app.before_request
def ensure_business_columns():
    """Bring existing databases up to the columns used by current business flows."""
    global _business_schema_ready
    if _business_schema_ready or not request.path.startswith("/api/"):
        return
    from sqlalchemy import BigInteger, inspect
    from web.models import ImportInvoice, OperatingExpense, PricingCycle, PricingPolicy, SalesInvoice, SalesInvoiceItem

    inspector = inspect(db.engine)
    columns = (
        (SalesInvoiceItem.__tablename__, "combo_id", "INT NULL"),
        (ImportInvoice.__tablename__, "inbound_fee", "DECIMAL(14, 2) NOT NULL DEFAULT 0"),
        (PricingPolicy.__tablename__, "desired_profit_per_unit", "DECIMAL(14, 2) NULL"),
        (OperatingExpense.__tablename__, "is_abnormal", "BOOLEAN NOT NULL DEFAULT 0"),
        (SalesInvoice.__tablename__, "return_pending", "BOOLEAN NOT NULL DEFAULT 0"),
    )
    if any(not inspector.has_table(table) for table, _, _ in columns):
        return
    changed = False
    for table, column, definition in columns:
        if column in {entry["name"] for entry in inspector.get_columns(table)}:
            continue
        try:
            with db.engine.begin() as connection:
                connection.exec_driver_sql(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")
        except Exception:
            # Another cold instance may have added the column concurrently.
            if column not in {entry["name"] for entry in inspect(db.engine).get_columns(table)}:
                raise
        changed = True
    dialect = db.engine.dialect.name
    if dialect in {"mysql", "postgresql"}:
        planned_type = next(
            entry["type"] for entry in inspect(db.engine).get_columns(PricingPolicy.__tablename__)
            if entry["name"] == "planned_quantity"
        )
        if not isinstance(planned_type, BigInteger):
            statement = (
                "ALTER TABLE pricing_policies MODIFY COLUMN planned_quantity BIGINT NOT NULL DEFAULT 100"
                if dialect == "mysql" else
                "ALTER TABLE pricing_policies ALTER COLUMN planned_quantity TYPE BIGINT"
            )
            try:
                with db.engine.begin() as connection:
                    connection.exec_driver_sql(statement)
            except Exception:
                current_type = next(
                    entry["type"] for entry in inspect(db.engine).get_columns(PricingPolicy.__tablename__)
                    if entry["name"] == "planned_quantity"
                )
                if not isinstance(current_type, BigInteger):
                    raise
            changed = True
    try:
        PricingCycle.__table__.create(bind=db.engine, checkfirst=True)
    except Exception:
        if not inspect(db.engine).has_table(PricingCycle.__tablename__):
            raise
    if "planned_salary_amount" not in {entry["name"] for entry in inspect(db.engine).get_columns(PricingCycle.__tablename__)}:
        try:
            with db.engine.begin() as connection:
                connection.exec_driver_sql(
                    "ALTER TABLE pricing_cycles ADD COLUMN planned_salary_amount DECIMAL(14, 2) NULL"
                )
        except Exception:
            if "planned_salary_amount" not in {entry["name"] for entry in inspect(db.engine).get_columns(PricingCycle.__tablename__)}:
                raise
        changed = True
    if changed:
        db.session.remove()
    _business_schema_ready = True


@app.after_request
def add_security_headers(response):
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    # API responses contain inventory, customer and financial data. Prevent
    # browsers and reverse proxies from retaining that data after logout.
    if request.path.startswith("/api/"):
        response.headers.setdefault("Cache-Control", "no-store")
    if Config.IS_PRODUCTION:
        response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
    return response

from web.blueprints import (
    auth_bp,
    customers_bp,
    customer_purchases_bp,
    damage_reports_bp,
    import_invoices_bp,
    products_bp,
    reports_bp,
    sales_invoices_bp,
    stock_transfers_bp,
    suppliers_bp,
    sales_areas_bp,
    employee_accounts_bp,
    promotions_bp,
    company_funds_bp,
    pricing_bp,
)

app.register_blueprint(auth_bp)
app.register_blueprint(customers_bp)
app.register_blueprint(customer_purchases_bp)
app.register_blueprint(damage_reports_bp)
app.register_blueprint(import_invoices_bp)
app.register_blueprint(products_bp)
app.register_blueprint(reports_bp)
app.register_blueprint(sales_invoices_bp)
app.register_blueprint(stock_transfers_bp)
app.register_blueprint(suppliers_bp)
app.register_blueprint(sales_areas_bp)
app.register_blueprint(employee_accounts_bp)
app.register_blueprint(promotions_bp)
app.register_blueprint(company_funds_bp)
app.register_blueprint(pricing_bp)

from web.realtime import init_realtime
init_realtime(app)
