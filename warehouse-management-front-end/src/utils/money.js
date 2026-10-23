export function digitsOnly(value) {
  return String(value ?? "").replace(/\D/g, "");
}

export function formatMoneyInput(value) {
  const digits = digitsOnly(value);
  return digits === "" ? "" : Number(digits).toLocaleString("vi-VN");
}
