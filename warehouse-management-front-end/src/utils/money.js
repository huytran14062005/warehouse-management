export function digitsOnly(value) {
  return String(value ?? "").replace(/\D/g, "");
}

export function formatMoneyInput(value) {
  const digits = digitsOnly(value);
  return digits === "" ? "" : Number(digits).toLocaleString("vi-VN");
}

export function formatCurrency(value) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

export function formatQuantity(value) {
  return new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 3,
  }).format(Number(value || 0));
}
