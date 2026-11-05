"""Contracts for helpers shared by multiple backend services and DAOs."""

import os
import unittest

os.environ["DATABASE_URL"] = "sqlite://"

from web import app, db  # noqa: E402
from web.models import Product  # noqa: E402
from web.services.exceptions import ValidationError  # noqa: E402
from web.services.validators import (  # noqa: E402
    validate_coercible_positive_integer,
    validate_positive_number,
    validate_strict_positive_integer,
)
from web.utils.pagination import apply_pagination  # noqa: E402


class SharedBackendHelpersTests(unittest.TestCase):
    def test_positive_number_validation_keeps_strict_and_legacy_integer_rules(self):
        self.assertEqual(validate_positive_number("2.5", "quantity"), 2.5)
        self.assertEqual(validate_strict_positive_integer(2.0, "quantity"), 2)
        with self.assertRaises(ValidationError):
            validate_strict_positive_integer(2.5, "quantity")
        with self.assertRaises(ValidationError):
            validate_coercible_positive_integer(True, "product ID")
        self.assertEqual(validate_coercible_positive_integer(2.5, "product ID"), 2)

    def test_shared_dao_pagination_returns_total_and_page(self):
        with app.app_context():
            db.create_all()
            try:
                db.session.add_all([
                    Product(id=index, name=f"Product {index}", unit="item", default_sale_price=0)
                    for index in range(1, 4)
                ])
                db.session.commit()
                page_query, total = apply_pagination(Product.query.order_by(Product.id), 2, 2)
                self.assertEqual(total, 3)
                self.assertEqual([product.id for product in page_query.all()], [3])
            finally:
                db.session.remove()
                db.drop_all()


if __name__ == "__main__":
    unittest.main()
