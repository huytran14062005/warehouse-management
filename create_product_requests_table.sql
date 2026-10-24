USE defaultdb;

CREATE TABLE IF NOT EXISTS product_requests (
    id INT NOT NULL AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    unit VARCHAR(50) NOT NULL,
    note TEXT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME NULL,
    requested_by_employee_id INT NOT NULL,
    resolved_product_id INT NULL,
    PRIMARY KEY (id),
    KEY ix_product_requests_status (status),
    KEY ix_product_requests_status_created (status, created_at),
    KEY ix_product_requests_requested_by (requested_by_employee_id),
    KEY ix_product_requests_resolved_product (resolved_product_id),
    CONSTRAINT fk_product_requests_requested_by
        FOREIGN KEY (requested_by_employee_id) REFERENCES employees (id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_product_requests_resolved_product
        FOREIGN KEY (resolved_product_id) REFERENCES products (id)
        ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
