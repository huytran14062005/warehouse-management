-- Add indexes to an existing MySQL database. Safe to run again if one or both exist.
-- Supports overdue-debt filtering and the assignee's newest-invoices list.
SET @query_due_index_sql = IF(
    (SELECT COUNT(*) FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = 'sales_invoices'
       AND index_name = 'ix_sales_invoices_status_due_date') = 0,
    'ALTER TABLE sales_invoices ADD INDEX ix_sales_invoices_status_due_date (status, payment_due_date)',
    'SELECT 1'
);
PREPARE query_due_index_statement FROM @query_due_index_sql;
EXECUTE query_due_index_statement;
DEALLOCATE PREPARE query_due_index_statement;

SET @query_assignee_index_sql = IF(
    (SELECT COUNT(*) FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = 'sales_invoices'
       AND index_name = 'ix_sales_invoices_assignee_date') = 0,
    'ALTER TABLE sales_invoices ADD INDEX ix_sales_invoices_assignee_date (current_assignee_id, sold_at, id)',
    'SELECT 1'
);
PREPARE query_assignee_index_statement FROM @query_assignee_index_sql;
EXECUTE query_assignee_index_statement;
DEALLOCATE PREPARE query_assignee_index_statement;
