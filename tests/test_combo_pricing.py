import unittest
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import patch

from web import app
from web.models import Product, ProductCombo
from web.services.exceptions import ValidationError
from web.services.product_combo_service import _validate_sale_price
from web.services.sales_invoice_service import _validate_sales_items


class FakeQuery:
    def __init__(self, rows):
        self.rows = rows

    def options(self, *args):
        return self

    def filter(self, *args):
        return self

    def all(self):
        return self.rows


class ComboPricingTests(unittest.TestCase):
    def setUp(self):
        self.products = [
            SimpleNamespace(id=1, name="Cây", default_sale_price=Decimal("195000")),
            SimpleNamespace(id=2, name="Bát", default_sale_price=Decimal("1200")),
        ]
        self.combo = SimpleNamespace(
            id=7, name="Bộ rèm", items=[
                SimpleNamespace(product_id=1, quantity=1),
                SimpleNamespace(product_id=2, quantity=10),
            ],
        )

    def validate(self, items):
        with app.app_context(), patch.object(Product, "query", FakeQuery(self.products)), \
                patch.object(ProductCombo, "query", FakeQuery([self.combo])):
            return _validate_sales_items(items)

    def test_combo_price_can_exceed_previous_tolerance(self):
        self.assertEqual(_validate_sale_price(408480), Decimal("408480"))
        self.assertEqual(_validate_sale_price(900000), Decimal("900000"))
        items = [
            {"product_id": 1, "quantity": 2, "unit_price": 160000, "combo_id": 7},
            {"product_id": 2, "quantity": 20, "unit_price": 500, "combo_id": 7},
        ]
        self.assertEqual(len(self.validate(items)), 2)

    def test_standalone_price_still_has_ten_percent_limit(self):
        with self.assertRaisesRegex(ValidationError, "10%"):
            self.validate([{"product_id": 1, "quantity": 1, "unit_price": 160000}])

    def test_combo_marker_requires_complete_configured_contents(self):
        with self.assertRaisesRegex(ValidationError, "Thành phần combo"):
            self.validate([{"product_id": 1, "quantity": 1, "unit_price": 160000, "combo_id": 7}])
        with self.assertRaisesRegex(ValidationError, "Số lượng combo"):
            self.validate([
                {"product_id": 1, "quantity": 1, "unit_price": 160000, "combo_id": 7},
                {"product_id": 2, "quantity": 9, "unit_price": 500, "combo_id": 7},
            ])


if __name__ == "__main__":
    unittest.main()
