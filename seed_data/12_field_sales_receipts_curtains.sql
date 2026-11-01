-- Phần 12: 100 biên nhận cho 80/100 đơn bán từ hàng nhân viên của phần 9.
-- 20 đơn chưa thu, 20 đơn thu một phần, 40 đơn thu đủ một lần,
-- 20 đơn thu đủ qua hai lần. Có cả tiền mặt và chuyển khoản.
-- Kế toán ghi biên nhận cùng lúc với trạng thái đơn, công nợ khách và sổ quỹ.
-- Nếu sổ quỹ chưa được khởi tạo, tạo hai quỹ với số dư ban đầu BẰNG 0;
-- nếu đã khởi tạo, giữ nguyên số dư và chỉ cộng các khoản thu mới.
-- Chạy toàn bộ file trên MySQL Workbench. Chạy lại không thu tiền trùng.

SET NAMES utf8mb4;

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

DROP TEMPORARY TABLE IF EXISTS tmp_seed_field_receipt_rows_2026;
DROP TEMPORARY TABLE IF EXISTS tmp_seed_field_receipt_plan_2026;

CREATE TEMPORARY TABLE tmp_seed_field_receipt_plan_2026 (
  invoice_no SMALLINT NOT NULL PRIMARY KEY,
  strategy VARCHAR(8) NOT NULL
);

INSERT INTO tmp_seed_field_receipt_plan_2026 (invoice_no, strategy) VALUES
  (1, 'PARTIAL'),
  (2, 'FULL'),
  (3, 'FULL'),
  (4, 'TWO'),
  (5, 'UNPAID'),
  (6, 'PARTIAL'),
  (7, 'FULL'),
  (8, 'FULL'),
  (9, 'TWO'),
  (10, 'UNPAID'),
  (11, 'PARTIAL'),
  (12, 'FULL'),
  (13, 'FULL'),
  (14, 'TWO'),
  (15, 'UNPAID'),
  (16, 'PARTIAL'),
  (17, 'FULL'),
  (18, 'FULL'),
  (19, 'TWO'),
  (20, 'UNPAID'),
  (21, 'PARTIAL'),
  (22, 'FULL'),
  (23, 'FULL'),
  (24, 'TWO'),
  (25, 'UNPAID'),
  (26, 'PARTIAL'),
  (27, 'FULL'),
  (28, 'FULL'),
  (29, 'TWO'),
  (30, 'UNPAID'),
  (31, 'PARTIAL'),
  (32, 'FULL'),
  (33, 'FULL'),
  (34, 'TWO'),
  (35, 'UNPAID'),
  (36, 'PARTIAL'),
  (37, 'FULL'),
  (38, 'FULL'),
  (39, 'TWO'),
  (40, 'UNPAID'),
  (41, 'PARTIAL'),
  (42, 'FULL'),
  (43, 'FULL'),
  (44, 'TWO'),
  (45, 'UNPAID'),
  (46, 'PARTIAL'),
  (47, 'FULL'),
  (48, 'FULL'),
  (49, 'TWO'),
  (50, 'UNPAID'),
  (51, 'PARTIAL'),
  (52, 'FULL'),
  (53, 'FULL'),
  (54, 'TWO'),
  (55, 'UNPAID'),
  (56, 'PARTIAL'),
  (57, 'FULL'),
  (58, 'FULL'),
  (59, 'TWO'),
  (60, 'UNPAID'),
  (61, 'PARTIAL'),
  (62, 'FULL'),
  (63, 'FULL'),
  (64, 'TWO'),
  (65, 'UNPAID'),
  (66, 'PARTIAL'),
  (67, 'FULL'),
  (68, 'FULL'),
  (69, 'TWO'),
  (70, 'UNPAID'),
  (71, 'PARTIAL'),
  (72, 'FULL'),
  (73, 'FULL'),
  (74, 'TWO'),
  (75, 'UNPAID'),
  (76, 'PARTIAL'),
  (77, 'FULL'),
  (78, 'FULL'),
  (79, 'TWO'),
  (80, 'UNPAID'),
  (81, 'PARTIAL'),
  (82, 'FULL'),
  (83, 'FULL'),
  (84, 'TWO'),
  (85, 'UNPAID'),
  (86, 'PARTIAL'),
  (87, 'FULL'),
  (88, 'FULL'),
  (89, 'TWO'),
  (90, 'UNPAID'),
  (91, 'PARTIAL'),
  (92, 'FULL'),
  (93, 'FULL'),
  (94, 'TWO'),
  (95, 'UNPAID'),
  (96, 'PARTIAL'),
  (97, 'FULL'),
  (98, 'FULL'),
  (99, 'TWO'),
  (100, 'UNPAID');

CREATE TEMPORARY TABLE tmp_seed_field_receipt_rows_2026 (
  invoice_no SMALLINT NOT NULL,
  part_no TINYINT NOT NULL,
  invoice_id INT NOT NULL,
  customer_id INT NOT NULL,
  invoice_total DECIMAL(14,2) NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  method VARCHAR(20) NOT NULL,
  PRIMARY KEY (invoice_no, part_no)
);

