export function getInventoryStatus(quantity, totalImported, lowStockPercentage) {
  const stock = Number(quantity || 0);
  const imported = Number(totalImported || 0);
  const percentage = Number(lowStockPercentage);

  if (stock <= 0) {
    return { key: "empty", label: "Hết hàng" };
  }

  if (imported > 0 && Number.isFinite(percentage) && percentage >= 1 &&
      stock <= imported * percentage / 100) {
    return { key: "low", label: "Sắp hết hàng" };
  }

  return { key: "available", label: "Còn hàng" };
}
