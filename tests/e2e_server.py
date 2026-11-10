"""Start a real Flask API against a new, isolated local E2E database.

This entry point intentionally refuses existing databases and non-local targets.
It is used only by Playwright, never imported by the application runtime.
"""

import json
import os
import re
import secrets
import sys
from datetime import date, timedelta
from decimal import Decimal
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "tests" / ".e2e-data"
RUN_ID = os.getenv("E2E_RUN_ID", "")

if os.getenv("E2E_ALLOW_WRITES") != "1" or os.getenv("E2E_TARGET") != "local":
    raise SystemExit("E2E requires E2E_ALLOW_WRITES=1 and E2E_TARGET=local")
if os.getenv("APP_ENV") != "test" or not re.fullmatch(r"[a-f0-9]{16,40}", RUN_ID):
    raise SystemExit("E2E requires APP_ENV=test and a generated E2E_RUN_ID")
if os.getenv("DATABASE_URL") or any(os.getenv(key) for key in ("DB_HOST", "DB_NAME")):
    raise SystemExit("Remove DATABASE_URL, DB_HOST and DB_NAME before local E2E")

DATA_DIR.mkdir(exist_ok=True)
database_path = DATA_DIR / f"{RUN_ID}.sqlite"
manifest_path = DATA_DIR / f"{RUN_ID}.json"
if database_path.exists() or manifest_path.exists():
    raise SystemExit("E2E run ID already exists; refusing to reuse its database")
database_path.touch(exist_ok=False)
os.environ["DATABASE_URL"] = f"sqlite:///{database_path.as_posix()}"
os.environ["FRONTEND_ORIGINS"] = "http://127.0.0.1:3107,http://localhost:3107"
os.environ["JWT_ACCESS_TOKEN_EXPIRES_SECONDS"] = "3600"
sys.path.insert(0, str(ROOT))

from web import app, db  # noqa: E402
from web.models import (  # noqa: E402
    CompanyFund, Customer, Employee, EmployeeRole, ImportInvoice,
    ImportInvoiceItem, Product, ProductCombo, ProductComboItem, Promotion,
    SalesArea, Supplier, Warehouse,
)
from web.utils.password_hasher import hash_password  # noqa: E402
from web.services.token_service import create_access_token  # noqa: E402


