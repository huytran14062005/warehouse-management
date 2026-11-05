import React from "react";

export default function ProductRequestDropdownAction({ query, onRequest }) {
  const name = String(query || "").trim();
  if (!name) return null;
  return (
    <button
      type="button"
      className="searchable-dropdown-action"
      onClick={() => onRequest(name)}
    >
      + Gửi yêu cầu thêm sản phẩm
    </button>
  );
}
