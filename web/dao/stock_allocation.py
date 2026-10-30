"""Allocate field sales against the stock transfer lots that supplied them."""


def allocate_field_sales_to_transfers(lots, sales):
    """Return sold quantity per transfer item, using FIFO per employee/product.

    A sale can consume only stock transferred no later than its sale time. The
    source warehouse is taken from the transfer lot, not the sales invoice.
    """
    sold, _ = allocate_field_movements_to_transfers(lots, sales, [])
    return sold


def allocate_field_movements_to_transfers(lots, sales, damages):
    """Allocate field sales and damage chronologically to source transfer lots."""
    remaining = {lot.item_id: int(lot.quantity) for lot in lots}
    lots_by_stock = {}
    for lot in sorted(lots, key=lambda row: (row.transferred_at, row.transfer_id, row.item_id)):
        lots_by_stock.setdefault((lot.employee_id, lot.product_id), []).append(lot)

    pointers = {key: 0 for key in lots_by_stock}
    sold = {item_id: 0 for item_id in remaining}
    damaged = {item_id: 0 for item_id in remaining}
    events = [
        (sale.sold_at, 0, sale.invoice_id, sale.sale_item_id, sale, sold)
        for sale in sales
    ] + [
        (damage.reported_at, 1, damage.report_id, damage.damage_item_id, damage, damaged)
        for damage in damages
    ]
    for event_at, _, _, _, movement, target in sorted(events, key=lambda event: event[:4]):
        key = (movement.employee_id, movement.product_id)
        stock_lots = lots_by_stock.get(key, [])
        pointer = pointers.get(key, 0)
        quantity = int(movement.quantity)
        while quantity > 0 and pointer < len(stock_lots):
            lot = stock_lots[pointer]
            if lot.transferred_at > event_at:
                break
            available = remaining[lot.item_id]
            if available == 0:
                pointer += 1
                continue
            used = min(available, quantity)
            target[lot.item_id] += used
            remaining[lot.item_id] -= used
            quantity -= used
            if remaining[lot.item_id] == 0:
                pointer += 1
        pointers[key] = pointer
    return sold, damaged