def seed():
    password = secrets.token_urlsafe(18)
    with app.app_context():
        db.create_all()
        central = Warehouse(name="Kho trung tâm", address=f"E2E {RUN_ID}")
        secondary = Warehouse(name=f"Kho phụ E2E {RUN_ID[:8]}", address="E2E")
        db.session.add_all([central, secondary])
        db.session.flush()

        role_map = {
            "manager": EmployeeRole.QUAN_LY,
            "accountant": EmployeeRole.KE_TOAN,
            "keeper": EmployeeRole.THU_KHO,
            "keeper2": EmployeeRole.THU_KHO,
            "seller": EmployeeRole.NHAN_VIEN_BAN_HANG,
            "courier": EmployeeRole.NHAN_VIEN_GIAO_HANG,
            "pending": EmployeeRole.NHAN_VIEN_BAN_HANG,
            "locked": EmployeeRole.NHAN_VIEN_BAN_HANG,
        }
        employees = {}
        password_hash = hash_password(password)
        for index, (key, role) in enumerate(role_map.items(), start=1):
            employee = Employee(
                full_name=f"E2E {key} {RUN_ID[:8]}",
                phone=f"09{int(RUN_ID[:8], 16) % 10000000:07d}{index}",
                username=f"e2e_{key}_{RUN_ID[:8]}",
                email=f"e2e_{key}_{RUN_ID[:8]}@example.test",
                password_hash=password_hash,
                role=role,
                is_approved=key != "pending",
                is_locked=key == "locked",
                warehouse_id=central.id,
            )
            db.session.add(employee)
            employees[key] = employee
        db.session.flush()

        areas = [
            SalesArea(code=f"E2EA{RUN_ID[:8]}", name=f"Khu A E2E {RUN_ID[:8]}"),
            SalesArea(code=f"E2EB{RUN_ID[:8]}", name=f"Khu B E2E {RUN_ID[:8]}"),
        ]
        supplier = Supplier(name=f"Nhà cung cấp E2E {RUN_ID[:8]}", address="E2E")
        customers = [
            Customer(full_name=f"Khách mới E2E {RUN_ID[:8]}", phone="0900000001",
                     address="E2E", sales_area_id=None, debt_amount=0),
            Customer(full_name=f"Khách nợ E2E {RUN_ID[:8]}", phone="0900000002",
                     address="E2E", sales_area_id=None, debt_amount=Decimal("2000")),
        ]
        products = [
            Product(name=f"Bánh E2E {RUN_ID[:8]}", unit="Hộp", default_sale_price=10000),
            Product(name=f"Nước E2E {RUN_ID[:8]}", unit="Chai", default_sale_price=5000),
            Product(name=f"Hàng mới E2E {RUN_ID[:8]}", unit="Cái", default_sale_price=2000),
        ]
        db.session.add_all([*areas, supplier, *customers, *products])
        db.session.flush()
        customers[0].sales_area_id = areas[0].id
        customers[1].sales_area_id = areas[1].id

        combo = ProductCombo(name=f"Combo E2E {RUN_ID[:8]}", sale_price=14000)
        db.session.add(combo)
        db.session.flush()
        db.session.add_all([
            ProductComboItem(combo_id=combo.id, product_id=products[0].id, quantity=1),
            ProductComboItem(combo_id=combo.id, product_id=products[1].id, quantity=1),
        ])
        imported = ImportInvoice(
            warehouse_id=central.id, supplier_id=supplier.id,
            employee_id=employees["keeper"].id, inbound_fee=Decimal("1000"),
            note=f"E2E fixture {RUN_ID}",
        )
        db.session.add(imported)
        db.session.flush()
        db.session.add_all([
            ImportInvoiceItem(import_invoice_id=imported.id, product_id=products[0].id,
                              quantity=30, unit_price=Decimal("5000"), line_total=Decimal("150000")),
            ImportInvoiceItem(import_invoice_id=imported.id, product_id=products[1].id,
                              quantity=30, unit_price=Decimal("2000"), line_total=Decimal("60000")),
        ])
        for method in ("cash", "bank_transfer"):
            db.session.add(CompanyFund(
                method=method, opening_balance=Decimal("1000000"),
                balance=Decimal("1000000"), opened_by_id=employees["manager"].id,
            ))
        today = date.today()
        promotions = [
            Promotion(name=f"Giảm E2E {RUN_ID[:8]}", condition_type="min_quantity",
                      min_quantity=2, discount_type="fixed_amount", discount_value=1000,
                      max_discount_amount=1000, start_date=today - timedelta(days=1),
                      end_date=today + timedelta(days=1), created_by=employees["manager"].id),
            Promotion(name=f"Hết hạn E2E {RUN_ID[:8]}", condition_type="min_quantity",
                      min_quantity=2, discount_type="fixed_amount", discount_value=1000,
                      start_date=today - timedelta(days=4), end_date=today - timedelta(days=1),
                      created_by=employees["manager"].id),
        ]
        db.session.add_all(promotions)
        db.session.commit()

        manifest = {
            "run_id": RUN_ID,
            "password": password,
            "users": {key: {"id": employee.id, "username": employee.username,
                            "name": employee.full_name, "phone": employee.phone,
                            "role": employee.role.value,
                            "token": create_access_token(employee)}
                      for key, employee in employees.items()},
            "warehouses": {"central": central.id, "secondary": secondary.id},
            "areas": [area.id for area in areas],
            "supplier": {"id": supplier.id, "name": supplier.name},
            "customers": {"new": customers[0].id, "old_debt": customers[1].id},
            "products": {"biscuit": products[0].id, "water": products[1].id,
                         "new": products[2].id},
            "names": {"biscuit": products[0].name, "water": products[1].name,
                      "new": products[2].name, "combo": combo.name,
                      "customer": customers[0].full_name},
            "combo": combo.id,
            "promotions": {"active": promotions[0].id, "expired": promotions[1].id},
        }
        manifest_path.write_text(json.dumps(manifest, ensure_ascii=False), encoding="utf-8")
        try:
            manifest_path.chmod(0o600)
        except OSError:
            pass


if __name__ == "__main__":
    seed()
    from web.realtime import socketio

    socketio.run(app, host="127.0.0.1", port=5107, debug=False,
                 use_reloader=False, allow_unsafe_werkzeug=True)
