-- Phần 7: thu nợ cho 30/40 đơn hoàn thành của phần 6, tổng 40 biên nhận.
-- 10 đơn giữ chưa thu, 10 đơn thu một phần, 10 đơn thu đủ một lần,
-- 10 đơn thu đủ qua hai lần; dùng cả tiền mặt và chuyển khoản.
-- Chạy toàn bộ file trong MySQL Workbench sau phần 6.
-- Mỗi biên nhận được kế toán ghi nhận cùng lúc với công nợ, trạng thái đơn và sổ quỹ.
-- Ngày thu là lúc chạy file, giống nghiệp vụ ghi nhận thanh toán hiện tại của ứng dụng.
-- Nếu quỹ tiền mặt/chuyển khoản chưa được quản lý khởi tạo, file sẽ không ghi thanh toán.

SET NAMES utf8mb4;

-- Hai bảng sổ quỹ có thể được ứng dụng tạo khi quản lý khởi tạo số dư lần đầu.
-- CREATE IF NOT EXISTS giữ nguyên bảng/dữ liệu đã có.
CREATE TABLE IF NOT EXISTS company_funds (
  method VARCHAR(20) NOT NULL,
  opening_balance DECIMAL(14,2) NOT NULL,
  balance DECIMAL(14,2) NOT NULL,
  opened_at DATETIME NOT NULL,
  opened_by_id INT NOT NULL,
  PRIMARY KEY (method),
  KEY ix_company_funds_opened_by_id (opened_by_id),
  CONSTRAINT fk_company_funds_opened_by FOREIGN KEY (opened_by_id)
    REFERENCES employees (id) ON DELETE RESTRICT,
  CONSTRAINT ck_company_fund_balance CHECK (balance >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS company_fund_entries (
  id INT NOT NULL AUTO_INCREMENT,
  method VARCHAR(20) NOT NULL,
  direction VARCHAR(3) NOT NULL,
  entry_type VARCHAR(30) NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  balance_after DECIMAL(14,2) NOT NULL,
  occurred_at DATETIME NOT NULL,
  source_type VARCHAR(30) NOT NULL,
  source_id INT NOT NULL,
  description VARCHAR(255) NOT NULL,
  employee_id INT NOT NULL,
  note TEXT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_company_fund_entry_source (source_type, source_id),
  KEY ix_company_fund_entries_method_date (method, occurred_at),
  KEY ix_company_fund_entries_employee_id (employee_id),
  CONSTRAINT fk_company_fund_entries_method FOREIGN KEY (method)
    REFERENCES company_funds (method) ON DELETE RESTRICT,
  CONSTRAINT fk_company_fund_entries_employee FOREIGN KEY (employee_id)
    REFERENCES employees (id) ON DELETE RESTRICT,
  CONSTRAINT ck_company_fund_entry_amount CHECK (amount > 0),
  CONSTRAINT ck_company_fund_entry_direction CHECK (direction IN ('in', 'out'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TEMPORARY TABLE IF EXISTS tmp_seed_receipt_rows_2026;
DROP TEMPORARY TABLE IF EXISTS tmp_seed_receipt_plan_2026;

CREATE TEMPORARY TABLE tmp_seed_receipt_plan_2026 (
  invoice_no SMALLINT NOT NULL PRIMARY KEY,
  strategy VARCHAR(8) NOT NULL
);

INSERT INTO tmp_seed_receipt_plan_2026 (invoice_no, strategy) VALUES
  (7, 'PARTIAL'),
  (8, 'FULL'),
  (9, 'TWO'),
  (17, 'PARTIAL'),
  (18, 'FULL'),
  (19, 'TWO'),
  (27, 'PARTIAL'),
  (28, 'FULL'),
  (29, 'TWO'),
  (37, 'PARTIAL'),
  (38, 'FULL'),
  (39, 'TWO'),
  (47, 'PARTIAL'),
  (48, 'FULL'),
  (49, 'TWO'),
  (57, 'PARTIAL'),
  (58, 'FULL'),
  (59, 'TWO'),
  (67, 'PARTIAL'),
  (68, 'FULL'),
  (69, 'TWO'),
  (77, 'PARTIAL'),
  (78, 'FULL'),
  (79, 'TWO'),
  (87, 'PARTIAL'),
  (88, 'FULL'),
  (89, 'TWO'),
  (97, 'PARTIAL'),
  (98, 'FULL'),
  (99, 'TWO');

CREATE TEMPORARY TABLE tmp_seed_receipt_rows_2026 (
  invoice_no SMALLINT NOT NULL,
  part_no TINYINT NOT NULL,
  invoice_id INT NOT NULL,
  customer_id INT NOT NULL,
  invoice_total DECIMAL(14,2) NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  method VARCHAR(20) NOT NULL,
  PRIMARY KEY (invoice_no, part_no)
);

INSERT INTO tmp_seed_receipt_rows_2026
  (invoice_no, part_no, invoice_id, customer_id, invoice_total, amount, method)
SELECT plan.invoice_no, part.part_no, invoice.id, invoice.customer_id,
       totals.gross_total - invoice.discount_amount,
       CASE
         WHEN plan.strategy = 'PARTIAL' THEN ROUND(totals.gross_total * 0.40, 2)
         WHEN plan.strategy = 'FULL' THEN totals.gross_total
         WHEN part.part_no = 1 THEN FLOOR(totals.gross_total / 2)
         ELSE totals.gross_total - FLOOR(totals.gross_total / 2)
       END,
       CASE
         WHEN plan.strategy = 'PARTIAL' THEN 'bank_transfer'
         WHEN plan.strategy = 'FULL' OR part.part_no = 1 THEN 'cash'
         ELSE 'bank_transfer'
       END
FROM tmp_seed_receipt_plan_2026 AS plan
JOIN sales_invoices AS invoice
  ON invoice.note LIKE CONCAT('[DEMO-CURTAIN-SALE-', LPAD(plan.invoice_no, 3, '0'), ']%')
JOIN (
  SELECT sales_invoice_id, SUM(quantity * unit_price) AS gross_total
  FROM sales_invoice_items GROUP BY sales_invoice_id
) AS totals ON totals.sales_invoice_id = invoice.id
CROSS JOIN (SELECT 1 AS part_no UNION ALL SELECT 2 AS part_no) AS part
WHERE invoice.status = 'COMPLETED'
  AND invoice.paid_amount = 0
  AND invoice.discount_amount = 0
  AND (plan.strategy = 'TWO' OR part.part_no = 1);

SET @accountant_id = (
  SELECT id FROM employees
  WHERE role = 'KE_TOAN' AND is_approved = 1 AND is_locked = 0
  ORDER BY id LIMIT 1
);
SET @fund_count = (
  SELECT COUNT(*) FROM company_funds
  WHERE method IN ('cash', 'bank_transfer')
);
SET @plan_count = (SELECT COUNT(*) FROM tmp_seed_receipt_plan_2026);
SET @receipt_row_count = (SELECT COUNT(*) FROM tmp_seed_receipt_rows_2026);
SET @receipt_invoice_count = (
  SELECT COUNT(DISTINCT invoice_id) FROM tmp_seed_receipt_rows_2026
);
SET @invalid_receipts = (
  SELECT COUNT(*) FROM tmp_seed_receipt_rows_2026
  WHERE amount < 500 OR method NOT IN ('cash', 'bank_transfer')
);
SET @existing_demo_receipts = (
  SELECT COUNT(*) FROM customer_payments
  WHERE note LIKE '[DEMO-CURTAIN-RECEIPT-%]%'
);
SET @overpaid_invoices = (
  SELECT COUNT(*) FROM (
    SELECT invoice_id, MAX(invoice_total) AS total_due, SUM(amount) AS proposed
    FROM tmp_seed_receipt_rows_2026 GROUP BY invoice_id
  ) AS proposed
  JOIN sales_invoices AS invoice ON invoice.id = proposed.invoice_id
  WHERE proposed.proposed > proposed.total_due - invoice.paid_amount
);
SET @insufficient_customer_debt = (
  SELECT COUNT(*) FROM (
    SELECT customer_id, SUM(amount) AS proposed
    FROM tmp_seed_receipt_rows_2026 GROUP BY customer_id
  ) AS proposed
  JOIN customers AS customer ON customer.id = proposed.customer_id
  WHERE proposed.proposed > customer.debt_amount
);
SET @other_open_invoice_conflicts = (
  SELECT COUNT(*) FROM tmp_seed_receipt_rows_2026 AS planned
  WHERE EXISTS (
    SELECT 1 FROM sales_invoices AS other
    WHERE other.customer_id = planned.customer_id
      AND other.id != planned.invoice_id
      AND other.status = 'COMPLETED'
      AND other.payment_status != 'PAID'
  )
);
SET @customer_debt_mismatches = (
  SELECT COUNT(*)
  FROM tmp_seed_receipt_rows_2026 AS planned
  JOIN customers AS customer ON customer.id = planned.customer_id
  WHERE customer.debt_amount != planned.invoice_total
);
SET @can_seed_receipts = (
  @accountant_id IS NOT NULL
  AND @fund_count = 2
  AND @plan_count = 30
  AND @receipt_row_count = 40
  AND @receipt_invoice_count = 30
  AND @invalid_receipts = 0
  AND @existing_demo_receipts = 0
  AND @overpaid_invoices = 0
  AND @insufficient_customer_debt = 0
  AND @other_open_invoice_conflicts = 0
  AND @customer_debt_mismatches = 0
);

SELECT @fund_count AS initialized_funds,
       @accountant_id AS accountant_id,
       @receipt_row_count AS planned_receipts,
       @existing_demo_receipts AS already_imported_receipts,
       @other_open_invoice_conflicts AS other_open_invoice_conflicts,
       @customer_debt_mismatches AS customer_debt_mismatches,
       @can_seed_receipts AS ready_to_insert;

-- Procedure dùng một giao dịch và tự ROLLBACK nếu bất kỳ bút toán nào lỗi.
DROP PROCEDURE IF EXISTS seed_customer_receipts_curtains_2026;
DELIMITER $$
CREATE PROCEDURE seed_customer_receipts_curtains_2026()
BEGIN
  DECLARE v_done TINYINT DEFAULT 0;
  DECLARE v_count INT DEFAULT 0;
  DECLARE v_invoice_no SMALLINT;
  DECLARE v_part_no TINYINT;
  DECLARE v_invoice_id INT;
  DECLARE v_customer_id INT;
  DECLARE v_total DECIMAL(14,2);
  DECLARE v_amount DECIMAL(14,2);
  DECLARE v_method VARCHAR(20);
  DECLARE v_payment_id INT;
  DECLARE v_balance DECIMAL(14,2);
  DECLARE receipt_cursor CURSOR FOR
    SELECT invoice_no, part_no, invoice_id, customer_id, invoice_total, amount, method
    FROM tmp_seed_receipt_rows_2026
    ORDER BY invoice_no, part_no;
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done = 1;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  IF @can_seed_receipts = 1 THEN
    START TRANSACTION;
    SELECT balance INTO v_balance FROM company_funds WHERE method = 'cash' FOR UPDATE;
    SELECT balance INTO v_balance FROM company_funds WHERE method = 'bank_transfer' FOR UPDATE;

    OPEN receipt_cursor;
    receipt_loop: LOOP
      FETCH receipt_cursor INTO v_invoice_no, v_part_no, v_invoice_id,
        v_customer_id, v_total, v_amount, v_method;
      IF v_done = 1 THEN LEAVE receipt_loop; END IF;

      INSERT INTO customer_payments
        (amount, payment_type, payment_method, paid_at, note,
         customer_id, sales_invoice_id, employee_id)
      VALUES
        (v_amount, 'OLD_DEBT', v_method, NOW(),
         CONCAT('[DEMO-CURTAIN-RECEIPT-', LPAD(v_invoice_no, 3, '0'),
                '-', v_part_no, '] Thu nợ đơn mẫu'),
         v_customer_id, v_invoice_id, @accountant_id);
      SET v_payment_id = LAST_INSERT_ID();

      UPDATE sales_invoices
      SET paid_amount = paid_amount + v_amount
      WHERE id = v_invoice_id AND status = 'COMPLETED'
        AND paid_amount + v_amount <= v_total;
      IF ROW_COUNT() != 1 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Số tiền thu vượt số còn nợ của đơn';
      END IF;
      UPDATE sales_invoices
      SET payment_status = IF(paid_amount >= v_total, 'PAID', 'PARTIAL')
      WHERE id = v_invoice_id;

      UPDATE customers SET debt_amount = debt_amount - v_amount
      WHERE id = v_customer_id AND debt_amount >= v_amount;
      IF ROW_COUNT() != 1 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Công nợ khách hàng không đủ để thu';
      END IF;

      UPDATE company_funds SET balance = balance + v_amount
      WHERE method = v_method;
      IF ROW_COUNT() != 1 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Chưa khởi tạo quỹ cho phương thức thu';
      END IF;
      SELECT balance INTO v_balance FROM company_funds WHERE method = v_method;

      INSERT INTO company_fund_entries
        (method, direction, entry_type, amount, balance_after, occurred_at,
         source_type, source_id, description, employee_id, note)
      VALUES
        (v_method, 'in', 'customer_receipt', v_amount, v_balance, NOW(),
         'customer_receipt', v_payment_id,
         CONCAT('Thu nợ khách hàng · Đơn bán #', v_invoice_id), @accountant_id,
         CONCAT('[DEMO-CURTAIN-RECEIPT-', LPAD(v_invoice_no, 3, '0'),
                '-', v_part_no, ']'));
      SET v_count = v_count + 1;
    END LOOP;
    CLOSE receipt_cursor;
    IF v_count != 40 THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Số biên nhận tạo ra không đủ 40';
    END IF;
    COMMIT;
  END IF;
  SELECT v_count AS receipts_inserted_this_run;
END$$
DELIMITER ;

CALL seed_customer_receipts_curtains_2026();
DROP PROCEDURE seed_customer_receipts_curtains_2026;

-- Dự kiến sau lần đầu: 40 biên nhận và 40 bút toán quỹ tương ứng.
SELECT COUNT(DISTINCT payment.id) AS demo_receipts_present,
       COUNT(entry.id) AS demo_fund_entries_present,
       SUM(payment.amount) AS total_received_vnd
FROM customer_payments AS payment
LEFT JOIN company_fund_entries AS entry
  ON entry.source_type = 'customer_receipt' AND entry.source_id = payment.id
WHERE payment.note LIKE '[DEMO-CURTAIN-RECEIPT-%]%';

SELECT invoice.payment_status, COUNT(*) AS completed_invoices
FROM sales_invoices AS invoice
WHERE invoice.status = 'COMPLETED'
  AND invoice.note LIKE '[DEMO-CURTAIN-SALE-%]%'
GROUP BY invoice.payment_status
ORDER BY invoice.payment_status;

DROP TEMPORARY TABLE tmp_seed_receipt_rows_2026;
DROP TEMPORARY TABLE tmp_seed_receipt_plan_2026;
