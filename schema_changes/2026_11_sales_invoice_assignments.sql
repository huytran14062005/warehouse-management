-- Run after 2026_11_sales_delivery_workflow.sql, against the selected database.
-- Existing active orders are assigned to an eligible employee where possible.
ALTER TABLE sales_invoices
    ADD COLUMN current_assignee_id INT NULL,
    ADD COLUMN assignment_stage VARCHAR(20) NULL,
    ADD COLUMN assigned_at DATETIME NULL,
    ADD COLUMN accepted_at DATETIME NULL,
    ADD COLUMN accounting_handoff_at DATETIME NULL,
    ADD INDEX ix_sales_invoices_current_assignee_id (current_assignee_id),
    ADD CONSTRAINT fk_sales_invoice_current_assignee
        FOREIGN KEY (current_assignee_id) REFERENCES employees(id) ON DELETE RESTRICT;

ALTER TABLE sales_invoice_workflow_events
    ADD COLUMN recipient_id INT NULL,
    ADD INDEX ix_sales_invoice_workflow_recipient (recipient_id),
    ADD CONSTRAINT fk_sales_invoice_workflow_recipient
        FOREIGN KEY (recipient_id) REFERENCES employees(id) ON DELETE RESTRICT;

-- Give older active orders a visible owner where an eligible employee exists.
-- Nobody is marked as having accepted an order by this migration.
UPDATE sales_invoices AS s
SET s.assignment_stage = CASE
        WHEN s.status IN ('PROCESSING', 'DELIVERING') AND s.delivery_method IS NOT NULL THEN 'delivery'
        WHEN s.status = 'DELIVERING' THEN 'delivery'
        ELSE 'warehouse'
    END,
    s.current_assignee_id = CASE
        WHEN s.status IN ('PROCESSING', 'DELIVERING') AND s.delivery_method = 'internal'
            THEN s.delivery_employee_id
        WHEN s.status IN ('PROCESSING', 'DELIVERING') AND s.delivery_method = 'third_party'
            THEN (SELECT e.id FROM employees AS e
                  WHERE e.role = 'QUAN_LY' AND e.is_approved = 1 AND e.is_locked = 0
                  ORDER BY e.id LIMIT 1)
        WHEN s.status = 'DELIVERING' AND s.delivery_method IS NULL
            THEN (SELECT e.id FROM employees AS e
                  WHERE e.role = 'QUAN_LY' AND e.is_approved = 1 AND e.is_locked = 0
                  ORDER BY e.id LIMIT 1)
        ELSE COALESCE(
            (SELECT e.id FROM employees AS e
             WHERE e.role = 'THU_KHO' AND e.warehouse_id = s.warehouse_id
               AND e.is_approved = 1 AND e.is_locked = 0
             ORDER BY e.id LIMIT 1),
            (SELECT e.id FROM employees AS e
             WHERE e.role = 'THU_KHO' AND e.warehouse_id IS NULL
               AND e.is_approved = 1 AND e.is_locked = 0
             ORDER BY e.id LIMIT 1),
            (SELECT e.id FROM employees AS e
             WHERE e.role = 'QUAN_LY' AND e.is_approved = 1 AND e.is_locked = 0
             ORDER BY e.id LIMIT 1)
        )
    END,
    s.assigned_at = NOW()
WHERE (s.status = 'DRAFT' AND s.warehouse_submitted_at IS NOT NULL)
   OR s.status IN ('PROCESSING', 'DELIVERING');

-- Review unassigned rows; managers can use the reassign action in the UI.
SELECT id, status, delivery_method, warehouse_id
FROM sales_invoices
WHERE assignment_stage IS NOT NULL AND current_assignee_id IS NULL;
