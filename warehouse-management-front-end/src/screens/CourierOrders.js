import React, { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { authApis, endpoints } from "../configs/Apis";
import AutoDismissMessage from "../components/AutoDismissMessage";
import ConfirmDialog from "../components/ConfirmDialog";
import Pagination from "../components/Pagination";
import SharedSearchableDropdown from "../components/SearchableDropdown";
import { getApiError } from "../utils/apiError";
import "../css/CourierOrders.css";

function deliveryStatus(status, accountingHandoffAt) {
  if (status === "đang giao" && accountingHandoffAt) return "Chờ kế toán";
  return {
    "đang xử lý": "Chờ bắt đầu giao",
    "đang giao": "Đang giao",
    "hoàn thành": "Hoàn thành",
    "đã hủy": "Đã hủy",
  }[status] || status;
}

export default function CourierOrders() {
  const user = (() => {
    try { return JSON.parse(localStorage.getItem("user")) || {}; } catch { return {}; }
  })();
  const [orders, setOrders] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [startConfirm, setStartConfirm] = useState(false);
  const [deliveredConfirm, setDeliveredConfirm] = useState(false);
  const [accountants, setAccountants] = useState([]);
  const [accountantId, setAccountantId] = useState("");
  const [recipient, setRecipient] = useState("");
  const [deliveryNote, setDeliveryNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (user.role !== "nhân viên giao hàng") return;
    try {
      setLoading(true);
      setError("");
      const response = await authApis().get(endpoints.myDeliveries, { params: { page, per_page: 10 } });
      setOrders(response.data?.invoices || []);
      setTotalPages(Number(response.data?.pagination?.total_pages || 1));
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setLoading(false);
    }
  }, [page, user.role]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    window.addEventListener("sales-invoices:realtime-refresh", load);
    return () => window.removeEventListener("sales-invoices:realtime-refresh", load);
  }, [load]);

  const openDetail = async (id) => {
    setDetailLoading(true);
    setError("");
    try {
      const response = await authApis().get(endpoints.myDeliveryDetail(id));
      setDetail(response.data?.invoice || null);
      const invoice = response.data?.invoice;
      if (invoice?.status === "đang giao" && !invoice.accounting_handoff_at) {
        const staff = await authApis().get(endpoints.salesInvoiceAssignees, {
          params: { stage: "accounting", warehouse_id: invoice.warehouse_id },
        });
        const list = staff.data?.employees || [];
        setAccountants(list);
        setAccountantId(list[0] ? String(list[0].id) : "");
        setRecipient(invoice.customer?.full_name || "");
        setDeliveryNote("");
      }
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setDetailLoading(false);
    }
  };

  const startDelivery = async () => {
    if (!detail) return;
    try {
      setSaving(true);
      setError("");
      const response = await authApis().post(endpoints.startMyDelivery(detail.id));
      setDetail(response.data?.invoice || null);
      setStartConfirm(false);
      await load();
    } catch (requestError) {
      setStartConfirm(false);
      setError(getApiError(requestError));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelivered = async () => {
    if (!detail || !recipient.trim() || !accountantId) return;
    try {
      setSaving(true);
      setError("");
      const response = await authApis().post(endpoints.deliveredMyDelivery(detail.id), {
        accountant_id: Number(accountantId), recipient: recipient.trim(), note: deliveryNote.trim(),
      });
      setDetail(response.data?.invoice || null);
      setDeliveredConfirm(false);
      await load();
    } catch (requestError) {
      setDeliveredConfirm(false);
      setError(getApiError(requestError));
    } finally {
      setSaving(false);
    }
  };

  const acceptDelivery = async () => {
    if (!detail) return;
    try {
      setSaving(true);
      setError("");
      const response = await authApis().post(endpoints.acceptMyDelivery(detail.id));
      setDetail(response.data?.invoice || null);
      await load();
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setSaving(false);
    }
  };

  if (user.role !== "nhân viên giao hàng") {
    return <div className="courier-page">Bạn không có quyền xem đơn giao hàng.</div>;
  }

  return (
    <div className="courier-page">
      <div className="courier-heading">
        <div>
          <h1>Đơn giao hàng của tôi</h1>
          <p>Chỉ những đơn được phân công cho bạn mới xuất hiện ở đây.</p>
        </div>
        <button type="button" onClick={load} disabled={loading}>Làm mới</button>
      </div>
      <AutoDismissMessage message={error} className="courier-error" />
      {loading ? <div className="courier-empty">Đang tải đơn giao hàng...</div> : orders.length === 0 ? (
        <div className="courier-empty">Bạn chưa được phân công đơn giao hàng nào.</div>
      ) : (
        <div className="courier-list">
          {orders.map((order) => (
            <button type="button" className="courier-order" key={order.id} onClick={() => openDetail(order.id)} disabled={detailLoading}>
              <span className="courier-order-main"><strong>Đơn #{order.id} · {order.customer.full_name}</strong><small>{order.customer.address}</small></span>
              <span className="courier-order-status">{deliveryStatus(order.status, order.accounting_handoff_at)}</span>
            </button>
          ))}
        </div>
      )}
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} disabled={loading} />

      {detail && createPortal(
        <div className="courier-modal-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setDetail(null); }}>
          <div className="courier-modal" role="dialog" aria-modal="true" aria-labelledby="courier-detail-title">
            <div className="courier-modal-header"><h2 id="courier-detail-title">Đơn giao hàng #{detail.id}</h2><button type="button" onClick={() => setDetail(null)} aria-label="Đóng">×</button></div>
            <div className="courier-modal-body">
              <span className="courier-order-status">{deliveryStatus(detail.status, detail.accounting_handoff_at)}</span>
              {detail.accounting_handoff_at && <p>Đã giao cho {detail.delivery_recipient || "khách hàng"} và bàn giao kế toán.</p>}
              <dl>
                <div><dt>Người nhận</dt><dd>{detail.customer.full_name}</dd></div>
                <div><dt>Số điện thoại</dt><dd><a href={`tel:${detail.customer.phone}`}>{detail.customer.phone}</a></dd></div>
                <div><dt>Địa chỉ giao</dt><dd>{detail.customer.address}</dd></div>
                <div><dt>Kho xuất</dt><dd>{detail.warehouse}</dd></div>
              </dl>
              <h3>Hàng cần giao</h3>
              <ul>{detail.items.map((item, index) => <li key={`${item.product_name}-${index}`}><span>{item.product_name}</span><strong>{item.quantity} {item.unit}</strong></li>)}</ul>
              {detail.cancel_requested && <p className="courier-warning">Đơn đang chờ xử lý yêu cầu hủy.</p>}
              {detail.status === "đang giao" && !detail.accounting_handoff_at && !detail.cancel_requested && (
                <div className="courier-delivery-proof">
                  <label>Người thực nhận hàng
                    <input value={recipient} onChange={(event) => setRecipient(event.target.value)} maxLength={120} />
                  </label>
                  <label>Ghi chú giao hàng
                    <input value={deliveryNote} onChange={(event) => setDeliveryNote(event.target.value)} maxLength={1000} />
                  </label>
                  <label>Kế toán tiếp nhận</label>
                  <SharedSearchableDropdown value={accountantId} onChange={setAccountantId}
                    options={[{ value: "", label: "Chọn kế toán" }, ...accountants.map((person) => ({
                      value: String(person.id), label: `${person.full_name} · ${person.active_count} đơn đang phụ trách`,
                    }))]}
                    placeholder="Chọn kế toán" ariaLabel="Kế toán tiếp nhận đơn" />
                  {!accountants.length && <p>Chưa có kế toán hoạt động để nhận đơn.</p>}
                </div>
              )}
            </div>
            <div className="courier-modal-actions">
              <button type="button" onClick={() => setDetail(null)}>Đóng</button>
              {detail.status === "đang xử lý" && !detail.cancel_requested && (
                <button type="button" className="courier-primary" onClick={() => setStartConfirm(true)}>Bắt đầu giao hàng</button>
              )}
              {detail.status === "đang giao" && !detail.accounting_handoff_at && !detail.accepted_at && !detail.cancel_requested && (
                <button type="button" className="courier-primary" onClick={acceptDelivery} disabled={saving}>Nhận đơn được phân lại</button>
              )}
              {detail.status === "đang giao" && !detail.accounting_handoff_at && !detail.cancel_requested && (
                <button type="button" className="courier-primary" disabled={!detail.accepted_at || !recipient.trim() || !accountantId}
                  onClick={() => setDeliveredConfirm(true)}>Xác nhận đã giao</button>
              )}
            </div>
          </div>
        </div>, document.body,
      )}
      <ConfirmDialog
        open={startConfirm}
        title="Bắt đầu giao hàng?"
        message={`Đơn #${detail?.id || ""} sẽ chuyển sang trạng thái Đang giao và ghi nhận bạn là người bắt đầu giao.`}
        confirmLabel="Bắt đầu giao"
        onConfirm={startDelivery}
        onCancel={() => setStartConfirm(false)}
        loading={saving}
      />
      <ConfirmDialog open={deliveredConfirm} title="Xác nhận đã giao hàng?"
        message={`Đơn #${detail?.id || ""} sẽ chuyển cho kế toán tiếp nhận.`}
        confirmLabel="Xác nhận đã giao" onConfirm={confirmDelivered}
        onCancel={() => setDeliveredConfirm(false)} loading={saving} />
    </div>
  );
}
