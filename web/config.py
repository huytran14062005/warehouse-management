import os
import secrets
from pathlib import Path
from urllib.parse import quote

from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


class Config:
    APP_ENV = os.getenv("APP_ENV", "development").strip().lower()
    IS_PRODUCTION = APP_ENV in {"production", "prod"}
    DB_USER = os.getenv("DB_USER", "root")
    DB_PASSWORD = quote(os.getenv("DB_PASSWORD", ""))
    DB_HOST = os.getenv("DB_HOST", "localhost")
    DB_PORT = os.getenv("DB_PORT", "3306")
    DB_NAME = os.getenv("DB_NAME", "managewarehouse")
    DATABASE_URL = os.getenv("DATABASE_URL")

    SQLALCHEMY_DATABASE_URI = DATABASE_URL or (
        f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}?charset=utf8mb4"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    # Local development can use an ephemeral secret, but production must provide
    # explicit high-entropy values (validated in web.__init__).
    SECRET_KEY = os.getenv("SECRET_KEY") or secrets.token_urlsafe(48)
    JWT_SECRET = os.getenv("JWT_SECRET") or secrets.token_urlsafe(48)
    JWT_ACCESS_TOKEN_EXPIRES_SECONDS = int(os.getenv("JWT_ACCESS_TOKEN_EXPIRES_SECONDS", 900))
    JWT_REFRESH_TOKEN_EXPIRES_DAYS = int(os.getenv("JWT_REFRESH_TOKEN_EXPIRES_DAYS", 7))
    REFRESH_COOKIE_NAME = os.getenv("REFRESH_COOKIE_NAME", "refresh_token")
    REFRESH_COOKIE_SECURE = os.getenv("REFRESH_COOKIE_SECURE", "false").lower() == "true"
    REFRESH_COOKIE_SAMESITE = os.getenv("REFRESH_COOKIE_SAMESITE", "Lax")
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

