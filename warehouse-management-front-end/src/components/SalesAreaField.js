import React, { useState } from "react";
import { authApis, endpoints } from "../configs/Apis";
import { getApiError } from "../utils/apiError";
import useNotificationState from "../utils/useNotificationState";
import AutoDismissMessage from "./AutoDismissMessage";
import FieldAlert from "./FieldAlert";
import SearchableDropdown from "./SearchableDropdown";
import "../css/CustomerFields.css";

function SalesAreaField({ value, onChange, salesAreas, salesAreasLoading = false, required = false, onSalesAreaCreated }) {
  const [addingArea, setAddingArea] = useState(false);
  const [areaName, setAreaName] = useState("");
  const [areaSaving, setAreaSaving] = useState(false);
  const [areaError, setAreaError] = useNotificationState();
  const [areaSuccess, setAreaSuccess] = useNotificationState();

  const saveArea = async () => {
    const name = areaName.trim().replace(/\s+/g, " ");
    setAreaError("");
    if (!name) {
      setAreaError("Vui lòng nhập tên khu vực bán hàng.");
      return;
    }
    try {
      setAreaSaving(true);
      const response = await authApis().post(endpoints.salesAreas, { name });
      const area = response.data?.sales_area;
      if (!area?.id) throw new Error("Invalid sales area response");
      onSalesAreaCreated?.(area);
      onChange(String(area.id));
      setAreaName("");
      setAddingArea(false);
      setAreaSuccess(`Đã thêm khu vực bán hàng ${area.name}.`);
    } catch (requestError) {
      setAreaError([404, 405].includes(requestError.response?.status)
        ? "Máy chủ chưa hỗ trợ thêm khu vực bán hàng. Vui lòng cập nhật backend."
        : getApiError(requestError));
    } finally {
      setAreaSaving(false);
    }
  };

  return (
    <div className="customer-fields-field customer-fields-wide">
      <div className="customer-fields-heading">
        <span>Khu vực bán hàng{required ? " *" : ""}</span>
        {onSalesAreaCreated && (
          <button type="button" className="customer-fields-add-area" onClick={() => {
            setAddingArea((current) => !current);
            setAreaError("");
          }} disabled={areaSaving || salesAreasLoading}>
            {addingArea ? "Hủy" : "+ Thêm khu vực"}
          </button>
        )}
      </div>
      <SearchableDropdown
        value={String(value || "")}
        onChange={(areaId) => onChange(String(areaId))}
        options={salesAreasLoading ? [] : [
          { value: "", label: "Chọn khu vực bán hàng" },
          ...salesAreas.map((area) => ({ value: area.id, label: area.name })),
        ]}
        placeholder={salesAreasLoading ? "Đang tải khu vực bán hàng..." : "Chọn khu vực bán hàng"}
        ariaLabel="Chọn khu vực bán hàng"
        disabled={salesAreasLoading}
      />
      {addingArea && (
        <div className="customer-fields-create-area">
          <input
            aria-label="Tên khu vực bán hàng mới"
            value={areaName}
            onChange={(event) => setAreaName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                if (!areaSaving) saveArea();
              }
            }}
            placeholder="Tên khu vực mới"
            maxLength={120}
            disabled={areaSaving}
            autoFocus
          />
          <button type="button" onClick={saveArea} disabled={areaSaving}>
            {areaSaving ? "Đang lưu..." : "Lưu khu vực"}
          </button>
          <FieldAlert message={areaError} className="customer-fields-area-error" />
        </div>
      )}
      <AutoDismissMessage message={areaSuccess} type="success" role="status" />
    </div>
  );
}

export default SalesAreaField;
