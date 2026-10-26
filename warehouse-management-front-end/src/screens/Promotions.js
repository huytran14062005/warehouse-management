import React, { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { authApis, endpoints } from "../configs/Apis";
import { getApiError } from "../utils/apiError";
import useNotificationState from "../utils/useNotificationState";
import AutoDismissMessage from "../components/AutoDismissMessage";
import ConfirmDialog from "../components/ConfirmDialog";
import Skeleton from "../components/Skeleton";
import { digitsOnly, formatMoneyInput } from "../utils/money";
import "../css/Promotions.css";


const EMPTY_FORM = {
  name: "",
  condition_type: "min_quantity",
  min_quantity: "",
  min_order_amount: "",
  start_date: "",
  end_date: "",
  discount_type: "fixed_amount",
  discount_value: "",
  max_discount_amount: "",
};

function formatDate(value) {
  if (!value) return "Không giới hạn";
  const [year, month, day] = String(value).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function PromotionForm({ promotion, onClose, onSaved }) {
  const [form, setForm] = useState(() =>
    promotion
      ? {
          name: promotion.name || "",
          condition_type: promotion.condition_type || "min_quantity",
          min_quantity: String(promotion.min_quantity || ""),
          min_order_amount: String(promotion.min_order_amount || ""),
          start_date: promotion.start_date || "",
          end_date: promotion.end_date || "",
          discount_type: promotion.discount_type || "fixed_amount",
          discount_value: String(promotion.discount_value || ""),
          max_discount_amount: String(promotion.max_discount_amount || ""),
        }
      : EMPTY_FORM,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useNotificationState();

  const update = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    const payload = {
      ...form,
      min_quantity:
        form.condition_type === "min_quantity"
          ? Number(form.min_quantity)
          : null,
      min_order_amount:
        form.condition_type === "min_order_amount"
          ? Number(form.min_order_amount)
          : null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      discount_value: Number(form.discount_value),
      max_discount_amount:
        form.discount_type === "percentage" && form.max_discount_amount
          ? Number(form.max_discount_amount)
          : null,
    };
    try {
      setSaving(true);
      const response = promotion
        ? await authApis().put(endpoints.promotionDetail(promotion.id), payload)
        : await authApis().post(endpoints.promotions, payload);
      onSaved(response.data?.promotion);
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="promotion-modal-overlay">
      <div
        className="promotion-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="promotion-form-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="promotion-modal-header">
          <div>
            <p>{promotion ? "CHỈNH SỬA" : "TẠO MỚI"}</p>
            <h2 id="promotion-form-title">
              {promotion ? promotion.name : "Chương trình khuyến mãi"}
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng">×</button>
        </div>
        <form className="promotion-form" onSubmit={handleSubmit}>
          <AutoDismissMessage message={error} className="promotion-alert" />
          <label className="promotion-field promotion-field-wide">
            <span>Tên chương trình</span>
            <input
              value={form.name}
              onChange={(event) => update("name", event.target.value)}
              placeholder="Ví dụ: Khuyến mãi Quốc khánh"
              maxLength="150"
              required
            />
          </label>

          <label className="promotion-field">
            <span>Điều kiện áp dụng</span>
            <select
              value={form.condition_type}
              onChange={(event) => update("condition_type", event.target.value)}
            >
              <option value="min_quantity">Mua đủ số lượng sản phẩm</option>
              <option value="min_order_amount">Đơn đạt giá trị tối thiểu</option>
              <option value="holiday">Theo dịp / ngày lễ</option>
            </select>
          </label>

          {form.condition_type === "min_quantity" && (
            <label className="promotion-field">
              <span>Số lượng tối thiểu</span>
              <input
                type="number"
                min="1"
                step="1"
                value={form.min_quantity}
                onChange={(event) => update("min_quantity", event.target.value)}
                placeholder="Ví dụ: 10"
                required
              />
            </label>
          )}

          {form.condition_type === "min_order_amount" && (
            <label className="promotion-field">
              <span>Giá trị đơn tối thiểu</span>
              <input
                type="text"
                inputMode="numeric"
                value={formatMoneyInput(form.min_order_amount)}
                onChange={(event) =>
                  update("min_order_amount", digitsOnly(event.target.value))
                }
                placeholder="Ví dụ: 5.000.000"
                required
              />
            </label>
          )}

          <label className="promotion-field">
            <span>Ngày bắt đầu{form.condition_type !== "holiday" ? " (không bắt buộc)" : ""}</span>
            <input
              type="date"
              value={form.start_date}
              onChange={(event) => update("start_date", event.target.value)}
              required={form.condition_type === "holiday"}
            />
          </label>
          <label className="promotion-field">
            <span>Ngày kết thúc{form.condition_type !== "holiday" ? " (không bắt buộc)" : ""}</span>
            <input
              type="date"
              value={form.end_date}
              onChange={(event) => update("end_date", event.target.value)}
              required={form.condition_type === "holiday"}
            />
          </label>

          <label className="promotion-field">
            <span>Cách giảm</span>
            <select
              value={form.discount_type}
              onChange={(event) => update("discount_type", event.target.value)}
            >
              <option value="fixed_amount">Giảm số tiền cố định</option>
              <option value="percentage">Giảm theo phần trăm</option>
            </select>
          </label>
          <label className="promotion-field">
            <span>
              {form.discount_type === "percentage"
                ? "Phần trăm giảm"
                : "Số tiền giảm"}
            </span>
            <input
              type={form.discount_type === "percentage" ? "number" : "text"}
              inputMode={form.discount_type === "percentage" ? "decimal" : "numeric"}
              min={form.discount_type === "percentage" ? "0.01" : undefined}
              max={form.discount_type === "percentage" ? "100" : undefined}
              step={form.discount_type === "percentage" ? "0.01" : undefined}
              value={
                form.discount_type === "percentage"
                  ? form.discount_value
                  : formatMoneyInput(form.discount_value)
              }
              onChange={(event) =>
                update(
                  "discount_value",
                  form.discount_type === "percentage"
                    ? event.target.value
                    : digitsOnly(event.target.value),
                )
              }
              placeholder={form.discount_type === "percentage" ? "Ví dụ: 10" : "Ví dụ: 100.000"}
              required
            />
          </label>

          {form.discount_type === "percentage" && (
            <label className="promotion-field promotion-field-wide">
              <span>Mức giảm tối đa (không bắt buộc)</span>
              <input
                type="text"
                inputMode="numeric"
                value={formatMoneyInput(form.max_discount_amount)}
                onChange={(event) =>
                  update("max_discount_amount", digitsOnly(event.target.value))
                }
                placeholder="Để trống nếu không giới hạn"
              />
            </label>
          )}

          <div className="promotion-form-actions promotion-field-wide">
            <button type="button" onClick={onClose} disabled={saving}>Hủy</button>
            <button type="submit" className="is-primary" disabled={saving}>
              {saving ? "Đang lưu..." : promotion ? "Lưu thay đổi" : "Tạo khuyến mãi"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}

function Promotions() {
  const [promotions, setPromotions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useNotificationState();
  const [success, setSuccess] = useNotificationState();
  const [editingPromotion, setEditingPromotion] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const currentUser = (() => {
    try {
      return JSON.parse(localStorage.getItem("user")) || {};
    } catch {
      return {};
    }
  })();

  const fetchPromotions = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const response = await authApis().get(endpoints.promotions);
      setPromotions(response.data?.promotions || []);
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setLoading(false);
    }
  }, [setError]);

  useEffect(() => {
    if (currentUser.role === "quản lý") fetchPromotions();
  }, [currentUser.role, fetchPromotions]);

  const handleSaved = (promotion) => {
    setFormOpen(false);
    setEditingPromotion(null);
    setSuccess(promotion?.id === editingPromotion?.id
      ? "Đã cập nhật khuyến mãi."
      : "Đã tạo khuyến mãi.");
    fetchPromotions();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await authApis().delete(endpoints.promotionDetail(deleteTarget.id));
      setDeleteTarget(null);
      setSuccess("Đã xóa khuyến mãi. Các đơn cũ vẫn giữ thông tin đã áp dụng.");
      fetchPromotions();
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setDeleting(false);
    }
  };

  if (currentUser.role !== "quản lý") {
    return <div className="promotions-page"><div className="promotion-empty">Bạn không có quyền quản lý khuyến mãi.</div></div>;
  }

  return (
    <div className="promotions-page">
      <header className="promotions-header">
        <div>
          <h1>Khuyến mãi</h1>
          <p>Thiết lập điều kiện và mức giảm dùng thống nhất khi lập đơn bán hàng.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingPromotion(null);
            setFormOpen(true);
          }}
        >
          + Tạo khuyến mãi
        </button>
      </header>
      <AutoDismissMessage message={error} className="promotion-alert" />
      <AutoDismissMessage message={success} className="promotion-success" />

      <div className="promotions-card">
        {loading ? (
          <Skeleton rows={5} columns={5} />
        ) : promotions.length ? (
          <div className="promotions-table-wrap">
            <table className="promotions-table">
              <thead>
                <tr>
                  <th>Chương trình</th>
                  <th>Điều kiện</th>
                  <th>Mức khuyến mãi</th>
                  <th>Thời gian</th>
                  <th aria-label="Thao tác" />
                </tr>
              </thead>
              <tbody>
                {promotions.map((promotion) => (
                  <tr key={promotion.id}>
                    <td><strong>{promotion.name}</strong></td>
                    <td>{promotion.condition_summary}</td>
                    <td><strong className="promotion-benefit">{promotion.benefit_summary}</strong></td>
                    <td>
                      {promotion.start_date || promotion.end_date
                        ? `${formatDate(promotion.start_date)} → ${formatDate(promotion.end_date)}`
                        : "Không giới hạn"}
                    </td>
                    <td>
                      <div className="promotion-row-actions">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPromotion(promotion);
                            setFormOpen(true);
                          }}
                        >
                          Chỉnh sửa
                        </button>
                        <button
                          type="button"
                          className="is-danger"
                          onClick={() => setDeleteTarget(promotion)}
                        >
                          Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="promotion-empty">
            Chưa có chương trình khuyến mãi. Hãy tạo chương trình đầu tiên.
          </div>
        )}
      </div>

      {formOpen && (
        <PromotionForm
          promotion={editingPromotion}
          onClose={() => {
            setFormOpen(false);
            setEditingPromotion(null);
          }}
          onSaved={handleSaved}
        />
      )}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Xóa khuyến mãi?"
        message={deleteTarget
          ? `Khuyến mãi “${deleteTarget.name}” sẽ không thể áp dụng cho đơn mới. Các đơn cũ vẫn giữ nguyên lịch sử.`
          : ""}
        confirmLabel="Xóa khuyến mãi"
        cancelLabel="Quay lại"
        danger
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => {
          if (!deleting) setDeleteTarget(null);
        }}
      />
    </div>
  );
}

export default Promotions;
