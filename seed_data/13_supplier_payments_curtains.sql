-- Phần 13: 100 lần trả tiền cho 80/100 phiếu nhập hàng rèm cửa của phần 4.
-- 20 phiếu chưa trả, 50 phiếu trả một phần, 10 phiếu trả đủ,
-- 20 phiếu có hai lần trả một phần. Có cả tiền mặt và chuyển khoản.
-- Mỗi khoản trả được kế toán ghi cùng lúc với bút toán chi quỹ.
-- Chỉ chạy khi số dư quỹ hiện tại đủ; không tự tạo hoặc chỉnh số dư quỹ ban đầu.
-- Chạy toàn bộ file trong MySQL Workbench. Chạy lại không trả trùng.

SET NAMES utf8mb4;

DROP TEMPORARY TABLE IF EXISTS tmp_seed_supplier_pay_rows_2026;
DROP TEMPORARY TABLE IF EXISTS tmp_seed_supplier_pay_plan_2026;

CREATE TEMPORARY TABLE tmp_seed_supplier_pay_plan_2026 (
  invoice_no SMALLINT NOT NULL PRIMARY KEY,
  strategy VARCHAR(8) NOT NULL
);

INSERT INTO tmp_seed_supplier_pay_plan_2026 (invoice_no, strategy) VALUES
  (1, 'TWO'),
  (2, 'TWO'),
  (3, 'TWO'),
  (4, 'TWO'),
  (5, 'TWO'),
  (6, 'TWO'),
  (7, 'TWO'),
  (8, 'TWO'),
  (9, 'TWO'),
  (10, 'TWO'),
  (11, 'TWO'),
  (12, 'TWO'),
  (13, 'TWO'),
  (14, 'TWO'),
  (15, 'TWO'),
  (16, 'TWO'),
  (17, 'TWO'),
  (18, 'TWO'),
  (19, 'TWO'),
  (20, 'TWO'),
  (21, 'PARTIAL'),
  (22, 'PARTIAL'),
  (23, 'PARTIAL'),
  (24, 'PARTIAL'),
  (25, 'PARTIAL'),
  (26, 'PARTIAL'),
  (27, 'PARTIAL'),
  (28, 'PARTIAL'),
  (29, 'PARTIAL'),
  (30, 'PARTIAL'),
  (31, 'PARTIAL'),
  (32, 'PARTIAL'),
  (33, 'PARTIAL'),
  (34, 'PARTIAL'),
  (35, 'PARTIAL'),
  (36, 'PARTIAL'),
  (37, 'PARTIAL'),
  (38, 'PARTIAL'),
  (39, 'PARTIAL'),
  (40, 'PARTIAL'),
  (41, 'PARTIAL'),
  (42, 'PARTIAL'),
  (43, 'PARTIAL'),
  (44, 'PARTIAL'),
  (45, 'PARTIAL'),
  (46, 'PARTIAL'),
  (47, 'PARTIAL'),
  (48, 'PARTIAL'),
  (49, 'PARTIAL'),
  (50, 'PARTIAL'),
  (51, 'PARTIAL'),
  (52, 'PARTIAL'),
  (53, 'PARTIAL'),
  (54, 'PARTIAL'),
  (55, 'PARTIAL'),
  (56, 'PARTIAL'),
  (57, 'PARTIAL'),
  (58, 'FULL'),
  (59, 'PARTIAL'),
  (60, 'PARTIAL'),
  (61, 'PARTIAL'),
  (62, 'PARTIAL'),
  (63, 'PARTIAL'),
  (64, 'PARTIAL'),
  (65, 'PARTIAL'),
  (66, 'PARTIAL'),
  (67, 'PARTIAL'),
  (68, 'PARTIAL'),
  (69, 'PARTIAL'),
  (70, 'PARTIAL'),
  (71, 'PARTIAL'),
  (72, 'FULL'),
  (73, 'FULL'),
  (74, 'FULL'),
  (75, 'FULL'),
  (76, 'UNPAID'),
  (77, 'UNPAID'),
  (78, 'UNPAID'),
  (79, 'UNPAID'),
  (80, 'UNPAID'),
  (81, 'UNPAID'),
  (82, 'UNPAID'),
  (83, 'UNPAID'),
  (84, 'FULL'),
  (85, 'FULL'),
  (86, 'FULL'),
  (87, 'UNPAID'),
  (88, 'UNPAID'),
  (89, 'UNPAID'),
  (90, 'UNPAID'),
  (91, 'UNPAID'),
  (92, 'UNPAID'),
  (93, 'UNPAID'),
  (94, 'FULL'),
  (95, 'UNPAID'),
  (96, 'UNPAID'),
  (97, 'UNPAID'),
  (98, 'UNPAID'),
  (99, 'FULL'),
  (100, 'UNPAID');

CREATE TEMPORARY TABLE tmp_seed_supplier_pay_rows_2026 (
  invoice_no SMALLINT NOT NULL,
  part_no TINYINT NOT NULL,
  invoice_id INT NOT NULL,
  supplier_id INT NOT NULL,
  invoice_total DECIMAL(14,2) NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  method VARCHAR(20) NOT NULL,
  PRIMARY KEY (invoice_no, part_no)
);

