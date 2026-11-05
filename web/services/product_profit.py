"""Estimate product contribution from recorded sales and purchase costs.

The purchase cost is the quantity-weighted average of imports recorded by the
sale date. This is a reporting estimate, not a perpetual inventory valuation.
"""

from decimal import Decimal, ROUND_HALF_UP
from itertools import groupby


CENT = Decimal("0.01")


def _money(value):
    return Decimal(str(value or 0))


def _rounded(value):
    return value.quantize(CENT, rounding=ROUND_HALF_UP)


def calculate_product_profit_rows(sale_lines, import_lines):
    """Return one row per product, including missing-cost coverage.

    Both inputs are lightweight rows with named attributes. Completed sales are
    selected by the caller using the report's sale-date filter. Import rows may
    come from any warehouse because product cost is measured company-wide.
    """
    sales = sorted(
        sale_lines,
        key=lambda row: (row.sold_at, row.invoice_id, row.line_id),
    )
    purchases = sorted(
        import_lines,
        key=lambda row: (row.imported_at, row.import_id, row.import_line_id),
    )
    purchase_index = 0
    purchase_totals = {}
    products = {}

    for _, invoice_group in groupby(sales, key=lambda row: row.invoice_id):
        lines = list(invoice_group)
        invoice = lines[0]
        while (
            purchase_index < len(purchases)
            and purchases[purchase_index].imported_at <= invoice.sold_at
        ):
            purchase = purchases[purchase_index]
            quantity, amount = purchase_totals.get(
                purchase.product_id, (0, Decimal("0"))
            )
            purchase_totals[purchase.product_id] = (
                quantity + int(purchase.quantity),
                amount + (_money(purchase.line_total) if purchase.line_total is not None
                          else int(purchase.quantity) * _money(purchase.unit_price)),
            )
            purchase_index += 1

        gross_amounts = [
            int(line.quantity) * _money(line.unit_price) for line in lines
        ]
        invoice_gross = sum(gross_amounts, Decimal("0"))
        invoice_quantity = sum(int(line.quantity) for line in lines)
        remaining_discount = _money(invoice.discount_amount)
        # Only the charged third-party fee is a recorded selling expense.
        shipping_total = (
            _money(invoice.shipping_fee)
            if invoice.delivery_method == "third_party" and invoice.shipping_charged_at
            else Decimal("0")
        )
        remaining_shipping = shipping_total

        for index, (line, gross) in enumerate(zip(lines, gross_amounts)):
            if index == len(lines) - 1:
                discount = remaining_discount
                shipping = remaining_shipping
            else:
                share = (
                    gross / invoice_gross
                    if invoice_gross
                    else Decimal(int(line.quantity)) / Decimal(invoice_quantity)
                )
                discount = _rounded(_money(invoice.discount_amount) * share)
                shipping = _rounded(shipping_total * share)
                remaining_discount -= discount
                remaining_shipping -= shipping

            product = products.setdefault(line.product_id, {
                "product_id": line.product_id,
                "product_name": line.product_name,
                "unit": line.unit,
                "quantity": 0,
                "gross_revenue": Decimal("0"),
                "discount": Decimal("0"),
                "net_revenue": Decimal("0"),
                "known_cost": Decimal("0"),
                "shipping_cost": Decimal("0"),
                "missing_cost_quantity": 0,
            })
            product["quantity"] += int(line.quantity)
            product["gross_revenue"] += gross
            product["discount"] += discount
            product["net_revenue"] += gross - discount
            product["shipping_cost"] += shipping

            imported_quantity, imported_amount = purchase_totals.get(
                line.product_id, (0, Decimal("0"))
            )
            if imported_quantity:
                product["known_cost"] += _rounded(
                    Decimal(int(line.quantity)) * imported_amount / imported_quantity
                )
            else:
                product["missing_cost_quantity"] += int(line.quantity)

    rows = []
    for product in products.values():
        fully_costed = product["missing_cost_quantity"] == 0
        profit = (
            product["net_revenue"]
            - product["known_cost"]
            - product["shipping_cost"]
            if fully_costed else None
        )
        margin = (
            float(profit / product["net_revenue"] * 100)
            if profit is not None and product["net_revenue"]
            else None
        )
        rows.append({
            "product_id": product["product_id"],
            "product_name": product["product_name"],
            "unit": product["unit"],
            "quantity": product["quantity"],
            "gross_revenue": float(product["gross_revenue"]),
            "discount": float(product["discount"]),
            "net_revenue": float(product["net_revenue"]),
            "estimated_cogs": float(product["known_cost"]) if fully_costed else None,
            "shipping_cost": float(product["shipping_cost"]),
            "estimated_profit": float(profit) if profit is not None else None,
            "margin_percent": margin,
            "missing_cost_quantity": product["missing_cost_quantity"],
        })
    rows.sort(key=lambda row: (
        row["estimated_profit"] is None,
        -(row["estimated_profit"] or 0),
        row["product_name"],
    ))
    return rows


def summarize_product_profit(rows):
    complete = [row for row in rows if row["estimated_profit"] is not None]
    return {
        "total_products": len(rows),
        "priced_products": len(complete),
        "missing_cost_products": len(rows) - len(complete),
        "total_quantity": sum(row["quantity"] for row in rows),
        "net_revenue_all": sum(row["net_revenue"] for row in rows),
        "net_revenue_priced": sum(row["net_revenue"] for row in complete),
        "estimated_cogs_priced": sum(row["estimated_cogs"] for row in complete),
        "shipping_cost_priced": sum(row["shipping_cost"] for row in complete),
        "estimated_profit_priced": sum(row["estimated_profit"] for row in complete),
    }
