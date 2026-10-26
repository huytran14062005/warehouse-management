import React, { useState } from "react";
import { createPortal } from "react-dom";
import { authApis, endpoints } from "../configs/Apis";
import { getApiError } from "../utils/apiError";
import AutoDismissMessage from "./AutoDismissMessage";
import "../css/WarehouseOperations.css";

function ProductRequestModal({ initialName = "", onClose, onSaved }) {
  const [name, setName] = useState(initialName);
  const [unit, setUnit] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (!name.trim() || !unit.trim()) {
      setError("Vui lòng nhập tên sản phẩm và đơn vị tính.");
      return;
    }
    try {
      setSaving(true);
      await authApis().post(endpoints.productRequests, {
        name: name.trim(),
        unit: unit.trim(),
        note: note.trim(),
      });
      onSaved();
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="warehouse-modal-overlay">
      <div className="warehouse-modal warehouse-editor-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <div className="warehouse-modal-header">
          <h2>Yêu cầu thêm sản phẩm</h2>
          <button type="button" className="warehouse-modal-close" onClick={onClose} aria-label="Đóng">×</button>
        </div>
        <form className="warehouse-modal-body" onSubmit={submit}>
          <AutoDismissMessage message={error} className="warehouse-error" />
          <p>Yêu cầu sẽ được gửi đến quản lý để kiểm tra và thêm vào danh mục.</p>
          <label className="warehouse-field">
            <span>Tên sản phẩm</span>
            <input value={name} onChange={(event) => setName(event.target.value)} required autoFocus />
          </label>
          <label className="warehouse-field">
            <span>Đơn vị tính</span>
            <input value={unit} onChange={(event) => setUnit(event.target.value)} placeholder="Ví dụ: Cái, Hộp, Kg" required />
          </label>
          <label className="warehouse-field">
            <span>Ghi chú</span>
            <textarea rows="3" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Thông tin thêm nếu có" />
          </label>
          <div className="warehouse-modal-actions">
            <button type="button" onClick={onClose} disabled={saving}>Hủy</button>
            <button type="submit" className="warehouse-primary-button" disabled={saving}>{saving ? "Đang gửi..." : "Gửi yêu cầu"}</button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}

export default ProductRequestModal;
