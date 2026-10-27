from datetime import datetime
from enum import Enum as UserEnum

from sqlalchemy import Boolean, CheckConstraint, Column, Date, DateTime, Enum, ForeignKey, Index, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from web import db


class EmployeeRole(UserEnum):
    KE_TOAN = "kế toán"
    NHAN_VIEN_BAN_HANG = "nhân viên bán hàng"
    THU_KHO = "thủ kho"
    QUAN_LY = "quản lý"


class ProductRequestStatus(UserEnum):
    PENDING = "pending"
    COMPLETED = "completed"
    REJECTED = "rejected"

class InvoiceStatus(UserEnum):
    DRAFT = "nháp"
    PROCESSING = "đang xử lý"
    DELIVERING = "đang giao"
    COMPLETED = "hoàn thành"
    CANCELLED = "đã hủy"

class DiscountStatus(UserEnum):
    NO_DISCOUNT = "không giảm giá"
    AUTO_APPROVED = "tự động duyệt"
    PENDING_APPROVAL = "chờ duyệt"
    APPROVED = "đã duyệt"
    REJECTED = "từ chối"

class SaleSource(UserEnum):
    CENTRAL_WAREHOUSE = "kho trung tâm"
    EMPLOYEE_STOCK = "hàng nhân viên"

class PaymentStatus(UserEnum):
    UNPAID = "chưa thanh toán"
    PARTIAL = "thanh toán một phần"
    PAID = "đã thanh toán"

class PaymentType(UserEnum):
    INVOICE = "thanh toán đơn hàng"
    OLD_DEBT = "trả nợ cũ"


class PaymentMethod(UserEnum):
    CASH = "cash"
    BANK_TRANSFER = "bank_transfer"


class DamageReportStatus(UserEnum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class BaseModel(db.Model):
    __abstract__ = True
    id = Column(Integer, primary_key=True, autoincrement=True)


class Product(BaseModel):
    __tablename__ = "products"
    __table_args__ = (CheckConstraint("default_sale_price >= 0", name="ck_product_price"),)

    name = Column(String(255), nullable=False, unique=True)
    unit = Column(String(50), nullable=False)
    default_sale_price = Column(Numeric(14, 2), nullable=False, default=0)

    import_invoice_items = relationship("ImportInvoiceItem", backref="product", lazy=True)
    sales_invoice_items = relationship("SalesInvoiceItem", backref="product", lazy=True)


class Warehouse(BaseModel):
    __tablename__ = "warehouses"
    __table_args__ = (UniqueConstraint("name", "address", name="uq_warehouse_address"),)

    name = Column(String(150), nullable=False)
    address = Column(String(255), nullable=False)

    import_invoices = relationship("ImportInvoice", backref="warehouse", lazy=True)
    sales_invoices = relationship("SalesInvoice", backref="warehouse", lazy=True)


class Supplier(BaseModel):
    __tablename__ = "suppliers"

    name = Column(String(255), nullable=False)
    address = Column(Text, nullable=False)

    import_invoices = relationship("ImportInvoice", backref="supplier", lazy=True)
    supplier_payments = relationship("SupplierPayment", backref="supplier", lazy=True)


class Employee(BaseModel):
    __tablename__ = "employees"

    full_name = Column(String(150), nullable=False)
    phone = Column(String(20), nullable=False, unique=True, index=True)
    username = Column(String(50), nullable=False, unique=True, index=True)
    email = Column(String(120), nullable=False, unique=True, index=True)
    password_hash = Column(String(200), nullable=False)
    role = Column(Enum(EmployeeRole), nullable=False)
    is_locked = Column(Boolean, nullable=False, default=False)
    is_approved = Column(Boolean, nullable=False, default=False, index=True)
    approved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.now)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id", ondelete="SET NULL"), nullable=True, index=True)

    assigned_warehouse = relationship(
        "Warehouse",
        foreign_keys=[warehouse_id],
        backref="assigned_employees",
        lazy=True,
    )

    import_invoices = relationship("ImportInvoice", backref="created_by_employee", lazy=True)
    sales_invoices = relationship(
        "SalesInvoice",
        foreign_keys="SalesInvoice.employee_id",
        backref="created_by_employee",
        lazy=True,
    )
    employee_stocks = relationship("EmployeeStock", backref="employee", lazy=True, cascade="all, delete-orphan")
    received_stock_transfers = relationship(
        "StockTransfer",
        foreign_keys="StockTransfer.employee_id",
        backref="recipient_employee",
        lazy=True,
    )
    created_stock_transfers = relationship(
        "StockTransfer",
        foreign_keys="StockTransfer.created_by_employee_id",
        backref="created_by_employee",
        lazy=True,
    )
    customer_payments = relationship("CustomerPayment", backref="collected_by_employee", lazy=True)
    refresh_sessions = relationship("RefreshSession", backref="employee", lazy=True, cascade="all, delete-orphan")


