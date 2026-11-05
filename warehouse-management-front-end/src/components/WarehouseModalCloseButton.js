import React from "react";

export default function WarehouseModalCloseButton({
  onClick,
  disabled = false,
  ariaLabel = "Đóng",
}) {
  return (
    <button
      type="button"
      className="warehouse-modal-close"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
    >
      ×
    </button>
  );
}
