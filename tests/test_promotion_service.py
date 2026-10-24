import os
import unittest
from decimal import Decimal


os.environ["APP_ENV"] = "development"
os.environ["DATABASE_URL"] = "sqlite:///:memory:"

from web import app, db  # noqa: E402
from web.services.promotion_service import (  # noqa: E402
    build_promotion_note,
    create_promotion,
    delete_promotion,
    evaluate_promotion,
    list_promotions,
    promotion_snapshot_from_note,
)
from web.models import DiscountStatus  # noqa: E402
from web.services.sales_invoice_service import determine_discount_status  # noqa: E402


class PromotionServiceTest(unittest.TestCase):
    def setUp(self):
        self.context = app.app_context()
        self.context.push()
        db.create_all()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.context.pop()

    def test_quantity_promotion_requires_minimum_quantity(self):
        promotion = create_promotion(
            {
                "name": "Mua 10 sản phẩm",
                "condition_type": "min_quantity",
                "min_quantity": 10,
                "discount_type": "fixed_amount",
                "discount_value": 100000,
            },
            employee_id=1,
        )

        eligible, discount, _ = evaluate_promotion(promotion, 2000000, 9)
        self.assertFalse(eligible)
        self.assertEqual(discount, Decimal("0"))

        eligible, discount, _ = evaluate_promotion(promotion, 2000000, 10)
        self.assertTrue(eligible)
        self.assertEqual(discount, Decimal("100000.00"))

    def test_percentage_promotion_respects_maximum_discount(self):
        promotion = create_promotion(
            {
                "name": "Đơn từ 5 triệu",
                "condition_type": "min_order_amount",
                "min_order_amount": 5000000,
                "discount_type": "percentage",
                "discount_value": 10,
                "max_discount_amount": 300000,
            },
            employee_id=1,
        )

        eligible, discount, _ = evaluate_promotion(promotion, 6000000, 1)
        self.assertTrue(eligible)
        self.assertEqual(discount, Decimal("300000.00"))

    def test_delete_hides_promotion_from_active_list(self):
        promotion = create_promotion(
            {
                "name": "Ngày lễ",
                "condition_type": "holiday",
                "start_date": "2026-01-01",
                "end_date": "2026-12-31",
                "discount_type": "fixed_amount",
                "discount_value": 50000,
            },
            employee_id=1,
        )
        delete_promotion(promotion.id)
        self.assertEqual(list_promotions(), [])

        snapshot = promotion_snapshot_from_note(
            build_promotion_note(promotion, Decimal("50000"))
        )
        self.assertEqual(snapshot["name"], "Ngày lễ")
        self.assertEqual(snapshot["calculated_discount"], 50000.0)

    def test_manager_defined_promotion_is_preapproved(self):
        status = determine_discount_status(
            Decimal("6000000"),
            Decimal("500000"),
            is_promotion=True,
        )
        self.assertEqual(status, DiscountStatus.AUTO_APPROVED)


if __name__ == "__main__":
    unittest.main()
