export const LOW_STOCK_REMAINING_RATIO = 0.25;

export function getInventoryStatus(quantity, totalImported) {
  const stock = Number(quantity || 0);
  const imported = Number(totalImported || 0);

  if (stock <= 0) {
    return { key: "empty", label: "Hết hàng" };
  }

  if (imported > 0 && stock <= imported * LOW_STOCK_REMAINING_RATIO) {
    return { key: "low", label: "Sắp hết hàng" };
  }

  return { key: "available", label: "Còn hàng" };
}
