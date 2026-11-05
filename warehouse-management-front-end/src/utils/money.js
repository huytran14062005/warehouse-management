const currencyFormatter = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});
const integerFormatter = new Intl.NumberFormat("vi-VN", {
  maximumFractionDigits: 0,
});
const quantityFormatter = new Intl.NumberFormat("vi-VN", {
  maximumFractionDigits: 3,
});

export function digitsOnly(value) {
  return String(value ?? "").replace(/\D/g, "");
}

export function formatMoneyInput(value) {
  const digits = digitsOnly(value);
  return digits === "" ? "" : integerFormatter.format(Number(digits));
}

export function formatCurrency(value) {
  return currencyFormatter.format(Number(value || 0));
}

export function formatInteger(value) {
  return integerFormatter.format(Number(value || 0));
}

export function formatQuantity(value) {
  return quantityFormatter.format(Number(value || 0));
}
