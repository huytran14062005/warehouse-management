-- Chạy một lần trên cơ sở dữ liệu MySQL trước khi bật màn hình Chi phí & giá bán.
-- Trên cơ sở dữ liệu SQLite mới, init_db.py / db.create_all() tạo các bảng này.
CREATE TABLE IF NOT EXISTS pricing_policies (
    product_id INT NOT NULL PRIMARY KEY,
    planned_quantity INT NOT NULL DEFAULT 100,
    target_margin DECIMAL(5,2) NOT NULL DEFAULT 20.00,
    updated_at DATETIME NOT NULL,
    updated_by_id INT NOT NULL,
    CONSTRAINT ck_pricing_planned_quantity CHECK (planned_quantity > 0),
    CONSTRAINT ck_pricing_target_margin CHECK (target_margin >= 0 AND target_margin < 100),
    CONSTRAINT fk_pricing_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    CONSTRAINT fk_pricing_manager FOREIGN KEY (updated_by_id) REFERENCES employees(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS operating_expenses (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    category VARCHAR(24) NOT NULL,
    amount DECIMAL(14,2) NOT NULL,
    occurred_on DATE NOT NULL,
    invoice_id INT NULL,
    description VARCHAR(500) NOT NULL,
    payment_method VARCHAR(20) NULL,
    created_at DATETIME NOT NULL,
    created_by_id INT NOT NULL,
    voided_at DATETIME NULL,
    voided_by_id INT NULL,
    void_reason VARCHAR(500) NULL,
    CONSTRAINT ck_operating_expense_amount CHECK (amount > 0),
    CONSTRAINT ck_operating_expense_category CHECK (category IN ('fuel', 'vehicle_repair', 'lodging', 'sales_salary', 'other')),
    CONSTRAINT fk_operating_expense_invoice FOREIGN KEY (invoice_id) REFERENCES sales_invoices(id) ON DELETE RESTRICT,
    CONSTRAINT fk_operating_expense_manager FOREIGN KEY (created_by_id) REFERENCES employees(id) ON DELETE RESTRICT,
    CONSTRAINT fk_operating_expense_void_manager FOREIGN KEY (voided_by_id) REFERENCES employees(id) ON DELETE RESTRICT,
    INDEX ix_operating_expenses_date_id (occurred_on, id),
    INDEX ix_operating_expenses_invoice_date (invoice_id, occurred_on),
    INDEX ix_operating_expenses_category_date (category, occurred_on)
);