class ProductRequest(BaseModel):
    __tablename__ = "product_requests"
    __table_args__ = (
        Index("ix_product_requests_status_created", "status", "created_at"),
    )

    name = Column(String(255), nullable=False)
    unit = Column(String(50), nullable=False)
    note = Column(Text)
    status = Column(String(20), nullable=False, default=ProductRequestStatus.PENDING.value, index=True)
    created_at = Column(DateTime, nullable=False, default=datetime.now)
    resolved_at = Column(DateTime, nullable=True)
    requested_by_employee_id = Column(Integer, ForeignKey("employees.id", ondelete="RESTRICT"), nullable=False, index=True)
    resolved_product_id = Column(Integer, ForeignKey("products.id", ondelete="SET NULL"), nullable=True, index=True)

    requested_by_employee = relationship(
        "Employee",
        foreign_keys=[requested_by_employee_id],
        backref="product_requests",
        lazy=True,
    )
    resolved_product = relationship(
        "Product",
        foreign_keys=[resolved_product_id],
        backref="product_requests",
        lazy=True,
    )


class RefreshSession(BaseModel):
    __tablename__ = "refresh_sessions"

    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    token_hash = Column(String(64), nullable=False, unique=True, index=True)
    expires_at = Column(DateTime, nullable=False)
    revoked_at = Column(DateTime)
    created_at = Column(DateTime, nullable=False, default=datetime.now)


class SalesArea(BaseModel):
    __tablename__ = "sales_areas"
    __table_args__ = (
        UniqueConstraint("code", name="uq_sales_areas_code"),
        UniqueConstraint("name", name="uq_sales_areas_name"),
        Index("ix_sales_areas_active_name", "is_active", "name"),
    )

    code = Column(String(50), nullable=False)
    name = Column(String(120), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)

    customers = relationship("Customer", backref="sales_area_ref", lazy=True)
    sales_invoices = relationship("SalesInvoice", backref="sales_area_ref", lazy=True)


class Customer(BaseModel):
    __tablename__ = "customers"
    __table_args__ = (
        CheckConstraint("debt_amount >= 0", name="ck_customer_debt"),
        Index("ix_customers_debt_amount", "debt_amount"),
    )

    full_name = Column(String(150), nullable=False)
    phone = Column(String(20), nullable=False, unique=True, index=True)
    address = Column(Text, nullable=False)
    # Khu vực kinh doanh được chuẩn hóa để phục vụ báo cáo; không tạo bảng khu vực riêng.
    sales_area_id = Column(Integer, ForeignKey("sales_areas.id", ondelete="RESTRICT"), nullable=True, index=True)
    debt_amount = Column(Numeric(14, 2), nullable=False, default=0)

    sales_invoices = relationship("SalesInvoice", backref="customer", lazy=True)
    payments = relationship("CustomerPayment", backref="customer", lazy=True, cascade="all, delete-orphan")


