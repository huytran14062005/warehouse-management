from datetime import datetime

from web import app, db
from web.models import (
    Customer,
    CustomerPayment,
    DiscountStatus,
    Employee,
    EmployeeRole,
    EmployeeStock,
    ImportInvoice,
    ImportInvoiceItem,
    InvoiceStatus,
    PaymentMethod,
    PaymentStatus,
    PaymentType,
    Product,
    ProductRequest,
    SalesInvoice,
    SalesInvoiceItem,
    SalesArea,
    SaleSource,
    SupplierPayment,
    StockTransfer,
    StockTransferItem,
    Supplier,
    Warehouse,
)
from web.utils.password_hasher import hash_password


def create_employee(full_name, phone, username, email, role, warehouse=None):
    return Employee(
        full_name=full_name,
        phone=phone,
        username=username,
        email=email,
        password_hash=hash_password("Password@123"),
        role=role,
        is_approved=True,
        approved_at=datetime.now(),
        assigned_warehouse=warehouse,
    )


def create_import_invoice(warehouse, supplier, employee, imported_at, note, items):
    invoice = ImportInvoice(
        warehouse=warehouse,
        supplier=supplier,
        created_by_employee=employee,
        imported_at=imported_at,
        note=note,
    )
    invoice.items = [
        ImportInvoiceItem(product=product, quantity=quantity, unit_price=unit_price)
        for product, quantity, unit_price in items
    ]
    return invoice


def create_sales_invoice(
    warehouse,
    customer,
    employee,
    sold_at,
    status,
    note,
    items,
    discount_amount=0,
    discount_status=DiscountStatus.NO_DISCOUNT,
    discount_note=None,
    discount_approved_by=None,
    cancel_requested=False,
    cancel_note=None,
    sale_source=SaleSource.CENTRAL_WAREHOUSE,
    payment_status=PaymentStatus.UNPAID,
    paid_amount=0,
):
    if status == InvoiceStatus.COMPLETED and payment_status == PaymentStatus.UNPAID and not paid_amount:
        paid_amount = sum(quantity * unit_price for _, quantity, unit_price in items) - discount_amount
        payment_status = PaymentStatus.PAID

    invoice = SalesInvoice(
        warehouse=warehouse,
        customer=customer,
        created_by_employee=employee,
        sold_at=sold_at,
        status=status,
        note=note,
        discount_amount=discount_amount,
        discount_status=discount_status,
        discount_note=discount_note,
        discount_approved_by_employee=discount_approved_by,
        cancel_requested=cancel_requested,
        cancel_note=cancel_note,
        sale_source=sale_source,
        payment_status=payment_status,
        paid_amount=paid_amount,
        sales_area_ref=customer.sales_area_ref,
    )
    invoice.items = [
        SalesInvoiceItem(product=product, quantity=quantity, unit_price=unit_price)
        for product, quantity, unit_price in items
    ]
    return invoice