INSERT INTO tmp_seed_supplier_pay_rows_2026
  (invoice_no, part_no, invoice_id, supplier_id, invoice_total, amount, method)
SELECT plan.invoice_no, part.part_no, invoice.id, invoice.supplier_id,
       totals.total_amount,
       CASE WHEN plan.strategy = 'FULL' THEN totals.total_amount
            WHEN plan.strategy = 'TWO' AND part.part_no = 2 THEN 50000
            ELSE CASE MOD(plan.invoice_no, 4)
                   WHEN 0 THEN 150000 WHEN 1 THEN 100000
                   WHEN 2 THEN 75000 ELSE 125000 END
       END,
       IF(MOD(plan.invoice_no + part.part_no, 2) = 0,
          'cash', 'bank_transfer')
FROM tmp_seed_supplier_pay_plan_2026 AS plan
JOIN import_invoices AS invoice
  ON invoice.note = CONCAT('[DEMO-CURTAIN-IMPORT-',
                           LPAD(plan.invoice_no, 3, '0'), '] Nhập hàng mẫu')
JOIN (
  SELECT import_invoice_id, SUM(quantity * unit_price) AS total_amount
  FROM import_invoice_items GROUP BY import_invoice_id
) AS totals ON totals.import_invoice_id = invoice.id
CROSS JOIN (SELECT 1 AS part_no UNION ALL SELECT 2) AS part
WHERE plan.strategy != 'UNPAID'
  AND (plan.strategy = 'TWO' OR part.part_no = 1);

SET @accountant_id = (
  SELECT id FROM employees
  WHERE role = 'KE_TOAN' AND is_approved = 1 AND is_locked = 0
  ORDER BY id LIMIT 1
);
SET @plan_count = (SELECT COUNT(*) FROM tmp_seed_supplier_pay_plan_2026);
SET @import_count = (
  SELECT COUNT(*) FROM import_invoices
  WHERE note LIKE '[DEMO-CURTAIN-IMPORT-%] Nhập hàng mẫu'
);
SET @pay_row_count = (SELECT COUNT(*) FROM tmp_seed_supplier_pay_rows_2026);
SET @pay_invoice_count = (
  SELECT COUNT(DISTINCT invoice_id) FROM tmp_seed_supplier_pay_rows_2026
);
SET @invalid_rows = (
  SELECT COUNT(*) FROM tmp_seed_supplier_pay_rows_2026
  WHERE amount < 500 OR method NOT IN ('cash', 'bank_transfer')
);
SET @overpaid_invoices = (
  SELECT COUNT(*) FROM (
    SELECT invoice_id, MAX(invoice_total) AS total_due, SUM(amount) AS proposed
    FROM tmp_seed_supplier_pay_rows_2026 GROUP BY invoice_id
  ) AS proposal WHERE proposal.proposed > proposal.total_due
);
SET @already_paid_invoices = (
  SELECT COUNT(DISTINCT row_data.invoice_id)
  FROM tmp_seed_supplier_pay_rows_2026 AS row_data
  JOIN supplier_payments AS existing
    ON existing.import_invoice_id = row_data.invoice_id
);
SET @existing_demo_payments = (
  SELECT COUNT(*) FROM supplier_payments
  WHERE note LIKE '[DEMO-CURTAIN-SUPPLIER-PAY-%]%'
);
SET @fund_count = (
  SELECT COUNT(*) FROM company_funds
  WHERE method IN ('cash', 'bank_transfer')
);
SET @cash_balance = (
  SELECT balance FROM company_funds WHERE method = 'cash'
);
SET @bank_balance = (
  SELECT balance FROM company_funds WHERE method = 'bank_transfer'
);
SET @cash_needed = (
  SELECT COALESCE(SUM(amount), 0) FROM tmp_seed_supplier_pay_rows_2026
  WHERE method = 'cash'
);
SET @bank_needed = (
  SELECT COALESCE(SUM(amount), 0) FROM tmp_seed_supplier_pay_rows_2026
  WHERE method = 'bank_transfer'
);
SET @can_seed_supplier_payments = (
  @accountant_id IS NOT NULL
  AND @plan_count = 100 AND @import_count = 100
  AND @pay_row_count = 100 AND @pay_invoice_count = 80
  AND @invalid_rows = 0 AND @overpaid_invoices = 0
  AND @already_paid_invoices = 0 AND @existing_demo_payments = 0
  AND @fund_count = 2
  AND @cash_balance >= @cash_needed
  AND @bank_balance >= @bank_needed
);

SELECT @pay_row_count AS planned_payments,
       @pay_invoice_count AS invoices_to_pay,
       @already_paid_invoices AS invoices_with_existing_payments,
       @cash_balance AS cash_balance,
       @cash_needed AS cash_needed,
       @bank_balance AS bank_balance,
       @bank_needed AS bank_needed,
       @can_seed_supplier_payments AS ready_to_insert;

