import React, { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useSearchParams } from "react-router-dom";
import { authApis, endpoints } from "../configs/Apis";
import { getApiError } from "../utils/apiError";
import useNotificationState from "../utils/useNotificationState";
import AutoDismissMessage from "../components/AutoDismissMessage";
import ConfirmDialog from "../components/ConfirmDialog";
import Pagination from "../components/Pagination";
import SharedSearchableDropdown from "../components/SearchableDropdown";
import Skeleton from "../components/Skeleton";
import "../css/WarehouseOperations.css";

const PER_PAGE = 10;
const STATUS_OPTIONS = [
  { value: "", label: "Tất cả trạng thái" },
  { value: "pending", label: "Chờ duyệt" },
  { value: "approved", label: "Đã duyệt" },
  { value: "rejected", label: "Từ chối" },
];

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
}

function statusLabel(value) {
  return (
    STATUS_OPTIONS.find((option) => option.value === value)?.label ||
    value ||
    "—"
  );
}

function DamageDetail({ report, onClose, canReview, onReview }) {
  return createPortal(
    <div className="warehouse-modal-overlay">
      <div
        className="warehouse-modal"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="warehouse-modal-header">
          <h2>Chi tiết phiếu hàng hư #{report.id}</h2>
          <button
            type="button"
            className="warehouse-modal-close"
            onClick={onClose}
            aria-label="Đóng"
          >
            ×
          </button>
        </div>
        <div className="warehouse-modal-body">
          <div className="warehouse-info-grid">
            <div>
              <span>Ngày báo</span>
              <strong>{formatDate(report.reported_at)}</strong>
            </div>
            <div>
              <span>Trạng thái</span>
              <strong>{statusLabel(report.status)}</strong>
            </div>
            <div>
              <span>Người báo</span>
              <strong>{report.reported_by?.full_name || "—"}</strong>
            </div>
            <div>
              <span>Người duyệt</span>
              <strong>{report.reviewed_by?.full_name || "Chưa duyệt"}</strong>
            </div>
          </div>
          <h3 className="warehouse-section-title">Sản phẩm hư hỏng</h3>
          <div className="warehouse-table-wrap">
            <table className="warehouse-table">
              <thead>
                <tr>
                  <th>Sản phẩm</th>
                  <th>Đơn vị</th>
                  <th>Số lượng</th>
                  <th>Lý do</th>
                </tr>
              </thead>
              <tbody>
                {(report.items || []).map((item) => (
                  <tr key={item.id || item.product_id}>
                    <td>{item.product_name}</td>
                    <td>{item.unit}</td>
                    <td>{item.quantity}</td>
                    <td>{item.damage_reason || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {report.note && (
            <div className="warehouse-note">
              <span>Ghi chú</span>
              <p>{report.note}</p>
            </div>
          )}
          {report.review_note && (
            <div className="warehouse-note">
              <span>Ghi chú duyệt</span>
              <p>{report.review_note}</p>
            </div>
          )}
          {canReview && report.status === "pending" && (
            <div className="warehouse-modal-actions">
              <button
                type="button"
                className="warehouse-danger-button"
                onClick={() => onReview("rejected")}
              >
                Từ chối
              </button>
              <button
                type="button"
                className="warehouse-primary-button"
                onClick={() => onReview("approved")}
              >
                Duyệt phiếu
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function DamageEditor({ onClose, onSaved }) {
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [items, setItems] = useState([]);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useNotificationState();
  useEffect(() => {
    let cancelled = false;
    authApis().get(endpoints.warehouses)
      .then((response) => {
        if (cancelled) return;
        setWarehouses(response.data?.warehouses || []);
        setWarehouseId(String(response.data?.default_warehouse_id || ""));
      })
      .catch((requestError) => {
        if (!cancelled) setError(getApiError(requestError));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    if (!warehouseId) return undefined;
    let cancelled = false;
    authApis().get(endpoints.productsInventory, {
      params: { warehouse_id: warehouseId, page: 1, per_page: 1000 },
    }).then((response) => {
      if (!cancelled) setProducts(response.data?.products || []);
    }).catch((requestError) => {
      if (!cancelled) setError(getApiError(requestError));
    });
    return () => { cancelled = true; };
  }, [warehouseId]);
  const updateItem = (index, field, value) =>
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    );
  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (!warehouseId) return setError("Vui lòng chọn kho xuất hàng.");
    if (!items.length)
      return setError("Vui lòng thêm ít nhất một sản phẩm để báo hư.");
    const ids = new Set();
    for (const item of items) {
      if (
        !item.product_id ||
        !Number.isInteger(Number(item.quantity)) ||
        Number(item.quantity) <= 0
      )
        return setError(
          "Vui lòng chọn sản phẩm và nhập số lượng nguyên dương.",
        );
      if (ids.has(item.product_id))
        return setError("Mỗi sản phẩm chỉ được xuất hiện một lần trong phiếu.");
      ids.add(item.product_id);
    }
    try {
      setSaving(true);
      const response = await authApis().post(endpoints.damageReports, {
        warehouse_id: Number(warehouseId),
        note: note.trim(),
        items: items.map((item) => ({
          product_id: Number(item.product_id),
          quantity: Number(item.quantity),
          damage_reason: item.damage_reason.trim() || null,
        })),
      });
      onSaved(response.data?.report);
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setSaving(false);
    }
  };
  return createPortal(
    <div className="warehouse-modal-overlay">
      <div
        className="warehouse-modal warehouse-editor-modal"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="warehouse-modal-header">
          <h2>Lập phiếu báo hàng hư</h2>
          <button
            type="button"
            className="warehouse-modal-close"
            onClick={onClose}
            aria-label="Đóng"
          >
            ×
          </button>
        </div>
        <form className="warehouse-modal-body" onSubmit={submit}>
          <AutoDismissMessage message={error} className="warehouse-error" />
          {loading ? (
            <Skeleton variant="form" rows={3} />
          ) : (
            <>
              <label className="warehouse-field">
                <span>Kho xuất hàng</span>
                <select value={warehouseId} onChange={(event) => {
                  setWarehouseId(event.target.value);
                  setItems([]);
                  setProducts([]);
                }} required>
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
                  ))}
                </select>
              </label>
              <div className="warehouse-section-heading">
                <h3>Sản phẩm hư hỏng</h3>
                <button
                  type="button"
                  onClick={() =>
                    setItems((current) => [
                      ...current,
                      { product_id: "", quantity: "1", damage_reason: "" },
                    ])
                  }
                >
                  + Thêm sản phẩm
                </button>
              </div>
              <div className="warehouse-editor-items">
                {items.map((item, index) => {
                  const selected = products.find(
                    (product) => String(product.id) === String(item.product_id),
                  );
                  return (
                    <div
                      className="warehouse-editor-item damage-editor-item"
                      key={`${item.product_id || "new"}-${index}`}
                    >
                      <div className="warehouse-product-field">
                        <SharedSearchableDropdown
                          value={item.product_id}
                          placeholder="Chọn sản phẩm"
                          ariaLabel="Chọn sản phẩm hư"
                          onChange={(value) =>
                            updateItem(index, "product_id", String(value))
                          }
                          options={[
                            { value: "", label: "Chọn sản phẩm" },
                            ...products.map((product) => ({
                              value: product.id,
                              label: product.name,
                            })),
                          ]}
                        />
                        {selected && (
                          <small>
                            Tồn hiện tại: {selected.available_stock}{" "}
                            {selected.unit}
                          </small>
                        )}
                      </div>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={item.quantity}
                        onChange={(event) =>
                          updateItem(index, "quantity", event.target.value)
                        }
                        placeholder="Số lượng"
                        aria-label="Số lượng hư"
                      />
                      <input
                        value={item.damage_reason}
                        onChange={(event) =>
                          updateItem(index, "damage_reason", event.target.value)
                        }
                        placeholder="Lý do hư hỏng"
                        aria-label="Lý do hư hỏng"
                      />
                      <button
                        type="button"
                        className="warehouse-remove"
                        onClick={() =>
                          setItems((current) =>
                            current.filter(
                              (_, itemIndex) => itemIndex !== index,
                            ),
                          )
                        }
                        aria-label="Xóa sản phẩm"
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
              <label className="warehouse-field">
                <span>Ghi chú</span>
                <textarea
                  rows="3"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Nhập ghi chú cho phiếu hàng hư"
                />
              </label>
              <div className="warehouse-modal-actions">
                <button type="button" onClick={onClose} disabled={saving}>
                  Hủy
                </button>
                <button
                  type="submit"
                  className="warehouse-primary-button"
                  disabled={saving}
                >
                  {saving ? "Đang gửi..." : "Gửi phiếu báo hư"}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>,
    document.body,
  );
}

function DamageReports() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [reports, setReports] = useState([]);
  const [status, setStatus] = useState(() => searchParams.get("status") || "");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total_pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useNotificationState();
  const [selected, setSelected] = useState(null);
  const [editor, setEditor] = useState(false);
  const [reviewAction, setReviewAction] = useState(null);
  const [reviewNote, setReviewNote] = useState("");
  const [reviewValidationError, setReviewValidationError] = useState("");
  const [reviewLoading, setReviewLoading] = useState(false);
  const currentUser = (() => {
    try {
      return JSON.parse(localStorage.getItem("user")) || {};
    } catch {
      return {};
    }
  })();
  const canCreateDamageReport = currentUser.role === "thủ kho";
  const canReviewDamageReport = currentUser.role === "quản lý";
  const fetchReports = useCallback(async () => {
    if (!localStorage.getItem("token"))
      return navigate("/login", {
        replace: true,
        state: { message: "Vui lòng đăng nhập để xem phiếu hàng hư." },
      });
    try {
      setLoading(true);
      setError("");
      const response = await authApis().get(endpoints.damageReports, {
        params: { page, per_page: PER_PAGE, status: status || undefined },
      });
      setReports(response.data?.reports || []);
      setPagination(response.data?.pagination || { total_pages: 1 });
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setLoading(false);
    }
  }, [navigate, page, status]);
  useEffect(() => {
    fetchReports();
  }, [fetchReports]);
  const openDetail = async (reportId) => {
    try {
      setError("");
      const response = await authApis().get(
        endpoints.damageReportDetail(reportId),
      );
      setSelected(response.data);
    } catch (requestError) {
      setError(getApiError(requestError));
    }
  };

  const openReviewDialog = (decision) => {
    setReviewNote("");
    setReviewValidationError("");
    setReviewAction({ decision });
  };

  const submitReview = async () => {
    if (!reviewAction || !selected) return;
    const note = reviewNote.trim();
    if (reviewAction.decision === "rejected" && !note) {
      setReviewValidationError("Vui lòng nhập lý do từ chối phiếu hàng hư.");
      return;
    }

    try {
      setReviewLoading(true);
      setError("");
      const endpoint = reviewAction.decision === "approved"
        ? endpoints.damageReportApprove(selected.id)
        : endpoints.damageReportReject(selected.id);
      const response = await authApis().patch(endpoint, {
        review_note: note || undefined,
      });
      setSelected(response.data?.report || selected);
      setReviewAction(null);
      setReviewNote("");
      setReviewValidationError("");
      await fetchReports();
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setReviewLoading(false);
    }
  };
  return (
    <div className="warehouse-page">
      <div className="warehouse-page-header">
        <div>
          <h1>Phiếu hàng hư hỏng</h1>
        </div>
      </div>
      <div className="warehouse-toolbar damage-reports-toolbar">
        <div className="damage-reports-status-filter">
          <SharedSearchableDropdown
            value={status}
            options={STATUS_OPTIONS}
            placeholder="Tất cả trạng thái"
            onChange={(value) => {
              setPage(1);
              setStatus(String(value));
            }}
            ariaLabel="Lọc trạng thái phiếu hàng hư"
          />
        </div>
        {canCreateDamageReport && (
          <button
            type="button"
            className="warehouse-primary-button damage-report-create-button"
            onClick={() => setEditor(true)}
          >
            + Báo hàng hư
          </button>
        )}
      </div>
      <AutoDismissMessage message={error} className="warehouse-error" />
      <div className="warehouse-card">
        {loading ? (
          <Skeleton rows={6} columns={5} />
        ) : reports.length === 0 ? (
          <div className="warehouse-state">Chưa có phiếu hàng hư phù hợp.</div>
        ) : (
          <div className="warehouse-table-wrap">
            <table className="warehouse-table warehouse-clickable-table">
              <thead>
                <tr>
                  <th>Ngày báo</th>
                  <th>Trạng thái</th>
                  <th>Số sản phẩm</th>
                  <th>Người báo</th>
                  <th>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => (
                  <tr
                    key={report.id}
                    tabIndex="0"
                    onClick={() => openDetail(report.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") openDetail(report.id);
                    }}
                  >
                    <td>{formatDate(report.reported_at)}</td>
                    <td>
                      <span
                        className={`warehouse-status warehouse-status-${report.status}`}
                      >
                        {statusLabel(report.status)}
                      </span>
                    </td>
                    <td>{report.items_count || report.items?.length || 0}</td>
                    <td>{report.reported_by?.full_name || "—"}</td>
                    <td>{report.note || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <Pagination
        page={page}
        totalPages={Number(pagination.total_pages || 1)}
        onPageChange={setPage}
        disabled={loading}
      />
      {selected && (
        <DamageDetail
          report={selected}
          canReview={canReviewDamageReport}
          onReview={openReviewDialog}
          onClose={() => {
            setReviewAction(null);
            setSelected(null);
          }}
        />
      )}
      {editor && (
        <DamageEditor
          onClose={() => setEditor(false)}
          onSaved={() => {
            setEditor(false);
            fetchReports();
          }}
        />
      )}
      <ConfirmDialog
        open={Boolean(reviewAction)}
        title={reviewAction?.decision === "approved" ? "Duyệt phiếu hàng hư?" : "Từ chối phiếu hàng hư?"}
        message={(
          <div className="warehouse-review-dialog-content">
            <p>
              {reviewAction?.decision === "approved"
                ? "Phiếu sẽ được ghi nhận là đã duyệt và cập nhật tồn kho."
                : "Vui lòng nhập lý do để người lập phiếu biết vì sao phiếu bị từ chối."}
            </p>
            {reviewAction?.decision === "rejected" && (
              <textarea
                value={reviewNote}
                onChange={(event) => {
                  setReviewNote(event.target.value);
                  setReviewValidationError("");
                }}
                placeholder="Nhập lý do từ chối"
                rows={4}
                autoFocus
              />
            )}
            {reviewValidationError && (
              <small className="warehouse-review-dialog-error">{reviewValidationError}</small>
            )}
          </div>
        )}
        confirmLabel={reviewAction?.decision === "approved" ? "Duyệt phiếu" : "Từ chối phiếu"}
        onConfirm={submitReview}
        onCancel={() => {
          if (!reviewLoading) {
            setReviewValidationError("");
            setReviewAction(null);
          }
        }}
        loading={reviewLoading}
        danger={reviewAction?.decision === "rejected"}
      />
    </div>
  );
}

export default DamageReports;
