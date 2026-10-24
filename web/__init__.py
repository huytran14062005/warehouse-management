from flask import Flask, request
from flask_cors import CORS
from flask_mail import Mail
from flask_sqlalchemy import SQLAlchemy

from web.config import Config


app = Flask(__name__)
app.config.from_object(Config)


def _validate_security_config():
    if not Config.IS_PRODUCTION:
        return

    for name in ("SECRET_KEY", "JWT_SECRET"):
        value = app.config.get(name, "")
        if not value or len(value) < 32:
            raise RuntimeError(f"{name} must be configured with at least 32 characters in production")

    if app.config.get("SECRET_KEY") == app.config.get("JWT_SECRET"):
        raise RuntimeError("SECRET_KEY and JWT_SECRET must be different in production")

    if not app.config.get("REFRESH_COOKIE_SECURE"):
        raise RuntimeError("REFRESH_COOKIE_SECURE must be true in production")

    if str(app.config.get("REFRESH_COOKIE_SAMESITE", "")).lower() not in {"lax", "strict", "none"}:
        raise RuntimeError("REFRESH_COOKIE_SAMESITE must be Lax, Strict, or None")

    if any(not origin.lower().startswith("https://") for origin in app.config.get("FRONTEND_ORIGINS", [])):
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