DROP PROCEDURE IF EXISTS seed_supplier_payments_curtains_2026;
DELIMITER $$
CREATE PROCEDURE seed_supplier_payments_curtains_2026()
BEGIN
  DECLARE v_done TINYINT DEFAULT 0;
  DECLARE v_count INT DEFAULT 0;
  DECLARE v_invoice_no SMALLINT;
  DECLARE v_part_no TINYINT;
  DECLARE v_invoice_id INT;
  DECLARE v_supplier_id INT;
  DECLARE v_total DECIMAL(14,2);
  DECLARE v_amount DECIMAL(14,2);
  DECLARE v_method VARCHAR(20);
  DECLARE v_payment_id INT;
  DECLARE v_balance DECIMAL(14,2);
  DECLARE pay_cursor CURSOR FOR
    SELECT invoice_no, part_no, invoice_id, supplier_id,
           invoice_total, amount, method
    FROM tmp_seed_supplier_pay_rows_2026 ORDER BY invoice_no, part_no;
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done = 1;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  IF @can_seed_supplier_payments = 1 THEN
    START TRANSACTION;
    SELECT balance INTO v_balance FROM company_funds
    WHERE method = 'cash' FOR UPDATE;
    SELECT balance INTO v_balance FROM company_funds
    WHERE method = 'bank_transfer' FOR UPDATE;

    OPEN pay_cursor;
    pay_loop: LOOP
      FETCH pay_cursor INTO v_invoice_no, v_part_no, v_invoice_id,
        v_supplier_id, v_total, v_amount, v_method;
      IF v_done = 1 THEN LEAVE pay_loop; END IF;

      INSERT INTO supplier_payments
        (amount, payment_method, paid_at, note,
         supplier_id, import_invoice_id, employee_id)
      VALUES
        (v_amount, v_method, NOW(),
         CONCAT('[DEMO-CURTAIN-SUPPLIER-PAY-', LPAD(v_invoice_no, 3, '0'),
                '-', v_part_no, '] Thanh toán phiếu nhập mẫu'),
         v_supplier_id, v_invoice_id, @accountant_id);
      SET v_payment_id = LAST_INSERT_ID();

      UPDATE company_funds SET balance = balance - v_amount
      WHERE method = v_method AND balance >= v_amount;
      IF ROW_COUNT() != 1 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Số dư quỹ không đủ trả nhà cung cấp';
      END IF;
      SELECT balance INTO v_balance FROM company_funds WHERE method = v_method;

      INSERT INTO company_fund_entries
        (method, direction, entry_type, amount, balance_after, occurred_at,
         source_type, source_id, description, employee_id, note)
      VALUES
        (v_method, 'out', 'supplier_payment', v_amount, v_balance, NOW(),
         'supplier_payment', v_payment_id,
         CONCAT('Trả nhà cung cấp · Phiếu nhập #', v_invoice_id),
         @accountant_id,
         CONCAT('[DEMO-CURTAIN-SUPPLIER-PAY-',
                LPAD(v_invoice_no, 3, '0'), '-', v_part_no, ']'));
      SET v_count = v_count + 1;
    END LOOP;
    CLOSE pay_cursor;
    IF v_count != 100 THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Số khoản trả tạo ra không đủ 100';
    END IF;
    COMMIT;
  END IF;
  SELECT v_count AS payments_inserted_this_run;
END$$
DELIMITER ;

CALL seed_supplier_payments_curtains_2026();
DROP PROCEDURE seed_supplier_payments_curtains_2026;

-- Lần đầu kỳ vọng: 100 khoản trả và 100 bút toán chi quỹ.
SELECT COUNT(DISTINCT payment.id) AS demo_supplier_payments_present,
       COUNT(entry.id) AS demo_fund_entries_present,
       COALESCE(SUM(payment.amount), 0) AS total_paid_vnd
FROM supplier_payments AS payment
LEFT JOIN company_fund_entries AS entry
  ON entry.source_type = 'supplier_payment' AND entry.source_id = payment.id
WHERE payment.note LIKE '[DEMO-CURTAIN-SUPPLIER-PAY-%]%';

SELECT CASE WHEN paid.total_paid IS NULL THEN 'UNPAID'
            WHEN paid.total_paid >= totals.total_amount THEN 'PAID'
            ELSE 'PARTIAL' END AS payment_status,
       COUNT(*) AS demo_import_invoices
FROM import_invoices AS invoice
JOIN (
  SELECT import_invoice_id, SUM(quantity * unit_price) AS total_amount
  FROM import_invoice_items GROUP BY import_invoice_id
) AS totals ON totals.import_invoice_id = invoice.id
LEFT JOIN (
  SELECT import_invoice_id, SUM(amount) AS total_paid
  FROM supplier_payments GROUP BY import_invoice_id
) AS paid ON paid.import_invoice_id = invoice.id
WHERE invoice.note LIKE '[DEMO-CURTAIN-IMPORT-%] Nhập hàng mẫu'
GROUP BY payment_status ORDER BY payment_status;

DROP TEMPORARY TABLE tmp_seed_supplier_pay_rows_2026;
DROP TEMPORARY TABLE tmp_seed_supplier_pay_plan_2026;
