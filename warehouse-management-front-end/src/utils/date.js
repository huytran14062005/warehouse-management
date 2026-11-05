const padTwo = (value) => String(value).padStart(2, "0");

export function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${padTwo(date.getDate())}/${padTwo(date.getMonth() + 1)}/${date.getFullYear()}`;
}

export function formatDateTime(value, showSeconds = false) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${formatDate(date)} ${padTwo(date.getHours())}:${padTwo(date.getMinutes())}${showSeconds ? `:${padTwo(date.getSeconds())}` : ""}`;
}

export function formatIsoDate(value, { empty = "—", invalid = "—" } = {}) {
  if (!value) return empty;
  const [year, month, day] = String(value).split("-");
  return year && month && day ? `${day}/${month}/${year}` : invalid;
}

export function formatLocalDateInput(date = new Date()) {
  return `${date.getFullYear()}-${padTwo(date.getMonth() + 1)}-${padTwo(date.getDate())}`;
}

export function toDateInputValue(value) {
  return value ? String(value).slice(0, 10) : formatLocalDateInput();
}
