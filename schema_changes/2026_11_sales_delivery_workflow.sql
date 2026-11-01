-- Chạy một lần trong MySQL Workbench trên cả cơ sở dữ liệu local và Aiven
-- trước khi chạy backend có luồng giao hàng mới.
-- Sao lưu cơ sở dữ liệu trước khi thay đổi schema.

ALTER TABLE employees
    MODIFY COLUMN role ENUM(
        'KE_TOAN', 'NHAN_VIEN_BAN_HANG', 'THU_KHO', 'QUAN_LY',
        'NHAN_VIEN_GIAO_HANG'
    ) NOT NULL;

ALTER TABLE sales_invoices
    ADD COLUMN delivery_method VARCHAR(16) NULL,
    ADD COLUMN delivery_employee_id INT NULL,
    ADD COLUMN delivery_service VARCHAR(120) NULL,
    ADD COLUMN tracking_number VARCHAR(120) NULL,
    ADD COLUMN shipping_fee DECIMAL(14,2) NULL,
    ADD COLUMN shipping_fund_method VARCHAR(20) NULL,
    ADD COLUMN shipping_charged_at DATETIME NULL,
    ADD INDEX ix_sales_invoices_delivery_employee_id (delivery_employee_id),
    ADD CONSTRAINT fk_sales_invoices_delivery_employee
        FOREIGN KEY (delivery_employee_id) REFERENCES employees(id)
        ON DELETE RESTRICT;
