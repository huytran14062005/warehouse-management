import os
import secrets
from pathlib import Path
from urllib.parse import quote

from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


class Config:
    APP_ENV = os.getenv("APP_ENV", "development").strip().lower()
    IS_PRODUCTION = APP_ENV in {"production", "prod"} or any(
        os.getenv(name, "").strip().lower() == "production"
        for name in ("VERCEL_ENV", "VERCEL_TARGET_ENV")
    )
    DB_USER = os.getenv("DB_USER", "root")
    DB_PASSWORD = quote(os.getenv("DB_PASSWORD", ""))
    DB_HOST = os.getenv("DB_HOST", "localhost")
    DB_PORT = os.getenv("DB_PORT", "3306")
    DB_NAME = os.getenv("DB_NAME", "managewarehouse")
    DATABASE_URL = os.getenv("DATABASE_URL")

    # Schema changes should be applied deliberately in production instead of
    # making the first API request inspect every business table. Keep the
    # automatic path enabled for local development and opt into it explicitly
    # in production when a migration is actually required.
    AUTO_SCHEMA_MIGRATION = os.getenv(
        "AUTO_SCHEMA_MIGRATION",
        "false" if IS_PRODUCTION else "true",
    ).strip().lower() in {"1", "true", "yes", "on"}

    SQLALCHEMY_DATABASE_URI = DATABASE_URL or (
        f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}?charset=utf8mb4"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Vercel may reuse a warm Python process, so keep a very small pool alive
    # and validate idle connections before use. The limits are intentionally
    # conservative for Aiven's 1-GB Hobbyist node and serverless concurrency.
    _DB_DIALECT = SQLALCHEMY_DATABASE_URI.split(":", 1)[0].lower()
    SQLALCHEMY_ENGINE_OPTIONS = (
        {
            "pool_pre_ping": True,
            "pool_recycle": int(os.getenv("DB_POOL_RECYCLE_SECONDS", 1800)),
            "pool_size": int(os.getenv("DB_POOL_SIZE", 2)),
            "max_overflow": int(os.getenv("DB_MAX_OVERFLOW", 2)),
            "pool_timeout": int(os.getenv("DB_POOL_TIMEOUT_SECONDS", 10)),
        }
        if _DB_DIALECT.startswith(("mysql", "postgresql"))
        else {}
    )
    # Local development can use an ephemeral secret, but production must provide
    # explicit high-entropy values (validated in web.__init__).
    SECRET_KEY = os.getenv("SECRET_KEY") or secrets.token_urlsafe(48)
    JWT_SECRET = os.getenv("JWT_SECRET") or secrets.token_urlsafe(48)
    JWT_ACCESS_TOKEN_EXPIRES_SECONDS = int(os.getenv("JWT_ACCESS_TOKEN_EXPIRES_SECONDS", 900))
    JWT_REFRESH_TOKEN_EXPIRES_DAYS = int(os.getenv("JWT_REFRESH_TOKEN_EXPIRES_DAYS", 7))
    REFRESH_COOKIE_NAME = os.getenv("REFRESH_COOKIE_NAME", "refresh_token")
    # The frontend is deployed on GitHub Pages while the API is deployed on
    # Vercel. In production this is a cross-site XHR, so the refresh cookie
    # must be sent with SameSite=None and Secure. Keep local development easy
    # by retaining the normal Lax/non-secure defaults there.
    REFRESH_COOKIE_SECURE = os.getenv(
        "REFRESH_COOKIE_SECURE",
        "true" if IS_PRODUCTION else "false",
    ).lower() == "true"
    REFRESH_COOKIE_SAMESITE = os.getenv(
        "REFRESH_COOKIE_SAMESITE",
        "None" if IS_PRODUCTION else "Lax",
    )
    MAIL_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
    MAIL_PORT = int(os.getenv("SMTP_PORT", 587))
    MAIL_USERNAME = os.getenv("SMTP_USER", "")
    MAIL_PASSWORD = os.getenv("SMTP_PASSWORD", "").replace(" ", "")
    MAIL_USE_TLS = MAIL_PORT == 587
    MAIL_USE_SSL = MAIL_PORT == 465
    MAIL_DEFAULT_SENDER = (
        os.getenv("MAIL_SENDER_NAME", "Warehouse Management"),
        os.getenv("MAIL_SENDER", os.getenv("SMTP_USER", "")),
    )
    COMPANY_NAME = os.getenv(
        "COMPANY_NAME",
        "Công ty TNHH Sản xuất và Thương mại Dịch vụ Hiệp Phát",
    )
    COMPANY_ADDRESS = os.getenv("COMPANY_ADDRESS", "")
    COMPANY_PHONE = os.getenv("COMPANY_PHONE", "")
    COMPANY_EMAIL = os.getenv("COMPANY_EMAIL", os.getenv("SMTP_USER", ""))
    OVERDUE_REPORT_RECIPIENTS = tuple(
        email.strip()
        for email in os.getenv("OVERDUE_REPORT_RECIPIENTS", "").split(",")
        if email.strip()
    )
    CRON_SECRET = os.getenv("CRON_SECRET", "").strip()
    REPORT_LOGO_PATH = os.getenv("REPORT_LOGO_PATH", "")
    REPORT_FONT_PATH = os.getenv("REPORT_FONT_PATH", "")
    REPORT_MAX_ITEMS = int(os.getenv("REPORT_MAX_ITEMS", 5000))
    APPLICATION_SIZE = int(os.getenv("APPLICATION_SIZE", 10))
    MAX_PAGE_SIZE = int(os.getenv("MAX_PAGE_SIZE", 100))
    MAX_ITEMS_PER_DOCUMENT = int(os.getenv("MAX_ITEMS_PER_DOCUMENT", 100))
    MAX_CONTENT_LENGTH = int(os.getenv("MAX_CONTENT_LENGTH", 2 * 1024 * 1024))
    FRONTEND_ORIGINS = [
        origin.strip()
        for origin in os.getenv(
            "FRONTEND_ORIGINS",
            "http://localhost:3000,http://127.0.0.1:3000",
        ).split(",")
        if origin.strip()
    ]

