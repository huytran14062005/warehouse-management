import React, { useMemo, useState } from "react";
import { digitsOnly, formatMoneyInput } from "../utils/money";
import "../css/MoneyInput.css";

export const MIN_MONEY_AMOUNT = 500;

function getMoneyWarning(value, label, { allowZero = false, allowEmpty = false } = {}) {
  const digits = digitsOnly(value);
  if (!digits) return allowEmpty ? "" : `${label} không được để trống.`;
  const amount = Number(digits);
  if (!Number.isFinite(amount)) return `${label} không hợp lệ.`;
  if (amount === 0 && allowZero) return "";
  if (amount < MIN_MONEY_AMOUNT) {
    return `${label} phải từ ${MIN_MONEY_AMOUNT.toLocaleString("vi-VN")} đồng trở lên.`;
  }
  return "";
}

function MoneyInput({
  value,
  onChange,
  label = "Số tiền",
  allowZero = false,
  allowEmpty = false,
  className = "",
  ...inputProps
}) {
  const [touched, setTouched] = useState(false);
  const warning = useMemo(
    () => getMoneyWarning(value, label, { allowZero, allowEmpty }),
    [allowEmpty, allowZero, label, value],
  );

  return (
    <div className={`money-input${className ? ` ${className}` : ""}`}>
      <input
        {...inputProps}
        type="text"
        inputMode="numeric"
        value={formatMoneyInput(value)}
        onFocus={() => setTouched(true)}
        onBlur={() => setTouched(true)}
        onChange={(event) => {
          setTouched(true);
          onChange(digitsOnly(event.target.value));
        }}
        aria-invalid={Boolean(touched && warning)}
      />
      {touched && warning && <small className="money-input-warning">{warning}</small>}
    </div>
  );
}

export { getMoneyWarning };
export default MoneyInput;