INSERT INTO tmp_seed_field_receipt_rows_2026
  (invoice_no, part_no, invoice_id, customer_id, invoice_total, amount, method)
SELECT plan.invoice_no, part.part_no, invoice.id, invoice.customer_id,
       totals.total_amount,
       CASE
         WHEN plan.strategy = 'PARTIAL' OR
              (plan.strategy = 'TWO' AND part.part_no = 1)
           THEN ROUND(totals.total_amount * 0.4, -3)
         WHEN plan.strategy = 'TWO' AND part.part_no = 2
           THEN totals.total_amount - ROUND(totals.total_amount * 0.4, -3)
         ELSE totals.total_amount
       END,
       IF(MOD(plan.invoice_no + part.part_no, 2) = 0,
          'cash', 'bank_transfer')
FROM tmp_seed_field_receipt_plan_2026 AS plan
JOIN sales_invoices AS invoice
  ON invoice.note LIKE CONCAT('[DEMO-CURTAIN-FIELD-SALE-',
                              LPAD(plan.invoice_no, 3, '0'), ']%')
JOIN (
  SELECT sales_invoice_id, SUM(quantity * unit_price) AS total_amount
  FROM sales_invoice_items GROUP BY sales_invoice_id
) AS totals ON totals.sales_invoice_id = invoice.id
CROSS JOIN (SELECT 1 AS part_no UNION ALL SELECT 2) AS part
WHERE invoice.status = 'COMPLETED'
  AND invoice.sale_source = 'EMPLOYEE_STOCK'
  AND invoice.paid_amount = 0
  AND invoice.discount_amount = 0
  AND plan.strategy != 'UNPAID'
  AND (plan.strategy = 'TWO' OR part.part_no = 1);

SET @accountant_id = (
  SELECT id FROM employees
  WHERE role = 'KE_TOAN' AND is_approved = 1 AND is_locked = 0
  ORDER BY id LIMIT 1
);
SET @manager_id = (
  SELECT id FROM employees
  WHERE role = 'QUAN_LY' AND is_approved = 1 AND is_locked = 0
  ORDER BY id LIMIT 1
);
SET @fund_count = (SELECT COUNT(*) FROM company_funds);
SET @fund_method_count = (
  SELECT COUNT(*) FROM company_funds
  WHERE method IN ('cash', 'bank_transfer')
);
SET @plan_count = (SELECT COUNT(*) FROM tmp_seed_field_receipt_plan_2026);
SET @field_sale_count = (
  SELECT COUNT(*) FROM sales_invoices
  WHERE note LIKE '[DEMO-CURTAIN-FIELD-SALE-%]%'
    AND status = 'COMPLETED' AND sale_source = 'EMPLOYEE_STOCK'
);
SET @receipt_count = (SELECT COUNT(*) FROM tmp_seed_field_receipt_rows_2026);
SET @receipt_invoice_count = (
  SELECT COUNT(DISTINCT invoice_id) FROM tmp_seed_field_receipt_rows_2026
);
SET @invalid_rows = (
  SELECT COUNT(*) FROM tmp_seed_field_receipt_rows_2026
  WHERE amount < 500 OR method NOT IN ('cash', 'bank_transfer')
);
SET @overpaid_invoices = (
  SELECT COUNT(*) FROM (
    SELECT invoice_id, MAX(invoice_total) AS invoice_total, SUM(amount) AS proposed
    FROM tmp_seed_field_receipt_rows_2026 GROUP BY invoice_id
  ) AS proposal
  WHERE proposal.proposed > proposal.invoice_total
);
SET @insufficient_customer_debt = (
  SELECT COUNT(*) FROM (
    SELECT customer_id, SUM(amount) AS proposed
    FROM tmp_seed_field_receipt_rows_2026 GROUP BY customer_id
  ) AS proposal
  JOIN customers AS customer ON customer.id = proposal.customer_id
  WHERE proposal.proposed > customer.debt_amount
);
SET @existing_demo_receipts = (
  SELECT COUNT(*) FROM customer_payments
  WHERE note LIKE '[DEMO-CURTAIN-FIELD-RECEIPT-%]%'
);
SET @can_seed_field_receipts = (
  @accountant_id IS NOT NULL AND @manager_id IS NOT NULL
  AND (@fund_count = 0 OR (@fund_count = 2 AND @fund_method_count = 2))
  AND @plan_count = 100 AND @field_sale_count = 100
  AND @receipt_count = 100 AND @receipt_invoice_count = 80
  AND @invalid_rows = 0 AND @overpaid_invoices = 0
  AND @insufficient_customer_debt = 0 AND @existing_demo_receipts = 0
);

SELECT @fund_count AS existing_funds,
       @receipt_count AS planned_receipts,
       @receipt_invoice_count AS invoices_to_collect,
       @insufficient_customer_debt AS customer_debt_shortages,
       @existing_demo_receipts AS already_imported_receipts,
       @can_seed_field_receipts AS ready_to_insert;

