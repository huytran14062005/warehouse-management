import React from "react";

export default function ProductIdentityFields({
  name,
  onNameChange,
  unit,
  onUnitChange,
}) {
  return (
    <>
      <label className="warehouse-field">
        <span>Tên sản phẩm</span>
        <input
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          required
          autoFocus
        />
      </label>
      <label className="warehouse-field">
        <span>Đơn vị tính</span>
        <input
          value={unit}
          onChange={(event) => onUnitChange(event.target.value)}
          placeholder="Ví dụ: Cái, Hộp, Kg"
          required
        />
      </label>
    </>
  );
}