class ImportInvoice(BaseModel):
    __tablename__ = "import_invoices"
    __table_args__ = (
        Index("ix_import_invoices_warehouse_date", "warehouse_id", "imported_at"),
        Index("ix_import_invoices_supplier_date", "supplier_id", "imported_at"),
    )

    imported_at = Column(DateTime, nullable=False, default=datetime.now)
    note = Column(Text)

    warehouse_id = Column(Integer, ForeignKey("warehouses.id", ondelete="RESTRICT"), nullable=False, index=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id", ondelete="RESTRICT"), nullable=False, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id", ondelete="RESTRICT"), nullable=False, index=True)

    items = relationship(
        "ImportInvoiceItem",
        backref="import_invoice",
        cascade="all, delete-orphan",
        lazy=True,
    )

    payments = relationship(
        "SupplierPayment",
        backref="import_invoice",
        cascade="all, delete-orphan",
        lazy=True,
    )


class SupplierPayment(BaseModel):
    __tablename__ = "supplier_payments"
    __table_args__ = (
        CheckConstraint("amount >= 500", name="ck_supplier_payment_amount"),
        Index("ix_supplier_payments_supplier_date", "supplier_id", "paid_at"),
        Index("ix_supplier_payments_invoice_date", "import_invoice_id", "paid_at"),
        Index("ix_supplier_payments_method_date", "payment_method", "paid_at"),
    )

    amount = Column(Numeric(14, 2), nullable=False)
    payment_method = Column(
        Enum(PaymentMethod, values_callable=lambda enum_cls: [item.value for item in enum_cls]),
        nullable=False,
    )
    paid_at = Column(DateTime, nullable=False, default=datetime.now)
    note = Column(Text, nullable=True)

    supplier_id = Column(Integer, ForeignKey("suppliers.id", ondelete="RESTRICT"), nullable=False, index=True)
    import_invoice_id = Column(Integer, ForeignKey("import_invoices.id", ondelete="RESTRICT"), nullable=False, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id", ondelete="RESTRICT"), nullable=False, index=True)

    employee = relationship("Employee", backref="supplier_payment_records", lazy=True)


class ImportInvoiceItem(BaseModel):
    __tablename__ = "import_invoice_items"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_import_item_qty"),
        CheckConstraint("unit_price >= 0", name="ck_import_item_price"),
        UniqueConstraint("import_invoice_id", "product_id", name="uq_import_item_product"),)

    quantity = Column(Integer, nullable=False)
    unit_price = Column(Numeric(14, 2), nullable=False)

    import_invoice_id = Column(
        Integer,
        ForeignKey("import_invoices.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    product_id = Column(Integer, ForeignKey("products.id", ondelete="RESTRICT"), nullable=False, index=True)


class EmployeeStock(BaseModel):
    __tablename__ = "employee_stocks"
    __table_args__ = (
        CheckConstraint("quantity >= 0", name="ck_employee_stock_qty"),
        UniqueConstraint("employee_id", "product_id", name="uq_employee_stock_product"),
        Index("ix_employee_stocks_employee_product", "employee_id", "product_id"),
    )

    quantity = Column(Integer, nullable=False, default=0)
    updated_at = Column(DateTime, nullable=False, default=datetime.now, onupdate=datetime.now)

    employee_id = Column(Integer, ForeignKey("employees.id", ondelete="RESTRICT"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="RESTRICT"), nullable=False, index=True)

    product = relationship("Product", backref="employee_stocks", lazy=True)


class StockTransfer(BaseModel):
    __tablename__ = "stock_transfers"
    __table_args__ = (
        Index("ix_stock_transfers_employee_date", "employee_id", "transferred_at"),
        Index("ix_stock_transfers_warehouse_date", "warehouse_id", "transferred_at"),
    )

    transferred_at = Column(DateTime, nullable=False, default=datetime.now)
    note = Column(Text, nullable=True)

    warehouse_id = Column(Integer, ForeignKey("warehouses.id", ondelete="RESTRICT"), nullable=False, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id", ondelete="RESTRICT"), nullable=False, index=True)
    created_by_employee_id = Column(Integer, ForeignKey("employees.id", ondelete="RESTRICT"), nullable=False, index=True)

    warehouse = relationship("Warehouse", backref="stock_transfers", lazy=True)
    items = relationship("StockTransferItem", backref="stock_transfer", cascade="all, delete-orphan", lazy=True)


class StockTransferItem(BaseModel):
    __tablename__ = "stock_transfer_items"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_stock_transfer_item_qty"),
        UniqueConstraint("stock_transfer_id", "product_id", name="uq_stock_transfer_product"),
    )

    quantity = Column(Integer, nullable=False)

    stock_transfer_id = Column(
        Integer,
        ForeignKey("stock_transfers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    product_id = Column(Integer, ForeignKey("products.id", ondelete="RESTRICT"), nullable=False, index=True)

    product = relationship("Product", backref="stock_transfer_items", lazy=True)


class Promotion(BaseModel):
    __tablename__ = "promotions"
    __table_args__ = (
        CheckConstraint("discount_value > 0", name="ck_promotion_discount_value"),
        CheckConstraint(
            "max_discount_amount IS NULL OR max_discount_amount >= 0",
            name="ck_promotion_max_discount",
        ),
        Index("ix_promotions_active_dates", "is_active", "start_date", "end_date"),
    )

    name = Column(String(150), nullable=False, unique=True)
    condition_type = Column(String(30), nullable=False)
    min_quantity = Column(Integer, nullable=True)
    min_order_amount = Column(Numeric(14, 2), nullable=True)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    discount_type = Column(String(20), nullable=False)
    discount_value = Column(Numeric(14, 2), nullable=False)
    max_discount_amount = Column(Numeric(14, 2), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True, index=True)
    created_by = Column(
        Integer,
        ForeignKey("employees.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    created_at = Column(DateTime, nullable=False, default=datetime.now)
    updated_at = Column(DateTime, nullable=False, default=datetime.now, onupdate=datetime.now)

    created_by_employee = relationship(
        "Employee",
        foreign_keys=[created_by],
        backref="created_promotions",
        lazy=True,
    )


class SalesInvoice(BaseModel):
    __tablename__ = "sales_invoices"
    __table_args__ = (
        CheckConstraint("discount_amount >= 0", name="ck_discount_amount"),
        CheckConstraint("paid_amount >= 0", name="ck_sales_invoice_paid_amount"),
        Index("ix_sales_invoices_customer_date", "customer_id", "sold_at"),
        Index("ix_sales_invoices_status_date", "status", "sold_at"),
        Index(
            "ix_sales_invoices_payment_due",
            "status",
            "payment_status",
            "payment_due_date",
        ),
    )

    sold_at = Column(DateTime, nullable=False, default=datetime.now)
    note = Column(Text)
    status = Column(Enum(InvoiceStatus), nullable=False, default=InvoiceStatus.DRAFT)
    cancel_requested = Column(Boolean, nullable=False, default=False)
    cancel_note = Column(Text)
    
                     
    discount_amount = Column(Numeric(14, 2), nullable=False, default=0)
    discount_status = Column(Enum(DiscountStatus), nullable=False, default=DiscountStatus.NO_DISCOUNT)
    discount_note = Column(Text)
    discount_approved_by = Column(Integer, ForeignKey("employees.id", ondelete="SET NULL"), nullable=True, index=True)

    sale_source = Column(Enum(SaleSource), nullable=False, default=SaleSource.CENTRAL_WAREHOUSE, index=True)
    payment_status = Column(Enum(PaymentStatus), nullable=False, default=PaymentStatus.UNPAID, index=True)
    paid_amount = Column(Numeric(14, 2), nullable=False, default=0)
    payment_due_date = Column(Date, nullable=True)

    warehouse_id = Column(Integer, ForeignKey("warehouses.id", ondelete="RESTRICT"), nullable=False, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id", ondelete="RESTRICT"), nullable=False, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id", ondelete="RESTRICT"), nullable=False, index=True)
    # Lưu snapshot khu vực tại thời điểm lập đơn, tránh thay đổi lịch sử khi khách đổi địa chỉ/khu vực.
    sales_area_id = Column(Integer, ForeignKey("sales_areas.id", ondelete="RESTRICT"), nullable=True, index=True)

    items = relationship(
        "SalesInvoiceItem",
        backref="sales_invoice",
        cascade="all, delete-orphan",
        lazy=True,
    )
    
    discount_approved_by_employee = relationship(
        "Employee",
        foreign_keys=[discount_approved_by],
        backref="approved_discounts",
        lazy=True,
    )
    payments = relationship("CustomerPayment", backref="sales_invoice", lazy=True)


class SalesInvoiceItem(BaseModel):
    __tablename__ = "sales_invoice_items"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_sales_item_qty"),
        CheckConstraint("unit_price >= 0", name="ck_sales_item_price"),
        UniqueConstraint("sales_invoice_id", "product_id", name="uq_sales_item_product"),
    )

    quantity = Column(Integer, nullable=False)
    unit_price = Column(Numeric(14, 2), nullable=False)

    sales_invoice_id = Column(
        Integer,
        ForeignKey("sales_invoices.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    product_id = Column(Integer, ForeignKey("products.id", ondelete="RESTRICT"), nullable=False, index=True)


class CustomerPayment(BaseModel):
    __tablename__ = "customer_payments"
    __table_args__ = (
        CheckConstraint("amount > 0", name="ck_customer_payment_amount"),
        Index("ix_customer_payments_customer_date", "customer_id", "paid_at"),
    )

    amount = Column(Numeric(14, 2), nullable=False)
    payment_type = Column(Enum(PaymentType), nullable=False)
    payment_method = Column(
        Enum(PaymentMethod, values_callable=lambda enum_cls: [item.value for item in enum_cls]),
        nullable=True,
    )
    paid_at = Column(DateTime, nullable=False, default=datetime.now)
    note = Column(Text, nullable=True)

    customer_id = Column(Integer, ForeignKey("customers.id", ondelete="RESTRICT"), nullable=False, index=True)
    sales_invoice_id = Column(Integer, ForeignKey("sales_invoices.id", ondelete="SET NULL"), nullable=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id", ondelete="RESTRICT"), nullable=False, index=True)


class DamageReport(BaseModel):
    __tablename__ = "damage_reports"
    __table_args__ = (
        Index("ix_damage_reports_warehouse_status_date", "warehouse_id", "status", "reported_at"),
    )

    reported_at = Column(DateTime, nullable=False, default=datetime.now)
    reviewed_at = Column(DateTime, nullable=True)
    status = Column(Enum(DamageReportStatus), nullable=False, default=DamageReportStatus.PENDING, index=True)
    note = Column(Text, nullable=True)
    review_note = Column(Text, nullable=True)

    warehouse_id = Column(
        Integer,
        ForeignKey("warehouses.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    reported_by_employee_id = Column(
        Integer,
        ForeignKey("employees.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    reviewed_by_employee_id = Column(
        Integer,
        ForeignKey("employees.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    items = relationship(
        "DamageReportItem",
        backref="damage_report",
        cascade="all, delete-orphan",
        lazy=True,
    )
    warehouse = relationship("Warehouse", backref="damage_reports", lazy=True)
    reported_by_employee = relationship(
        "Employee",
        foreign_keys=[reported_by_employee_id],
        backref="reported_damage_reports",
        lazy=True,
    )
    reviewed_by_employee = relationship(
        "Employee",
        foreign_keys=[reviewed_by_employee_id],
        backref="reviewed_damage_reports",
        lazy=True,
    )


class DamageReportItem(BaseModel):
    __tablename__ = "damage_report_items"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_damage_report_item_qty"),
        UniqueConstraint("damage_report_id", "product_id", name="uq_damage_report_product"),
    )

    quantity = Column(Integer, nullable=False)
    damage_reason = Column(String(255), nullable=True)

    damage_report_id = Column(
        Integer,
        ForeignKey("damage_reports.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    product_id = Column(
        Integer,
        ForeignKey("products.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    product = relationship("Product", backref="damage_report_items", lazy=True)
