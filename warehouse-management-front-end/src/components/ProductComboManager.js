import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { authApis, endpoints } from "../configs/Apis";
import { getApiError } from "../utils/apiError";
import SearchableDropdown from "./SearchableDropdown";
import "../css/ProductComboManager.css";

const newDraft = () => ({ name: "", items: [
  { key: "first", product_id: "", quantity: "1" },
  { key: "second", product_id: "", quantity: "1" },
] });

function ProductComboManager({ onClose }) {
  const [combos, setCombos] = useState([]);
  const [products, setProducts] = useState([]);
  const [draft, setDraft] = useState(newDraft);
  const [editingId, setEditingId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([
      authApis().get(endpoints.productCombos),
      authApis().get(endpoints.productComboCatalog),
    ]).then(([comboResponse, catalogResponse]) => {
      if (!active) return;
      setCombos(comboResponse.data?.combos || []);
      setProducts(catalogResponse.data?.products || []);
    }).catch((requestError) => {
      if (active) setError(getApiError(requestError));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const startNew = () => {
    setEditingId(null);
    setDraft(newDraft());
    setError("");
    setNotice("");
    setConfirmDeleteId(null);
  };

  const startEdit = (combo) => {
    setEditingId(combo.id);
    setDraft({
      name: combo.name,
      items: combo.items.map((item, index) => ({
        key: `existing-${index}`,
        product_id: String(item.product_id),
        quantity: String(item.quantity),
      })),
    });
    setError("");
    setNotice("");
    setConfirmDeleteId(null);
  };

  const updateItem = (key, field, value) => {
    setDraft((current) => ({
      ...current,
      items: current.items.map((item) => item.key === key ? { ...item, [field]: value } : item),
    }));
  };

  const save = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");
    const name = draft.name.trim();
    const productIds = draft.items.map((item) => Number(item.product_id));
    if (!name || draft.items.length < 2 || productIds.some((id) => !id) || new Set(productIds).size !== productIds.length ||
        draft.items.some((item) => !/^\d+$/.test(String(item.quantity)) || Number(item.quantity) < 1)) {
      setError("Nhập tên combo và chọn ít nhất 2 sản phẩm khác nhau, mỗi sản phẩm có số lượng từ 1.");
      return;
    }
    try {
      setSaving(true);
      const payload = {
        name,
        items: draft.items.map((item) => ({
          product_id: Number(item.product_id),
          quantity: Number(item.quantity),
        })),
      };
      const response = editingId
        ? await authApis().put(endpoints.productComboDetail(editingId), payload)
        : await authApis().post(endpoints.productCombos, payload);
      const savedCombo = response.data?.combo;
      setCombos((current) => [...current.filter((combo) => combo.id !== savedCombo.id), savedCombo]
        .sort((first, second) => first.name.localeCompare(second.name, "vi")));
      setEditingId(savedCombo.id);
      setNotice(editingId ? "Đã cập nhật combo." : "Đã tạo combo. Nhân viên có thể chọn bộ này khi lập đơn.");
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (comboId) => {
    try {
      setSaving(true);
      setError("");
      await authApis().delete(endpoints.productComboDetail(comboId));
      setCombos((current) => current.filter((combo) => combo.id !== comboId));
      setConfirmDeleteId(null);
      if (editingId === comboId) startNew();
      setNotice("Đã xóa combo.");
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setSaving(false);
    }
  };

  const summary = draft.items
    .map((item) => {
      const product = products.find((candidate) => String(candidate.id) === String(item.product_id));
      return product ? `${item.quantity || 1} ${product.unit} ${product.name}` : null;
    })
    .filter(Boolean);

  return createPortal(
    <div className="combo-manager-overlay">
      <div className="combo-manager-dialog" role="dialog" aria-modal="true" aria-labelledby="combo-manager-title">
        <header className="combo-manager-header">
          <div>
            <span className="combo-manager-eyebrow">QUẢN LÝ SẢN PHẨM</span>
            <h2 id="combo-manager-title">Tạo combo sản phẩm</h2>
            <p>Gom sản phẩm chính và phụ kiện thành một bộ để gợi ý khi lập đơn bán hàng.</p>
          </div>
          <button type="button" className="combo-manager-close" onClick={onClose} aria-label="Đóng">×</button>
        </header>
        <div className="combo-manager-content">
          <aside className="combo-manager-sidebar">
            <div className="combo-manager-sidebar-heading">
              <strong>Combo đã tạo</strong>
              <span>{combos.length}</span>
            </div>
            <button type="button" className="combo-manager-new" onClick={startNew}>+ Tạo combo mới</button>
            {loading ? <p className="combo-manager-muted">Đang tải combo...</p> : combos.length ? (
              <div className="combo-manager-list">
                {combos.map((combo) => (
                  <div key={combo.id} className={`combo-manager-list-item${editingId === combo.id ? " is-selected" : ""}`}>
                    <button type="button" onClick={() => startEdit(combo)}>
                      <strong>{combo.name}</strong>
                      <span>{combo.items.length} sản phẩm · {combo.items.map((item) => item.product_name).join(", ")}</span>
                    </button>
                    {confirmDeleteId === combo.id ? (
                      <div className="combo-manager-confirm">
                        <span>Xóa combo này?</span>
                        <button type="button" onClick={() => remove(combo.id)} disabled={saving}>Xóa</button>
                        <button type="button" onClick={() => setConfirmDeleteId(null)}>Hủy</button>
                      </div>
                    ) : (
                      <button type="button" className="combo-manager-delete" onClick={() => setConfirmDeleteId(combo.id)} aria-label={`Xóa ${combo.name}`}>Xóa</button>
                    )}
                  </div>
                ))}
              </div>
            ) : <p className="combo-manager-muted">Chưa có combo. Tạo bộ đầu tiên ở bên phải.</p>}
          </aside>

          <form className="combo-manager-form" onSubmit={save}>
            <div className="combo-manager-form-heading">
              <div>
                <h3>{editingId ? "Chỉnh sửa combo" : "Combo mới"}</h3>
                <p>Mỗi bộ sẽ thêm đúng số lượng sản phẩm bạn thiết lập bên dưới.</p>
              </div>
            </div>
            {error && <div className="combo-manager-message is-error" role="alert">{error}</div>}
            {notice && <div className="combo-manager-message is-success" role="status">{notice}</div>}
            <label className="combo-manager-field">
              <span>Tên combo</span>
              <input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                placeholder="Ví dụ: Bộ rèm cửa và phụ kiện" maxLength={150} required />
            </label>
            <div className="combo-manager-products-heading">
              <div>
                <strong>Sản phẩm trong bộ</strong>
                <small>Chọn ít nhất 2 sản phẩm. Có thể thêm rèm, thanh treo, móc rèm...</small>
              </div>
            </div>
            <div className="combo-manager-items">
              {draft.items.map((item, index) => (
                <div className="combo-manager-item" key={item.key}>
                  <span className="combo-manager-item-number">{index + 1}</span>
                  <div className="combo-manager-item-product">
                    <span>Sản phẩm</span>
                    <SearchableDropdown
                      value={item.product_id}
                      options={[{ value: "", label: "Chọn sản phẩm" }, ...products.map((product) => ({ value: product.id, label: `${product.name} · ${product.unit}` }))]}
                      placeholder="Chọn sản phẩm"
                      ariaLabel={`Sản phẩm combo ${index + 1}`}
                      onChange={(value) => updateItem(item.key, "product_id", String(value))}
                    />
                  </div>
                  <label className="combo-manager-item-quantity">
                    <span>Số lượng / bộ</span>
                    <input type="number" min="1" step="1" value={item.quantity} onChange={(event) => updateItem(item.key, "quantity", event.target.value)} required />
                  </label>
                  <button type="button" className="combo-manager-item-remove" onClick={() => setDraft((current) => ({
                    ...current, items: current.items.filter((row) => row.key !== item.key),
                  }))} disabled={draft.items.length <= 2} aria-label={`Bỏ sản phẩm ${index + 1}`}>×</button>
                </div>
              ))}
            </div>
            <button type="button" className="combo-manager-add" onClick={() => setDraft((current) => ({
              ...current, items: [...current.items, { key: `${Date.now()}-${Math.random()}`, product_id: "", quantity: "1" }],
            }))} disabled={draft.items.length >= 20}>+ Thêm sản phẩm đi kèm</button>
            <div className="combo-manager-preview">
              <strong>Xem trước một bộ</strong>
              <p>{summary.length ? summary.join(" + ") : "Chọn sản phẩm để xem thành phần combo."}</p>
              <small>Giá bán lấy theo từng sản phẩm khi lập đơn. Combo không tự giảm giá.</small>
            </div>
            <footer className="combo-manager-actions">
              <button type="button" onClick={onClose}>Đóng</button>
              <button type="submit" className="is-primary" disabled={saving || loading}>{saving ? "Đang lưu..." : editingId ? "Lưu thay đổi" : "Tạo combo"}</button>
            </footer>
          </form>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default ProductComboManager;
