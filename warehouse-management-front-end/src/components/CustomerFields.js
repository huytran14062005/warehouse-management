import React from "react";
import SearchableDropdown from "./SearchableDropdown";
import "../css/CustomerFields.css";

function CustomerFields({ value, onChange, salesAreas, salesAreasLoading = false, requireSalesArea = false }) {
  return (
    <div className="customer-fields">
      <label className="customer-fields-field">
        <span>Họ và tên</span>
        <input
          value={value.full_name || ""}
          onChange={(event) => onChange("full_name", event.target.value)}
          placeholder="Nhập họ và tên khách hàng"
          autoComplete="name"
          maxLength={150}
          required
        />
      </label>
      <label className="customer-fields-field">
        <span>Số điện thoại</span>
        <input
          type="tel"
          inputMode="tel"
          value={value.phone || ""}
          onChange={(event) => onChange("phone", event.target.value)}
          placeholder="Nhập số điện thoại"
          autoComplete="tel"
          maxLength={20}
          required
        />
      </label>
      <label className="customer-fields-field customer-fields-wide">
        <span>Địa chỉ</span>
        <textarea
          value={value.address || ""}
          onChange={(event) => onChange("address", event.target.value)}
          placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành phố"
          autoComplete="street-address"
          rows={3}
          required
        />
      </label>
      <div className="customer-fields-field customer-fields-wide">
        <span>Khu vực bán hàng{requireSalesArea ? " *" : ""}</span>
        <SearchableDropdown
          value={String(value.sales_area_id || "")}
          onChange={(areaId) => onChange("sales_area_id", String(areaId))}
          options={salesAreasLoading ? [] : [
            { value: "", label: "Chọn khu vực bán hàng" },
            ...salesAreas.map((area) => ({ value: area.id, label: area.name })),
          ]}
          placeholder={salesAreasLoading ? "Đang tải khu vực bán hàng..." : "Chọn khu vực bán hàng"}
          ariaLabel="Chọn khu vực bán hàng"
          disabled={salesAreasLoading}
        />
      </div>
    </div>
  );
}

export default CustomerFields;