DROP PROCEDURE IF EXISTS seed_field_sales_receipts_curtains_2026;
DELIMITER $$
CREATE PROCEDURE seed_field_sales_receipts_curtains_2026()
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
    FROM tmp_seed_field_receipt_rows_2026 ORDER BY invoice_no, part_no;
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done = 1;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  IF @can_seed_field_receipts = 1 THEN
    START TRANSACTION;
    IF @fund_count = 0 THEN
      INSERT INTO company_funds
        (method, opening_balance, balance, opened_at, opened_by_id)
      VALUES ('cash', 0, 0, NOW(), @manager_id),
             ('bank_transfer', 0, 0, NOW(), @manager_id);
    END IF;
    SELECT balance INTO v_balance FROM company_funds
    WHERE method = 'cash' FOR UPDATE;
    SELECT balance INTO v_balance FROM company_funds
    WHERE method = 'bank_transfer' FOR UPDATE;

    OPEN receipt_cursor;
    receipt_loop: LOOP
      FETCH receipt_cursor INTO v_invoice_no, v_part_no, v_invoice_id,
        v_customer_id, v_total, v_amount, v_method;
      IF v_done = 1 THEN LEAVE receipt_loop; END IF;

      INSERT INTO customer_payments
        (amount, payment_type, payment_method, paid_at, note,
         customer_id, sales_invoice_id, employee_id)
      VALUES
        (v_amount, 'INVOICE', v_method, NOW(),
         CONCAT('[DEMO-CURTAIN-FIELD-RECEIPT-', LPAD(v_invoice_no, 3, '0'),
                '-', v_part_no, '] Thu tiền đơn bán từ hàng nhân viên'),
         v_customer_id, v_invoice_id, @accountant_id);
      SET v_payment_id = LAST_INSERT_ID();

      UPDATE sales_invoices SET paid_amount = paid_amount + v_amount
      WHERE id = v_invoice_id AND status = 'COMPLETED'
        AND paid_amount + v_amount <= v_total;
      IF ROW_COUNT() != 1 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Số tiền thu vượt số còn nợ của đơn';
      END IF;
      UPDATE sales_invoices
      SET payment_status = IF(paid_amount >= v_total, 'PAID', 'PARTIAL'),
          payment_due_date = IF(paid_amount >= v_total, NULL, payment_due_date)
      WHERE id = v_invoice_id;

      UPDATE customers SET debt_amount = debt_amount - v_amount
      WHERE id = v_customer_id AND debt_amount >= v_amount;
      IF ROW_COUNT() != 1 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Công nợ khách hàng không đủ để thu';
      END IF;

      UPDATE company_funds SET balance = balance + v_amount
      WHERE method = v_method;
      IF ROW_COUNT() != 1 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Thiếu quỹ tiền mặt hoặc chuyển khoản';
      END IF;
      SELECT balance INTO v_balance FROM company_funds WHERE method = v_method;

      INSERT INTO company_fund_entries
        (method, direction, entry_type, amount, balance_after, occurred_at,
         source_type, source_id, description, employee_id, note)
      VALUES
        (v_method, 'in', 'customer_receipt', v_amount, v_balance, NOW(),
         'customer_receipt', v_payment_id,
         CONCAT('Thu tiền đơn bán #', v_invoice_id), @accountant_id,
         CONCAT('[DEMO-CURTAIN-FIELD-RECEIPT-',
                LPAD(v_invoice_no, 3, '0'), '-', v_part_no, ']'));
      SET v_count = v_count + 1;
    END LOOP;
    CLOSE receipt_cursor;
    IF v_count != 100 THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Số biên nhận tạo ra không đủ 100';
    END IF;
    COMMIT;
  END IF;
  SELECT v_count AS receipts_inserted_this_run;
END$$
DELIMITER ;

CALL seed_field_sales_receipts_curtains_2026();
DROP PROCEDURE seed_field_sales_receipts_curtains_2026;

-- Lần đầu kỳ vọng: 100 biên nhận và 100 bút toán thu quỹ.
SELECT COUNT(DISTINCT payment.id) AS demo_receipts_present,
       COUNT(entry.id) AS demo_fund_entries_present,
       COALESCE(SUM(payment.amount), 0) AS total_received_vnd
FROM customer_payments AS payment
LEFT JOIN company_fund_entries AS entry
  ON entry.source_type = 'customer_receipt' AND entry.source_id = payment.id
WHERE payment.note LIKE '[DEMO-CURTAIN-FIELD-RECEIPT-%]%';

SELECT invoice.payment_status, COUNT(*) AS field_invoices
FROM sales_invoices AS invoice
WHERE invoice.note LIKE '[DEMO-CURTAIN-FIELD-SALE-%]%'
GROUP BY invoice.payment_status ORDER BY invoice.payment_status;

DROP TEMPORARY TABLE tmp_seed_field_receipt_rows_2026;
DROP TEMPORARY TABLE tmp_seed_field_receipt_plan_2026;