if __name__ == "__main__":
    with app.app_context():
        db.drop_all()
        db.create_all()

        warehouse_hcm = Warehouse(
            name="Kho trung tâm",
            address="123 Nguyễn Văn Linh, Quận 7, TP. Hồ Chí Minh",
        )
        supplier_minh_phat = Supplier(
            name="Nhà cung cấp Minh Phát",
            address="456 Lê Lợi, Quận 1, TP. Hồ Chí Minh",
        )

        sales_employee = create_employee(
                "Nguyễn Văn An", "0900000001", "nguyenvanan", "tranvanha975285@gmail.com", EmployeeRole.NHAN_VIEN_BAN_HANG, warehouse_hcm
        )
        accountant = create_employee(
            "Phạm Thu Hà", "0900000005", "ketoan", "phamthuha@example.com", EmployeeRole.KE_TOAN
        )
        warehouse_keeper = create_employee(
            "Lê Văn Kho", "0900000003", "thukho", "levankho@example.com", EmployeeRole.THU_KHO, warehouse_hcm
        )
        manager = create_employee(
            "Trần Minh Quản", "0900000004", "quanly", "tranminhquan@example.com", EmployeeRole.QUAN_LY
        )

        sales_area_hn = SalesArea(code="HN", name="Hà Nội")
        sales_area_hcm = SalesArea(code="HCM", name="TP. Hồ Chí Minh")
        sales_area_dn = SalesArea(code="DN", name="Đà Nẵng")

        customers = [
            Customer(
                full_name="Trần Thị Bình",
                phone="0900000002",
                address="789 Cầu Giấy, Hà Nội",
                debt_amount=0,
            ),
            Customer(
                full_name="Công ty TNHH Minh Long",
                phone="0900000010",
                address="12 Nguyễn Huệ, Quận 1, TP. Hồ Chí Minh",
                debt_amount=7_100_000,
            ),
            Customer(
                full_name="Nguyễn Văn Cường",
                phone="0900000011",
                address="25 Lê Duẩn, Hải Châu, Đà Nẵng",
                debt_amount=500_000,
            ),
            Customer(
                full_name="Lê Thị Dung",
                phone="0900000012",
                address="18 Nguyễn Trãi, Thanh Xuân, Hà Nội",
                debt_amount=0,
            ),
            Customer(
                full_name="Cửa hàng Hoàng Gia",
                phone="0900000013",
                address="90 Võ Văn Tần, Quận 3, TP. Hồ Chí Minh",
                debt_amount=0,
            ),
            Customer(
                full_name="Bùi Đức Nam",
                phone="0900000014",
                address="33 Trần Phú, Hải Châu, Đà Nẵng",
                debt_amount=0,
            ),
            Customer(
                full_name="Công ty TNHH An Phú",
                phone="0900000015",
                address="101 Điện Biên Phủ, Bình Thạnh, TP. Hồ Chí Minh",
                debt_amount=0,
            ),
        ]
        customer_area_by_phone = {
            "0900000002": sales_area_hn,
            "0900000010": sales_area_hcm,
            "0900000011": sales_area_dn,
            "0900000012": sales_area_hn,
            "0900000013": sales_area_hcm,
            "0900000014": sales_area_dn,
            "0900000015": sales_area_hcm,
        }
        for customer in customers:
            customer.sales_area_ref = customer_area_by_phone.get(customer.phone)

        products = [
            Product(name="Nước suối 500ml", unit="Chai", default_sale_price=8_000),
            Product(name="Bánh quy", unit="Hộp", default_sale_price=15_000),
            Product(name="Dầu gội chăm sóc tóc", unit="Chai", default_sale_price=120_000),
            Product(name="Thùng carton", unit="Thùng", default_sale_price=75_000),
            Product(name="Găng tay bảo hộ", unit="Đôi", default_sale_price=35_000),
        ]

        db.session.add_all(
            [
                warehouse_hcm,
                supplier_minh_phat,
                sales_employee,
                accountant,
                warehouse_keeper,
                manager,
                sales_area_hn,
                sales_area_hcm,
                sales_area_dn,
                *customers,
                *products,
            ]
        )
        db.session.flush()

        import_invoices = [
            create_import_invoice(
                warehouse_hcm,
                supplier_minh_phat,
                warehouse_keeper,
                datetime(2026, 8, 20, 8, 30),
                "Nhập hàng mẫu cho kho trung tâm",
                [
                    (products[0], 500, 5_000),
                    (products[1], 200, 10_000),
                    (products[2], 80, 85_000),
                    (products[3], 100, 50_000),
                    (products[4], 300, 20_000),
                ],
            ),
        ]
        db.session.add_all(import_invoices)
        db.session.flush()

        field_transfer = StockTransfer(
            warehouse=warehouse_hcm,
            recipient_employee=sales_employee,
            created_by_employee=warehouse_keeper,
            transferred_at=datetime(2026, 9, 1, 7, 30),
            note="Cấp hàng cho chuyến bán hàng tại Đà Nẵng",
        )
        field_transfer.items = [
            StockTransferItem(product=products[2], quantity=10),
            StockTransferItem(product=products[0], quantity=50),
        ]
        employee_stock_rows = [
            EmployeeStock(employee=sales_employee, product=products[2], quantity=8),
            EmployeeStock(employee=sales_employee, product=products[0], quantity=50),
        ]
        db.session.add(field_transfer)
        db.session.add_all(employee_stock_rows)
        db.session.flush()

        sales_invoices = [
            create_sales_invoice(
                warehouse_hcm,
                customers[0],
                sales_employee,
                datetime(2026, 8, 25, 10, 0),
                InvoiceStatus.COMPLETED,
                "Đơn hoàn thành và đã thanh toán đủ",
                [(products[0], 20, 8_000), (products[1], 5, 15_000)],
            ),
            create_sales_invoice(
                warehouse_hcm,
                customers[0],
                sales_employee,
                datetime(2026, 9, 5, 14, 20),
                InvoiceStatus.COMPLETED,
                "Đơn mua lại nhiều sản phẩm",
                [(products[2], 2, 120_000), (products[4], 10, 35_000)],
            ),
            create_sales_invoice(
                warehouse_hcm,
                customers[1],
                sales_employee,
                datetime(2026, 10, 2, 9, 10),
                InvoiceStatus.PROCESSING,
                "Đơn doanh nghiệp chờ duyệt giảm giá",
                [(products[3], 80, 75_000), (products[2], 10, 120_000)],
                discount_amount=100_000,
                discount_status=DiscountStatus.PENDING_APPROVAL,
                discount_note="Đề nghị giảm giá theo hợp đồng doanh nghiệp",
            ),
            create_sales_invoice(
                warehouse_hcm,
                customers[2],
                sales_employee,
                datetime(2026, 10, 6, 15, 45),
                InvoiceStatus.DELIVERING,
                "Đơn đang giao, khách đã thanh toán một phần",
                [(products[0], 40, 8_000), (products[2], 5, 120_000)],
            ),
            create_sales_invoice(
                warehouse_hcm,
                customers[3],
                sales_employee,
                datetime(2026, 10, 8, 11, 5),
                InvoiceStatus.DRAFT,
                "Đơn nháp đang chờ xác nhận",
                [(products[0], 10, 8_000)],
            ),
            create_sales_invoice(
                warehouse_hcm,
                customers[4],
                sales_employee,
                datetime(2026, 9, 12, 16, 30),
                InvoiceStatus.COMPLETED,
                "Đơn cửa hàng đã hoàn thành",
                [(products[1], 30, 15_000), (products[3], 20, 75_000)],
                discount_amount=50_000,
                discount_status=DiscountStatus.AUTO_APPROVED,
                discount_note="Giảm giá tự động cho đơn đủ điều kiện",
            ),
            create_sales_invoice(
                warehouse_hcm,
                customers[4],
                sales_employee,
                datetime(2026, 9, 20, 13, 0),
                InvoiceStatus.COMPLETED,
                "Đơn hoàn thành có yêu cầu hủy để quản lý xử lý",
                [(products[0], 15, 8_000)],
                cancel_requested=True,
                cancel_note="Khách đề nghị đổi địa chỉ giao hàng",
            ),
            create_sales_invoice(
                warehouse_hcm,
                customers[5],
                sales_employee,
                datetime(2026, 9, 18, 10, 40),
                InvoiceStatus.CANCELLED,
                "Đơn đã hủy trước khi giao",
                [(products[3], 5, 75_000)],
                cancel_note="Khách không còn nhu cầu mua",
            ),
            create_sales_invoice(
                warehouse_hcm,
                customers[5],
                sales_employee,
                datetime(2026, 9, 3, 10, 15),
                InvoiceStatus.COMPLETED,
                "Đơn bán tại tỉnh, khách thanh toán đủ bằng tiền mặt",
                [(products[2], 2, 120_000)],
                sale_source=SaleSource.EMPLOYEE_STOCK,
                payment_status=PaymentStatus.PAID,
                paid_amount=240_000,
            ),
        ]
        db.session.add_all(sales_invoices)
        db.session.flush()

        # Keep seed invoice balances and payment records consistent. Every
        # completed invoice marked as paid must have a corresponding payment
        # record with an explicit method so reports can reconcile revenue,
        # collected money, cash, and bank transfer totals.
        for index, invoice in enumerate(sales_invoices):
            if invoice.status != InvoiceStatus.COMPLETED or invoice.payment_status != PaymentStatus.PAID:
                continue
            payment_method = PaymentMethod.CASH if index % 2 == 0 else PaymentMethod.BANK_TRANSFER
            db.session.add(
                CustomerPayment(
                    customer=invoice.customer,
                    sales_invoice=invoice,
                    collected_by_employee=sales_employee,
                    amount=invoice.paid_amount,
                    payment_type=PaymentType.INVOICE,
                    payment_method=payment_method,
                    paid_at=invoice.sold_at,
                    note="Thanh toán mẫu theo phiếu bán",
                )
            )
        db.session.commit()

        print("Database tables and diverse sample data created successfully.")
