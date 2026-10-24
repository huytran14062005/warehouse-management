from .auth_bp import auth_bp
from .customers_bp import customers_bp
from .customer_purchases_bp import customer_purchases_bp
from .damage_reports_bp import damage_reports_bp
from .import_invoices_bp import import_invoices_bp
from .products_bp import products_bp
from .reports_bp import reports_bp
from .sales_invoices_bp import sales_invoices_bp
from .stock_transfers_bp import stock_transfers_bp
from .suppliers_bp import suppliers_bp
from .sales_areas_bp import sales_areas_bp
from .employee_accounts_bp import employee_accounts_bp
from .promotions_bp import promotions_bp

__all__ = [
    "auth_bp",
    "customers_bp",
    "customer_purchases_bp",
    "damage_reports_bp",
    "import_invoices_bp",
    "products_bp",
    "reports_bp",
    "sales_invoices_bp",
    "stock_transfers_bp",
    "suppliers_bp",
    "sales_areas_bp",
    "employee_accounts_bp",
    "promotions_bp",
]
