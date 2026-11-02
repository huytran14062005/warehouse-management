import unittest
from datetime import datetime
from types import SimpleNamespace

from web.services.product_profit import (
    calculate_product_profit_rows,
    summarize_product_profit,
)


def sale(invoice_id, line_id, product_id, quantity, price, sold_at,
         discount=0, shipping=0, charged=False):
    return SimpleNamespace(
        invoice_id=invoice_id, line_id=line_id, product_id=product_id,
        product_name=f"Product {product_id}", unit="piece",
        quantity=quantity, unit_price=price, sold_at=sold_at,
        discount_amount=discount, delivery_method="third_party" if shipping else "internal",
        shipping_fee=shipping,
        shipping_charged_at=sold_at if charged else None,
    )


def purchase(import_id, product_id, quantity, price, imported_at):
    return SimpleNamespace(
        import_id=import_id, import_line_id=import_id, product_id=product_id,
        quantity=quantity, unit_price=price, imported_at=imported_at,
    )


class ProductProfitTest(unittest.TestCase):
    def test_discount_shipping_and_cost_are_allocated_by_sales_value(self):
        day = datetime(2026, 1, 2)
        rows = calculate_product_profit_rows(
            [
                sale(1, 1, 1, 2, 100, day, discount=30, shipping=15, charged=True),
                sale(1, 2, 2, 1, 100, day, discount=30, shipping=15, charged=True),
            ],
            [
                purchase(1, 1, 10, 50, datetime(2026, 1, 1)),
                purchase(2, 2, 10, 30, datetime(2026, 1, 1)),
            ],
        )
        by_id = {row["product_id"]: row for row in rows}
        self.assertEqual(by_id[1]["net_revenue"], 180)
        self.assertEqual(by_id[1]["estimated_cogs"], 100)
        self.assertEqual(by_id[1]["shipping_cost"], 10)
        self.assertEqual(by_id[1]["estimated_profit"], 70)
        self.assertEqual(by_id[2]["net_revenue"], 90)
        self.assertEqual(by_id[2]["estimated_cogs"], 30)
        self.assertEqual(by_id[2]["shipping_cost"], 5)
        self.assertEqual(by_id[2]["estimated_profit"], 55)
        self.assertEqual(summarize_product_profit(rows)["estimated_profit_priced"], 125)

    def test_purchase_cost_uses_only_imports_recorded_by_each_sale(self):
        rows = calculate_product_profit_rows(
            [
                sale(1, 1, 1, 1, 100, datetime(2026, 1, 2)),
                sale(2, 2, 1, 1, 100, datetime(2026, 1, 4)),
            ],
            [
                purchase(1, 1, 1, 10, datetime(2026, 1, 1)),
                purchase(2, 1, 1, 30, datetime(2026, 1, 3)),
                purchase(3, 1, 1, 900, datetime(2026, 1, 5)),
            ],
        )
        self.assertEqual(rows[0]["estimated_cogs"], 30)
        self.assertEqual(rows[0]["estimated_profit"], 170)

    def test_missing_purchase_cost_is_not_treated_as_zero(self):
        day = datetime(2026, 1, 2)
        rows = calculate_product_profit_rows(
            [sale(1, 1, 1, 1, 100, day, shipping=10, charged=False)],
            [purchase(1, 1, 1, 50, datetime(2026, 1, 3))],
        )
        self.assertIsNone(rows[0]["estimated_cogs"])
        self.assertIsNone(rows[0]["estimated_profit"])
        self.assertEqual(rows[0]["shipping_cost"], 0)
        self.assertEqual(rows[0]["missing_cost_quantity"], 1)
        summary = summarize_product_profit(rows)
        self.assertEqual(summary["missing_cost_products"], 1)
        self.assertEqual(summary["estimated_profit_priced"], 0)

    def test_rounded_allocations_preserve_invoice_totals(self):
        day = datetime(2026, 1, 2)
        rows = calculate_product_profit_rows(
            [
                sale(1, index, index, 1, 100, day, discount=1, shipping=1, charged=True)
                for index in range(1, 4)
            ],
            [
                purchase(index, index, 1, 40, datetime(2026, 1, 1))
                for index in range(1, 4)
            ],
        )
        self.assertAlmostEqual(sum(row["discount"] for row in rows), 1)
        self.assertAlmostEqual(sum(row["shipping_cost"] for row in rows), 1)
        self.assertAlmostEqual(sum(row["estimated_profit"] for row in rows), 178)


if __name__ == "__main__":
    unittest.main()
