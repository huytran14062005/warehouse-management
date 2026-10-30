import React from "react";
import SearchableDropdown from "./SearchableDropdown";

const PAYMENT_METHOD_OPTIONS = [
  { value: "", label: "Chọn phương thức" },
  { value: "cash", label: "Tiền mặt" },
  { value: "bank_transfer", label: "Chuyển khoản" },
];

function PaymentMethodDropdown({ value, onChange }) {
  return (
    <SearchableDropdown
      value={value}
      onChange={onChange}
      options={PAYMENT_METHOD_OPTIONS}
      placeholder="Chọn phương thức"
      ariaLabel="Chọn phương thức thanh toán"
    />
  );
}

export default PaymentMethodDropdown;
