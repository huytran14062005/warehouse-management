-- Run once before deploying the combo import API. No new tables are created.
ALTER TABLE import_invoices
    ADD COLUMN combo_groups JSON NULL;

ALTER TABLE import_invoice_items
    ADD COLUMN line_total DECIMAL(14, 2) NULL;
