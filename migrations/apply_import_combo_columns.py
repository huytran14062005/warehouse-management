"""Add the two import combo columns to an existing MySQL database, once."""

from sqlalchemy import inspect

from web import app, db


def apply():
    with app.app_context():
        if db.engine.dialect.name != "mysql":
            raise RuntimeError("This migration is for the configured MySQL database")
        inspector = inspect(db.engine)
        additions = (
            ("import_invoices", "combo_groups", "JSON NULL"),
            ("import_invoice_items", "line_total", "DECIMAL(14, 2) NULL"),
        )
        for table, column, definition in additions:
            if not inspector.has_table(table):
                raise RuntimeError(f"Required table is missing: {table}")
            existing = {item["name"] for item in inspector.get_columns(table)}
            if column in existing:
                print(f"{table}.{column}: already present")
                continue
            with db.engine.begin() as connection:
                connection.exec_driver_sql(
                    f"ALTER TABLE `{table}` ADD COLUMN `{column}` {definition}"
                )
            print(f"{table}.{column}: added")

        inspector = inspect(db.engine)
        for table, column, _ in additions:
            if column not in {item["name"] for item in inspector.get_columns(table)}:
                raise RuntimeError(f"Migration verification failed: {table}.{column}")
        print("Import combo schema is ready")


if __name__ == "__main__":
    apply()
