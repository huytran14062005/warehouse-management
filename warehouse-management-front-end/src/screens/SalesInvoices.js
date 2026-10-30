import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useSearchParams } from "react-router-dom";
import { authApis, endpoints } from "../configs/Apis";
import { getApiError } from "../utils/apiError";
import useNotificationState from "../utils/useNotificationState";
import { notifyInventoryChanged } from "../utils/inventoryEvents";
import ConfirmDialog from "../components/ConfirmDialog";
import AutoDismissMessage from "../components/AutoDismissMessage";
import MoneyInput from "../components/MoneyInput";
import ProductRequestModal from "../components/ProductRequestModal";
import SharedSearchableDropdown from "../components/SearchableDropdown";
import CustomerFields from "../components/CustomerFields";
import PaymentMethodDropdown from "../components/PaymentMethodDropdown";
import { ProductEntryField, ProductEntryInfo } from "../components/ProductEntryFields";
import { getSalePriceBounds } from "../utils/salePrice";
import Pagination from "../components/Pagination";
import Skeleton from "../components/Skeleton";
import "../css/SalesInvoices.css";

const PER_PAGE = 10;
const DISCOUNT_PER_PAGE = 10;
let cachedSalesAreas = null;
let salesAreasRequest = null;

async function getSalesAreasOnce() {
  if (cachedSalesAreas) return cachedSalesAreas;
  if (!salesAreasRequest) {
    salesAreasRequest = authApis()
      .get(endpoints.salesAreas)
      .then((response) => {
        cachedSalesAreas = response.data?.sales_areas || [];
        return cachedSalesAreas;
      })
      .finally(() => {
        salesAreasRequest = null;
      });
  }
  return salesAreasRequest;
}

const STATUS_OPTIONS = [
  { value: "", label: "Tất cả trạng thái" },
  { value: "nháp", label: "Nháp" },
  { value: "chờ kho", label: "Chờ kho" },
  { value: "đang xử lý", label: "Đang xử lý" },
  { value: "đang giao", label: "Đang giao" },
  { value: "đã giao", label: "Đã giao" },
  { value: "hoàn thành", label: "Hoàn thành" },
  { value: "đã hủy", label: "Đã hủy" },
];

const DEBT_STATUS_OPTIONS = [
  { value: "", label: "Không lọc hạn thanh toán" },
  { value: "overdue", label: "Quá hạn thanh toán" },
  { value: "due_today", label: "Đến hạn hôm nay" },
  { value: "due_soon", label: "Sắp đến hạn (7 ngày)" },
];

function formatCurrency(value) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatQuantity(value) {
  return new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function notifySalesActionCountChanged() {
  window.dispatchEvent(new Event("sales-invoices:action-count-refresh"));
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const pad = (number) => String(number).padStart(2, "0");
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDate(value) {
  if (!value) return "—";
  const [year, month, day] = String(value).split("-");
  return year && month && day ? `${day}/${month}/${year}` : "—";
}

function getPaymentDueLabel(invoice) {
  if (invoice.payment_due_status === "overdue") {
    return `Quá hạn ${Number(invoice.days_overdue || 0)} ngày`;
  }
  if (invoice.payment_due_status === "due_today") return "Đến hạn hôm nay";
  if (["due_soon", "not_due"].includes(invoice.payment_due_status)) {
    return `Còn ${Number(invoice.days_until_due || 0)} ngày`;
  }
  return invoice.payment_due_date ? "Đã có hạn thanh toán" : "Chưa đặt hạn";
}

function getPaymentDueUrgencyClass(invoice) {
  if (invoice.payment_due_status === "overdue") return "is-overdue";
  const days = Number(invoice.days_until_due);
  if (invoice.payment_due_status === "due_today" || days <= 1) return "is-due-red";
  if (days <= 3) return "is-due-orange-dark";
  if (days <= 6) return "is-due-orange-light";
  return "is-due-yellow";
}

export function SalesInvoiceDueCell({ invoice }) {
  if (!isCompletedStatus(invoice.status) || isCancelledStatus(invoice.status)) {
    return <span className="sales-due-empty">—</span>;
  }
  if (Number(invoice.remaining_amount || 0) <= 0) {
    return <span className="sales-due-empty">Đã thanh toán</span>;
  }
  if (!invoice.payment_due_date) {
    return <span className="sales-due-empty">Chưa đặt hạn</span>;
  }
  return (
    <div className="sales-due-cell">
      <span>{formatDate(invoice.payment_due_date)}</span>
      {["overdue", "due_today", "due_soon", "not_due"].includes(invoice.payment_due_status) && (
        <span className={`sales-due-badge ${getPaymentDueUrgencyClass(invoice)}`}>
          {getPaymentDueLabel(invoice)}
        </span>
      )}
    </div>
  );
}

function getStatusClass(status) {
  const value = String(status || "").toLowerCase();
  if (value === "nháp" || value === "draft") return "sales-status-draft";
  if (value === "chờ kho") return "sales-status-processing";
  if (value === "đã giao") return "sales-status-completed";
  if (value === "đang xử lý" || value === "processing")
    return "sales-status-processing";
  if (value === "đang giao" || value === "delivering")
    return "sales-status-delivering";
  if (value === "hoàn thành" || value === "completed")
    return "sales-status-completed";
  if (value === "đã hủy" || value === "cancelled")
    return "sales-status-cancelled";
  return "sales-status-default";
}

function getStatusLabel(status) {
  const option = STATUS_OPTIONS.find((item) => item.value === status);
  return option?.label || status || "Không xác định";
}

export function requiresSalesInvoiceAction(invoice, user) {
  const role = user?.role;
  const ownsInvoice = Number(user?.id) === Number(invoice.employee?.id) && user?.id != null;
  if (invoice.cancel_requested) return ["kế toán", "quản lý"].includes(role);
  if (role === "quản lý" && invoice.discount?.status === "chờ duyệt" && !ownsInvoice) return true;
  if (invoice.status === "nháp") {
    if (invoice.warehouse_submitted_at) return ["thủ kho", "quản lý"].includes(role);
    return role === "quản lý" || (role === "nhân viên bán hàng" && ownsInvoice);
  }
  if (invoice.status === "đang xử lý") return ["thủ kho", "quản lý"].includes(role);
  if (invoice.status === "đang giao") {
    if (invoice.delivered_at) return role === "kế toán" && !["chờ duyệt", "từ chối"].includes(invoice.discount?.status);
    return role === "quản lý" || (role === "nhân viên bán hàng" && ownsInvoice);
  }
  return false;
}

function isCompletedStatus(status) {
  const value = String(status || "").toLowerCase();
  return value === "hoàn thành" || value === "completed";
}

function isCancelledStatus(status) {
  const value = String(status || "").toLowerCase();
  return value === "đã hủy" || value === "cancelled";
}

function getPaymentStatusLabel(status) {
  const value = String(status || "").toLowerCase();
  if (value === "đã thanh toán" || value === "paid") return "Đã thanh toán";
  if (value === "thanh toán một phần" || value === "partial") {
    return "Đã thanh toán một phần";
  }
  return "Chưa ghi nhận thanh toán";
}

function getPaymentStatusClass(status) {
  const value = String(status || "").toLowerCase();
  if (value === "đã thanh toán" || value === "paid") return "is-paid";
  if (value === "thanh toán một phần" || value === "partial") {
    return "is-partial";
  }
  return "is-unpaid";
}

function evaluatePromotionForOrder(promotion, subtotal, totalQuantity, ignoreDates = false) {
  if (!promotion) return { eligible: true, discount: 0, reason: "" };
  const currentDate = new Date();
  const today = [
    currentDate.getFullYear(),
    String(currentDate.getMonth() + 1).padStart(2, "0"),
    String(currentDate.getDate()).padStart(2, "0"),
  ].join("-");
  if (!ignoreDates && promotion.start_date && today < promotion.start_date) {
    return { eligible: false, discount: 0, reason: "Khuyến mãi chưa đến thời gian áp dụng." };
  }
  if (!ignoreDates && promotion.end_date && today > promotion.end_date) {
    return { eligible: false, discount: 0, reason: "Khuyến mãi đã hết hạn." };
  }
  if (
    promotion.condition_type === "min_quantity" &&
    totalQuantity < Number(promotion.min_quantity || 0)
  ) {
    return {
      eligible: false,
      discount: 0,
      reason: `Cần mua thêm ${Number(promotion.min_quantity || 0) - totalQuantity} sản phẩm.`,
    };
  }
  if (
    promotion.condition_type === "min_order_amount" &&
    subtotal < Number(promotion.min_order_amount || 0)
  ) {
    return {
      eligible: false,
      discount: 0,
      reason: `Giá trị đơn chưa đạt ${formatCurrency(promotion.min_order_amount)}.`,
    };
  }
  let discount = Number(promotion.discount_value || 0);
  if (promotion.discount_type === "percentage") {
    discount = subtotal * discount / 100;
    if (Number(promotion.max_discount_amount || 0) > 0) {
      discount = Math.min(discount, Number(promotion.max_discount_amount));
    }
  }
  discount = Math.min(Math.max(0, discount), subtotal);
  return {
    eligible: discount > 0,
    discount,
    reason: discount > 0 ? "Đủ điều kiện áp dụng." : "Đơn chưa phát sinh giá trị để giảm.",
  };
}

function hasActiveCancelRequest(invoice) {
  const status = String(invoice?.status || "").toLowerCase();
  return Boolean(
    invoice?.cancel_requested &&
      ["đang xử lý", "đang giao", "processing", "delivering"].includes(status),
  );
}

function validateSaleDateRange(fromDate, toDate) {
  if (fromDate && toDate && fromDate > toDate) {
    return "Ngày bắt đầu không được lớn hơn ngày kết thúc.";
  }
  return "";
}

function SalesDetailLine({ label, children, className = "" }) {
  return (
    <div className={`sales-detail-line ${className}`.trim()}>
      <dt>{label}:</dt>
      <dd>{children}</dd>
    </div>
  );
}

function SalesPaymentFields({
  amount,
  onAmountChange,
  method,
  onMethodChange,
  total,
  amountLabel,
  dueDate,
  onDueDateChange,
}) {
  const changeAmount = method === "cash" ? Math.max(0, (Number(amount) || 0) - total) : 0;
  return (
    <div className={`sales-payment-entry-fields${dueDate === undefined ? " is-two-columns" : ""}`}>
      <label className="sales-payment-entry-field">
        <span>{amountLabel}</span>
        <MoneyInput
          value={amount}
          onChange={onAmountChange}
          label={amountLabel}
          allowZero
          allowEmpty
          maxAmount={method === "cash" ? null : total}
          placeholder="Ví dụ: 500.000"
          aria-label={amountLabel}
        />
        {changeAmount > 0 && (
          <small className="sales-payment-change" role="status">
            Tiền thối lại: <strong>{formatCurrency(changeAmount)}</strong>
          </small>
        )}
      </label>
      <div className="sales-payment-entry-field">
        <span>Phương thức thanh toán</span>
        <PaymentMethodDropdown value={method} onChange={onMethodChange} />
      </div>
      {dueDate !== undefined && (
        <label className="sales-payment-entry-field">
          <span>Hạn thanh toán</span>
          <input type="date" value={dueDate} onChange={onDueDateChange} />
        </label>
      )}
    </div>
  );
}

export function SalesInvoiceDetail({
  invoice,
  onClose,
  canEdit,
  canCancel,
  canRequestCancel,
  canCancelDirect,
  canManageStatus,
  canComplete,
  canApproveCancel,
  canManageDueDate,
  canRecordPayment,
  canSubmitWarehouse,
  canConfirmDelivery,
  needsAction,
  actionLoading,
  actionError,
  onEdit,
  onCancelDraft,
  onCancelRequest,
  onCancelDirect,
  onAdvanceStatus,
  onComplete,
  onApproveCancel,
  onUpdateDueDate,
  onRecordPayment,
  onSubmitWarehouse,
  onConfirmDelivery,
  onLoadMorePayments,
  paymentHistoryLoading,
}) {
  const [completionPayment, setCompletionPayment] = useState("");
  const [completionPaymentMethod, setCompletionPaymentMethod] = useState("");
  const [deliveryRecipient, setDeliveryRecipient] = useState("");
  const [deliveryNote, setDeliveryNote] = useState("");
  const [paymentDueDate, setPaymentDueDate] = useState(
    invoice.payment_due_date || "",
  );
  const discountAmount = Number(invoice.discount?.amount || 0);
  const paidAmount = Number(invoice.paid_amount || 0);
  const remainingAmount = Number(invoice.remaining_amount || 0);
  const draft = ["nháp", "draft"].includes(String(invoice.status || "").toLowerCase());
  const completed = isCompletedStatus(invoice.status);
  const cancelled = isCancelledStatus(invoice.status);
  const discountPending = invoice.discount?.status === "chờ duyệt";
  const awaitingAccounting = canComplete && invoice.status === "đang giao" && Boolean(invoice.delivered_at) &&
    !invoice.cancel_requested && !["chờ duyệt", "từ chối"].includes(invoice.discount?.status);
  const showPaymentDetails = !draft && !cancelled && (completed || paidAmount > 0 || awaitingAccounting);
  const enteredPayment = Number(completionPayment) || 0;
  const unpaidAfterEntry = Math.max(0, remainingAmount - Math.min(enteredPayment, remainingAmount));
  const invalidPaymentEntry = actionLoading ||
    (enteredPayment > 0 && !completionPaymentMethod) ||
    (completionPaymentMethod !== "cash" && enteredPayment > remainingAmount) ||
    (awaitingAccounting
      ? (unpaidAfterEntry > 0 && !paymentDueDate)
      : enteredPayment <= 0);
  useEffect(() => {
    setCompletionPayment("");
    setCompletionPaymentMethod("");
  }, [invoice.paid_amount]);
  return createPortal(
    <div className="sales-detail-overlay">
      <div
        className="sales-detail-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sales-detail-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sales-detail-header">
          <div>
            <p className="sales-detail-eyebrow">ĐƠN BÁN HÀNG</p>
            <h2 id="sales-detail-title">Đơn hàng #{invoice.id}</h2>
          </div>
          <div className="sales-detail-header-tools">
            <strong
              className={`sales-status-badge sales-detail-status ${getStatusClass(invoice.workflow_stage || invoice.status)}`}
            >
              {getStatusLabel(invoice.workflow_stage || invoice.status)}
              {needsAction && <span className="sales-action-dot" aria-label="Đơn hàng cần xử lý" />}
            </strong>
            <button
              type="button"
              className="sales-detail-close"
              onClick={onClose}
              aria-label="Đóng"
            >
              ×
            </button>
          </div>
        </div>
        <div className="sales-detail-body">
          <AutoDismissMessage message={actionError} className="sales-alert" />
          <div className="sales-detail-overview">
            <section className="sales-detail-info-section">
              <h3>Thông tin đơn</h3>
              <dl>
                <SalesDetailLine label="Thời gian lập đơn">{formatDateTime(invoice.sold_at)}</SalesDetailLine>
                <SalesDetailLine label="Nhân viên lập đơn">{invoice.employee?.full_name || "—"}</SalesDetailLine>
                <SalesDetailLine label="Nguồn hàng">
                  {invoice.sale_source === "hàng nhân viên"
                    ? "Hàng nhân viên đi tỉnh"
                    : invoice.warehouse?.name || "Kho"}
                </SalesDetailLine>
              </dl>
            </section>

            <section className="sales-detail-info-section">
              <h3>Khách hàng</h3>
              <dl>
                <SalesDetailLine label="Họ và tên">{invoice.customer?.full_name || "—"}</SalesDetailLine>
                <SalesDetailLine label="Số điện thoại">{invoice.customer?.phone || "—"}</SalesDetailLine>
                <SalesDetailLine label="Địa chỉ giao hàng">{invoice.customer?.address || "—"}</SalesDetailLine>
              </dl>
            </section>
          </div>

          <div className="sales-detail-items-wrap">
            <div className="sales-detail-section-heading">
              <h3>Sản phẩm</h3>
              <span>{invoice.items?.length || 0} mặt hàng</span>
            </div>
            {invoice.items?.length ? (
              <div className="sales-detail-table-wrap">
                <table className="sales-detail-items">
                  <thead>
                    <tr>
                      <th>Sản phẩm</th>
                      <th>Đơn vị</th>
                      <th>Số lượng</th>
                      <th>Đơn giá</th>
                      <th className="sales-money">Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.items.map((item) => (
                      <tr key={item.id}>
                        <td>{item.product_name}</td>
                        <td>{item.unit || "—"}</td>
                        <td>{formatQuantity(item.quantity)}</td>
                        <td>{formatCurrency(item.unit_price)}</td>
                        <td className="sales-money">
                          {formatCurrency(item.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="sales-detail-empty">Đơn hàng chưa có sản phẩm.</p>
            )}
          </div>

          <section className="sales-detail-payment">
            {showPaymentDetails && (
              <div className="sales-detail-section-heading">
                <h3>Thanh toán</h3>
                <span className={`sales-payment-status ${getPaymentStatusClass(invoice.payment_status)}`}>
                  {getPaymentStatusLabel(invoice.payment_status)}
                </span>
              </div>
            )}
            <dl>
              {!draft && !cancelled && discountAmount > 0 && (
                <SalesDetailLine label={`Khuyến mãi${discountPending ? " (chờ duyệt)" : ""}`}>
                  -{formatCurrency(discountAmount)}
                </SalesDetailLine>
              )}
              <SalesDetailLine
                label={cancelled ? "Giá trị đơn trước khi hủy" : "Tổng tiền đơn"}
                className="sales-payment-total"
              >
                {formatCurrency(invoice.final_amount)}
              </SalesDetailLine>
              {!draft && paidAmount > 0 && (
                <SalesDetailLine label="Khách đã trả">{formatCurrency(paidAmount)}</SalesDetailLine>
              )}
              {showPaymentDetails && (completed || awaitingAccounting) && remainingAmount > 0 && (
                <SalesDetailLine label="Số tiền cần trả" className="sales-payment-remaining">
                  {formatCurrency(remainingAmount)}
                </SalesDetailLine>
              )}
              {showPaymentDetails && completed && remainingAmount > 0 && invoice.payment_due_date && (
                <SalesDetailLine label="Hạn thanh toán">{formatDate(invoice.payment_due_date)}</SalesDetailLine>
              )}
              {showPaymentDetails && completed && remainingAmount > 0 && invoice.payment_due_date &&
                ["overdue", "due_today", "due_soon", "not_due"].includes(invoice.payment_due_status) && (
                  <SalesDetailLine label="Tình trạng hạn" className={`sales-payment-due-status ${getPaymentDueUrgencyClass(invoice)}`}>
                    {getPaymentDueLabel(invoice)}
                  </SalesDetailLine>
                )}
            </dl>
          </section>
          {canManageDueDate && isCompletedStatus(invoice.status) && remainingAmount > 0 && !canRecordPayment && (
            <div className="sales-due-date-editor">
              <label>
                <span>Hạn thanh toán</span>
                <input
                  type="date"
                  value={paymentDueDate}
                  onChange={(event) => setPaymentDueDate(event.target.value)}
                />
              </label>
              <button
                type="button"
                onClick={() => onUpdateDueDate(paymentDueDate)}
                disabled={actionLoading || !paymentDueDate || paymentDueDate === invoice.payment_due_date}
              >
                Lưu hạn thanh toán
              </button>
            </div>
          )}
          {((canRecordPayment && completed && remainingAmount > 0) || awaitingAccounting) && (
            <div className="sales-detail-actions sales-complete-actions">
              <div className="sales-completion-heading">
                <strong>Ghi nhận thanh toán</strong>
              </div>
              <SalesPaymentFields
                amount={completionPayment}
                onAmountChange={setCompletionPayment}
                method={completionPaymentMethod}
                onMethodChange={setCompletionPaymentMethod}
                total={remainingAmount}
                amountLabel="Số tiền khách trả"
                dueDate={canManageDueDate || awaitingAccounting ? paymentDueDate : undefined}
                onDueDateChange={(event) => setPaymentDueDate(event.target.value)}
              />
              {awaitingAccounting && unpaidAfterEntry > 0 && !paymentDueDate && (
                <small className="sales-payment-hint">Chọn hạn thanh toán cho số tiền còn nợ.</small>
              )}
              <div className="sales-completion-actions">
                <button
                  type="button"
                  onClick={() => awaitingAccounting
                    ? onComplete(enteredPayment, completionPaymentMethod || null, paymentDueDate)
                    : onRecordPayment(enteredPayment, completionPaymentMethod, paymentDueDate)}
                  disabled={invalidPaymentEntry}
                >
                  Lưu thanh toán
                </button>
              </div>
            </div>
          )}
          {!draft && invoice.payments?.length > 0 && (
            <section className="sales-payment-history" aria-label="Lịch sử thanh toán">
              <h4>Lịch sử thanh toán{invoice.payments_total > 0 ? ` (${invoice.payments_total})` : ""}</h4>
              {invoice.payments.map((payment) => (
                <div key={payment.id}>
                  <span>
                    {payment.payment_method === "cash"
                      ? "Tiền mặt"
                      : payment.payment_method === "bank_transfer"
                        ? "Chuyển khoản"
                        : "Chưa xác định"}
                    {" ("}<time dateTime={payment.paid_at}>{formatDateTime(payment.paid_at)}</time>{")"}
                    <small>Người xác nhận thanh toán: {payment.confirmed_by?.full_name || "Chưa có thông tin"}</small>
                    {payment.note?.startsWith("Khách đưa ") && <small>{payment.note}</small>}
                  </span>
                  <strong>{formatCurrency(payment.amount)}</strong>
                </div>
              ))}
              {invoice.payments.length < Number(invoice.payments_total || invoice.payments.length) &&
                Number(invoice.payments_page || 1) < Math.ceil(Number(invoice.payments_total || 0) / 20) && (
                <button type="button" className="sales-payment-more" onClick={onLoadMorePayments} disabled={paymentHistoryLoading}>
                  {paymentHistoryLoading ? "Đang tải..." : "Xem thêm thanh toán"}
                </button>
              )}
            </section>
          )}
          {invoice.cancel_note && (
            <div className="sales-detail-cancel-note">
              <span>Lý do hủy:</span>
              <p>{invoice.cancel_note}</p>
            </div>
          )}
          {invoice.note && (
            <div className="sales-detail-note">
              <span>Ghi chú:</span>
              <p>{invoice.note}</p>
            </div>
          )}
          {Boolean(invoice.workflow_events?.length) && (
            <details className="sales-workflow-history">
              <summary>Lịch sử xử lý ({invoice.workflow_events.length} gần nhất)</summary>
              <ol>
                {[...invoice.workflow_events].reverse().map((event) => (
                  <li key={event.id}>
                    <div className="sales-workflow-entry-line">
                      <span>{({
                        submitted_to_warehouse: "Đã gửi kho",
                        warehouse_processing: "Kho bắt đầu xử lý",
                        dispatched: "Đã xuất xe giao hàng",
                        delivery_confirmed: "Đã xác nhận giao hàng",
                        completed: "Kế toán hoàn thành đơn",
                        cancelled: "Đã hủy đơn",
                      })[event.action] || event.action}</span>
                      <time dateTime={event.occurred_at}>({formatDateTime(event.occurred_at)})</time>
                    </div>
                    <small>{event.actor || "Nhân viên"}{event.detail ? ` · ${event.detail}` : ""}</small>
                  </li>
                ))}
              </ol>
            </details>
          )}
          {(canEdit || canCancel || canApproveCancel) && (
            <div className="sales-detail-actions">
              {canEdit && invoice.status === "nháp" && !invoice.warehouse_submitted_at && (
                <button type="button" onClick={onEdit} disabled={actionLoading}>
                  Chỉnh sửa đơn nháp
                </button>
              )}
              {canCancel && invoice.status === "nháp" && (
                <button
                  type="button"
                  className="sales-action-danger"
                  onClick={onCancelDraft}
                  disabled={actionLoading}
                >
                  Hủy đơn nháp
                </button>
              )}
              {canCancelDirect &&
                ["đang xử lý", "đang giao"].includes(invoice.status) &&
                !invoice.cancel_requested && (
                  <button
                    type="button"
                    className="sales-action-danger"
                    onClick={onCancelDirect}
                    disabled={actionLoading}
                  >
                    Hủy đơn trực tiếp
                  </button>
                )}
              {canRequestCancel &&
                ["đang xử lý", "đang giao"].includes(invoice.status) &&
                !invoice.cancel_requested && (
                  <button
                    type="button"
                    className="sales-action-danger"
                    onClick={onCancelRequest}
                    disabled={actionLoading}
                  >
                    Gửi yêu cầu hủy đơn
                  </button>
                )}
              {hasActiveCancelRequest(invoice) && (
                <span className="sales-cancel-requested">
                  Đã gửi yêu cầu hủy
                </span>
              )}
            </div>
          )}
          {canSubmitWarehouse && invoice.status === "nháp" && !invoice.warehouse_submitted_at && (
            <div className="sales-detail-actions">
              <button type="button" onClick={onSubmitWarehouse} disabled={actionLoading}>
                Gửi đơn cho kho
              </button>
            </div>
          )}
          {canManageStatus && invoice.status === "nháp" && Boolean(invoice.warehouse_submitted_at) && (
            <div className="sales-detail-actions">
              <button
                type="button"
                onClick={() => onAdvanceStatus("đang xử lý")}
                disabled={actionLoading}
              >
                Xác nhận xử lý đơn
              </button>
            </div>
          )}
          {canManageStatus && invoice.status === "đang xử lý" && (
            <div className="sales-detail-actions">
              <button
                type="button"
                onClick={() => onAdvanceStatus("đang giao")}
                disabled={actionLoading}
              >
                Chuyển sang đang giao
              </button>
            </div>
          )}
          {canConfirmDelivery && invoice.status === "đang giao" && !invoice.delivered_at && (
            <form className="sales-delivery-confirm" onSubmit={(event) => {
              event.preventDefault();
              onConfirmDelivery(deliveryRecipient, deliveryNote);
            }}>
              <h3>Xác nhận đã giao hàng</h3>
              <div className="sales-delivery-fields">
                <label>Người nhận
                  <input value={deliveryRecipient} onChange={(event) => setDeliveryRecipient(event.target.value)} maxLength={120} required placeholder="Tên người nhận hàng" />
                </label>
                <label>Ghi chú giao hàng (nếu có)
                  <input value={deliveryNote} onChange={(event) => setDeliveryNote(event.target.value)} maxLength={500} placeholder="Ví dụ: Đã kiểm đủ hàng" />
                </label>
              </div>
              <button type="submit" disabled={actionLoading}>Xác nhận đã giao</button>
            </form>
          )}
          {invoice.delivered_at && (
            <p className="sales-delivery-proof">Đã giao cho {invoice.delivery_recipient} lúc {formatDateTime(invoice.delivered_at)}{invoice.delivery_note ? ` · ${invoice.delivery_note}` : ""}</p>
          )}
          {canApproveCancel && hasActiveCancelRequest(invoice) && (
            <div className="sales-detail-actions">
              {!isCompletedStatus(invoice.status) && (
                <button
                  type="button"
                  onClick={() => onApproveCancel(true)}
                  disabled={actionLoading}
                >
                  Duyệt hủy đơn
                </button>
              )}
              {isCompletedStatus(invoice.status) && (
                <span className="sales-cancel-requested">
                  Đơn đã hoàn thành, không thể duyệt hủy trực tiếp
                </span>
              )}
              <button
                type="button"
                className="sales-action-danger"
                onClick={() => onApproveCancel(false)}
                disabled={actionLoading}
              >
                Từ chối hủy
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function SalesInvoiceEditor({ invoice, onClose, onSaved }) {
  const isEditing = Boolean(invoice?.id);
  const activeUser = (() => {
    try {
      return JSON.parse(localStorage.getItem("user")) || {};
    } catch {
      return {};
    }
  })();
  const canUseEmployeeStock = activeUser.role === "nhân viên bán hàng";
  const [customers, setCustomers] = useState([]);
  const [salesAreas, setSalesAreas] = useState(() => cachedSalesAreas || []);
  const [salesAreasLoading, setSalesAreasLoading] = useState(false);
  const [formError, setFormError] = useNotificationState();
  const [saving, setSaving] = useState(false);
  const [customerMode, setCustomerMode] = useState(
    isEditing ? "existing" : "existing",
  );
  const [customerId, setCustomerId] = useState(
    String(invoice?.customer?.id || ""),
  );
  const [customerSearchInput, setCustomerSearchInput] = useState(
    invoice?.customer?.full_name || "",
  );
  const [selectedCustomer, setSelectedCustomer] = useState(
    invoice?.customer || null,
  );
  const [customerSearchLoading, setCustomerSearchLoading] = useState(false);
  const [saleSource, setSaleSource] = useState(
    invoice?.sale_source === "hàng nhân viên"
      ? "employee_stock"
      : "central_warehouse",
  );
  const [warehouses, setWarehouses] = useState([]);
  const [warehouseId, setWarehouseId] = useState(String(invoice?.warehouse_id || ""));
  const [employeeStock, setEmployeeStock] = useState([]);
  const [employeeStockLoading, setEmployeeStockLoading] = useState(false);
  const [paymentDueDate, setPaymentDueDate] = useState(
    invoice?.payment_due_date || "",
  );
  const [newCustomer, setNewCustomer] = useState({
    full_name: "",
    phone: "",
    address: "",
    sales_area_id: "",
  });
  const [items, setItems] = useState(
    (invoice?.items || []).map((item) => ({
      productId: String(item.product_id),
      productSearch: item.product_name || "",
      unit: item.unit || "",
      defaultPrice: item.default_sale_price != null ? String(item.default_sale_price) : "",
      quantity: String(item.quantity),
      unitPrice: String(item.unit_price),
    })),
  );
  const [selectedPromotion, setSelectedPromotion] = useState(
    invoice?.discount?.promotion || null,
  );
  const [promotionOptions, setPromotionOptions] = useState([]);
  const [promotionPickerOpen, setPromotionPickerOpen] = useState(false);
  const [promotionsLoading, setPromotionsLoading] = useState(false);
  const [note, setNote] = useState(invoice?.note || "");
  const [productSearchResults, setProductSearchResults] = useState({});
  const [productSearchLoading, setProductSearchLoading] = useState({});
  const [productRequestName, setProductRequestName] = useState("");
  const [productRequestOpen, setProductRequestOpen] = useState(false);
  const [combos, setCombos] = useState([]);
  const [comboSuggestion, setComboSuggestion] = useState(null);
  const [comboSets, setComboSets] = useState("1");
  const [applyingCombo, setApplyingCombo] = useState(false);
  const [comboNotice, setComboNotice] = useState("");
  const customerSearchTimerRef = useRef(null);
  const customerSearchTouchedRef = useRef(false);
  const productSearchTimerRefs = useRef({});
  const productSearchRequestRefs = useRef({});

  useEffect(() => {
    let cancelled = false;
    authApis().get(endpoints.warehouses)
      .then((response) => {
        if (cancelled) return;
        setWarehouses(response.data?.warehouses || []);
        setWarehouseId((current) => current || String(response.data?.default_warehouse_id || ""));
      })
      .catch((requestError) => {
        if (!cancelled) setFormError(getApiError(requestError));
      });
    return () => { cancelled = true; };
  }, [setFormError]);

  useEffect(() => {
    if (isEditing || customerMode !== "new" || salesAreas.length) {
      return undefined;
    }

    let cancelled = false;
    const loadSalesAreas = async () => {
      try {
        setSalesAreasLoading(true);
        const areas = await getSalesAreasOnce();
        if (!cancelled) {
          setSalesAreas(areas);
        }
      } catch (requestError) {
        if (!cancelled) setFormError(getApiError(requestError));
      } finally {
        if (!cancelled) setSalesAreasLoading(false);
      }
    };

    loadSalesAreas();
    return () => {
      cancelled = true;
    };
  }, [customerMode, isEditing, salesAreas.length, setFormError]);

  useEffect(() => {
    if (saleSource !== "employee_stock" || isEditing) return undefined;
    let cancelled = false;
    const loadEmployeeStock = async () => {
      try {
        setEmployeeStockLoading(true);
        const response = await authApis().get(endpoints.employeeStock, {
          params: { page: 1, per_page: 1000 },
        });
        if (!cancelled) setEmployeeStock(response.data?.products || []);
      } catch (requestError) {
        if (!cancelled) setFormError(getApiError(requestError));
      } finally {
        if (!cancelled) setEmployeeStockLoading(false);
      }
    };
    loadEmployeeStock();
    return () => {
      cancelled = true;
    };
  }, [isEditing, saleSource]);

  useEffect(() => {
    let active = true;
    authApis().get(endpoints.productCombos)
      .then((response) => {
        if (active) setCombos(response.data?.combos || []);
      })
      .catch((requestError) => {
        if (active) setFormError(getApiError(requestError));
      });
    return () => { active = false; };
  }, [setFormError]);

  useEffect(() => {
    if (!customerSearchTouchedRef.current) return undefined;
    if (customerSearchTimerRef.current)
      clearTimeout(customerSearchTimerRef.current);
    let active = true;

    customerSearchTimerRef.current = setTimeout(async () => {
      try {
        setCustomerSearchLoading(true);
        const keyword = customerSearchInput.trim();
        const response = await authApis().get(endpoints.customers, {
          params: { page: 1, per_page: 100, keyword: keyword || undefined },
        });
        if (active) setCustomers(response.data?.customers || []);
      } catch (requestError) {
        if (active) setFormError(getApiError(requestError));
      } finally {
        if (active) setCustomerSearchLoading(false);
      }
    }, 750);

    return () => {
      active = false;
      if (customerSearchTimerRef.current)
        clearTimeout(customerSearchTimerRef.current);
    };
  }, [customerSearchInput]);

  useEffect(
    () => () => {
      Object.values(productSearchTimerRefs.current).forEach((timer) =>
        clearTimeout(timer),
      );
    },
    [],
  );

  const handleCustomerSearchChange = (value) => {
    customerSearchTouchedRef.current = true;
    setCustomerSearchInput(value);
    setCustomerId("");
    setSelectedCustomer(null);
    setCustomers([]);
    setCustomerSearchLoading(true);
  };

  const handleCustomerSelect = (value) => {
    customerSearchTouchedRef.current = false;
    const selected =
      customers.find((customer) => String(customer.id) === String(value)) ||
      (invoice?.customer && String(invoice.customer.id) === String(value)
        ? invoice.customer
        : null);
    setCustomerId(String(value));
    setSelectedCustomer(selected || null);
    setCustomerSearchInput(selected?.full_name || "");
  };

  const subtotal = items.reduce(
    (total, item) =>
      total + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0),
    0,
  );
  const totalQuantity = items.reduce(
    (total, item) => total + (Number(item.quantity) || 0),
    0,
  );
  const originalPromotionId = invoice?.discount?.promotion?.id;
  const promotionEvaluation = evaluatePromotionForOrder(
    selectedPromotion,
    subtotal,
    totalQuantity,
    isEditing && String(selectedPromotion?.id) === String(originalPromotionId),
  );
  const discount = promotionEvaluation.discount;
  const saleProducts =
    saleSource === "employee_stock"
      ? employeeStock.map((product) => ({
          ...product,
          available_stock: product.quantity,
        }))
      : [];
  const suggestedCombos = comboSuggestion
    ? combos.filter((combo) => combo.items.some((part) =>
        String(part.product_id) === comboSuggestion.productId))
    : [];

  const openPromotionPicker = async () => {
    setPromotionPickerOpen(true);
    try {
      setPromotionsLoading(true);
      const response = await authApis().get(endpoints.promotions, {
        params: { subtotal, total_quantity: totalQuantity },
      });
      setPromotionOptions(response.data?.promotions || []);
    } catch (requestError) {
      setFormError(getApiError(requestError));
    } finally {
      setPromotionsLoading(false);
    }
  };

  const handleProductSearchChange = (index, value) => {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? { ...item, productId: "", productSearch: value, defaultPrice: "", unitPrice: "" }
          : item,
      ),
    );
    setProductSearchLoading((current) => ({ ...current, [index]: true }));
    if (productSearchTimerRefs.current[index]) {
      clearTimeout(productSearchTimerRefs.current[index]);
    }
    const requestId = (productSearchRequestRefs.current[index] || 0) + 1;
    productSearchRequestRefs.current[index] = requestId;
    productSearchTimerRefs.current[index] = setTimeout(async () => {
      try {
        const keyword = value.trim();
        let results;
        if (saleSource === "employee_stock") {
          const normalizedKeyword = keyword.toLowerCase();
          results = normalizedKeyword
            ? saleProducts.filter((product) =>
                `${product.name} ${product.unit}`
                  .toLowerCase()
                  .includes(normalizedKeyword),
              )
            : saleProducts;
        } else {
          const response = await authApis().get(endpoints.productsInventory, {
            params: {
              warehouse_id: warehouseId || undefined,
              page: 1,
              per_page: 100,
              keyword: keyword || undefined,
            },
          });
          results = response.data?.products || [];
        }
        if (productSearchRequestRefs.current[index] !== requestId) return;
        setProductSearchResults((current) => ({
          ...current,
          [index]: results,
        }));
      } catch (requestError) {
        if (productSearchRequestRefs.current[index] === requestId) {
          setFormError(getApiError(requestError));
        }
      } finally {
        if (productSearchRequestRefs.current[index] === requestId) {
          setProductSearchLoading((current) => ({
            ...current,
            [index]: false,
          }));
        }
      }
    }, 750);
  };

  const updateItem = (index, field, value) => {
    setItems((current) =>
      current.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        if (field !== "productId") return { ...item, [field]: value };
        const selectedProduct = [
          ...(productSearchResults[index] || []),
          ...saleProducts,
        ].find((product) => String(product.id) === value);
        return {
          ...item,
          productId: value,
          productSearch: selectedProduct?.name || "",
          unit: selectedProduct?.unit || item.unit,
          defaultPrice: selectedProduct?.default_sale_price != null
            ? String(selectedProduct.default_sale_price)
            : "",
          unitPrice: selectedProduct
            ? String(selectedProduct.default_sale_price ?? "")
            : "",
        };
      }),
    );
  };

  const handleProductSelect = (index, value) => {
    const productId = String(value);
    updateItem(index, "productId", productId);
    setComboNotice("");
    setComboSets("1");
    setComboSuggestion(productId ? { index, productId } : null);
  };

  const applyCombo = async (combo) => {
    if (!comboSuggestion) return;
    const { index, productId } = comboSuggestion;
    if (String(items[index]?.productId) !== productId) {
      setComboSuggestion(null);
      return;
    }
    const numberOfSets = Number(comboSets);
    if (!Number.isInteger(numberOfSets) || numberOfSets < 1 || numberOfSets > 1000) {
      setFormError("Số bộ combo phải là số nguyên từ 1 đến 1.000.");
      return;
    }
    if (items.some((item, itemIndex) => itemIndex !== index && String(item.productId) === productId)) {
      setFormError("Sản phẩm đang chọn đã có ở dòng khác. Hãy gộp về một dòng trước khi dùng combo.");
      return;
    }
    try {
      setApplyingCombo(true);
      setFormError("");
      const productDetails = await Promise.all(combo.items.map(async (part) => {
        if (saleSource === "employee_stock") {
          return saleProducts.find((product) => String(product.id) === String(part.product_id));
        }
        const response = await authApis().get(endpoints.productDetail(part.product_id), {
          params: { warehouse_id: warehouseId },
        });
        return response.data?.product;
      }));
      if (productDetails.some((product) => !product)) {
        setFormError("Một số sản phẩm của combo chưa có trong nguồn hàng đã chọn.");
        return;
      }
      const unpricedProduct = productDetails.find((product) => !getSalePriceBounds(product.default_sale_price));
      if (unpricedProduct) {
        setFormError(`${unpricedProduct.name} cần có giá bán mặc định từ 500 đ trước khi thêm combo.`);
        return;
      }
      const next = [...items];
      for (const [partIndex, part] of combo.items.entries()) {
        const product = productDetails[partIndex];
        const rowIndex = String(part.product_id) === productId
          ? index
          : next.findIndex((row) => String(row.productId) === String(part.product_id));
        const currentQuantity = rowIndex >= 0 && rowIndex !== index
          ? Number(next[rowIndex].quantity || 0) : 0;
        const requestedQuantity = currentQuantity + Number(part.quantity) * numberOfSets;
        if (Number(product.available_stock || 0) < requestedQuantity) {
          setFormError(`${product.name} không đủ tồn kho để thêm combo (${requestedQuantity} cần, ${product.available_stock || 0} còn).`);
          return;
        }
        const row = {
          productId: String(product.id),
          productSearch: product.name,
          unit: product.unit,
          defaultPrice: String(product.default_sale_price ?? ""),
          unitPrice: rowIndex >= 0 && next[rowIndex].unitPrice
            ? next[rowIndex].unitPrice
            : String(product.default_sale_price ?? ""),
          quantity: String(requestedQuantity),
          availableStock: product.available_stock,
        };
        if (rowIndex >= 0) next[rowIndex] = { ...next[rowIndex], ...row };
        else next.push(row);
      }
      setItems(next);
      setComboSuggestion(null);
      setComboNotice(`Đã thêm combo “${combo.name}” (${numberOfSets} bộ). Bạn có thể chỉnh số lượng và giá của từng sản phẩm trước khi lưu đơn.`);
    } catch (requestError) {
      setFormError(getApiError(requestError));
    } finally {
      setApplyingCombo(false);
    }
  };

  const addItem = () => {
    setItems((current) => [
      ...current,
      { productId: "", productSearch: "", quantity: "1", unitPrice: "" },
    ]);
  };

  const handleSaleSourceChange = (value) => {
    setSaleSource(String(value));
    setComboSuggestion(null);
    setComboNotice("");
    setItems([
      { productId: "", productSearch: "", quantity: "1", unitPrice: "" },
    ]);
    setProductSearchResults({});
    setProductSearchLoading({});
  };

  const handleWarehouseChange = (value) => {
    setWarehouseId(String(value));
    setComboSuggestion(null);
    setComboNotice("");
    Object.values(productSearchTimerRefs.current).forEach(clearTimeout);
    Object.keys(productSearchRequestRefs.current).forEach((key) => {
      productSearchRequestRefs.current[key] += 1;
    });
    setItems([{ productId: "", productSearch: "", quantity: "1", unitPrice: "" }]);
    setProductSearchResults({});
    setProductSearchLoading({});
  };

  const removeItem = (index) => {
    setComboSuggestion(null);
    setItems((current) =>
      current.filter((_, itemIndex) => itemIndex !== index),
    );
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError("");
    if (!warehouseId) {
      setFormError("Vui lòng chọn kho xuất hàng.");
      return;
    }
    if (!isEditing && customerMode === "existing" && !customerId) {
      setFormError("Vui lòng chọn khách hàng.");
      return;
    }
    if (
      !isEditing &&
      customerMode === "new" &&
      (!newCustomer.full_name.trim() ||
        !newCustomer.phone.trim() ||
        !newCustomer.address.trim() ||
        !newCustomer.sales_area_id)
    ) {
      setFormError(
        "Vui lòng nhập đầy đủ họ tên, số điện thoại và địa chỉ khách hàng.",
      );
      return;
    }
    if (!items.length) {
      setFormError("Đơn hàng phải có ít nhất một sản phẩm.");
      return;
    }
    const productIds = new Set();
    for (const item of items) {
      if (
        !item.productId ||
        Number(item.quantity) <= 0 ||
        Number(item.unitPrice) <= 0
      ) {
        setFormError("Vui lòng nhập sản phẩm, số lượng và giá bán hợp lệ.");
        return;
      }
      const priceBounds = getSalePriceBounds(item.defaultPrice);
      if (!priceBounds) {
        setFormError("Sản phẩm đã chọn chưa có giá bán mặc định hợp lệ từ 500 đ. Vui lòng cập nhật giá sản phẩm trước khi bán.");
        return;
      }
      if (Number(item.unitPrice) < priceBounds.min || Number(item.unitPrice) > priceBounds.max) {
        setFormError(
          `Giá bán sản phẩm phải từ ${formatCurrency(priceBounds.min)} đến ${formatCurrency(priceBounds.max)} (±10% giá bán mặc định).`,
        );
        return;
      }
      if (productIds.has(item.productId)) {
        setFormError("Mỗi sản phẩm chỉ được xuất hiện một lần trong đơn.");
        return;
      }
      productIds.add(item.productId);
    }
    if (selectedPromotion && !promotionEvaluation.eligible) {
      setFormError(promotionEvaluation.reason);
      return;
    }
    try {
      setSaving(true);
      const payload = {
        warehouse_id: Number(warehouseId),
        customer_id: isEditing
          ? Number(invoice.customer.id)
          : customerMode === "existing"
            ? Number(customerId)
            : null,
        customer:
          !isEditing && customerMode === "new"
            ? {
                full_name: newCustomer.full_name.trim(),
                phone: newCustomer.phone.trim(),
                address: newCustomer.address.trim(),
                sales_area_id: newCustomer.sales_area_id ? Number(newCustomer.sales_area_id) : null,
              }
            : undefined,
        note: note.trim(),
        discount_amount: 0,
        promotion_id: selectedPromotion?.id || null,
        sale_source: saleSource,
        payment_due_date: paymentDueDate || null,
        items: items.map((item) => ({
          product_id: Number(item.productId),
          quantity: Number(item.quantity),
          unit_price: Number(item.unitPrice),
        })),
      };
      const response = isEditing
        ? await authApis().put(
            endpoints.salesInvoiceDetail(invoice.id),
            payload,
          )
        : await authApis().post(endpoints.salesInvoices, payload);
      onSaved(response.data?.invoice);
    } catch (requestError) {
      setFormError(getApiError(requestError));
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="sales-editor-overlay">
      <div
        className="sales-editor-modal"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sales-editor-header">
          <div>
            <p className="sales-detail-eyebrow">
              {isEditing ? "CẬP NHẬT ĐƠN NHÁP" : "TẠO ĐƠN BÁN HÀNG"}
            </p>
            <h2>
              {isEditing ? `Đơn hàng #${invoice.id}` : "Thông tin đơn hàng"}
            </h2>
          </div>
          <button
            type="button"
            className="sales-detail-close"
            onClick={onClose}
            aria-label="Đóng"
          >
            ×
          </button>
        </div>
        <form className="sales-editor-body" onSubmit={handleSubmit}>
          <AutoDismissMessage message={formError} className="sales-alert" />
              {!isEditing && (
                <div className="sales-editor-field">
                  <span>Nguồn hàng</span>
                  <SharedSearchableDropdown
                    value={saleSource}
                    placeholder="Chọn nguồn hàng"
                    ariaLabel="Chọn nguồn hàng"
                    onChange={handleSaleSourceChange}
                    options={[
                      {
                        value: "central_warehouse",
                        label: "Xuất từ kho",
                      },
                      ...(canUseEmployeeStock
                        ? [
                            {
                              value: "employee_stock",
                              label: "Hàng nhân viên mang đi tỉnh",
                            },
                          ]
                        : []),
                    ]}
                  />
                  {saleSource === "employee_stock" && (
                    <small>
                      {employeeStockLoading
                        ? "Đang tải tồn hàng của bạn..."
                        : "Đơn sẽ hoàn thành ngay sau khi lưu và trừ vào tồn kho của bạn."}
                    </small>
                  )}
                </div>
              )}
              {saleSource === "central_warehouse" && (
                <div className="sales-editor-field">
                  <span>Kho xuất hàng</span>
                  <SharedSearchableDropdown
                    value={warehouseId}
                    onChange={handleWarehouseChange}
                    options={warehouses.map((warehouse) => ({ value: warehouse.id, label: warehouse.name }))}
                    placeholder="Chọn kho xuất hàng"
                    ariaLabel="Chọn kho xuất hàng"
                    disabled={isEditing}
                  />
                </div>
              )}
              <div className="sales-editor-field">
                <span>Khách hàng</span>
                {!isEditing && (
                  <div className="sales-customer-mode">
                    <button
                      type="button"
                      className={customerMode === "existing" ? "is-active" : ""}
                      onClick={() => setCustomerMode("existing")}
                    >
                      Khách hàng đã lưu
                    </button>
                    <button
                      type="button"
                      className={customerMode === "new" ? "is-active" : ""}
                      onClick={() => setCustomerMode("new")}
                    >
                      Khách hàng mới
                    </button>
                  </div>
                )}
                {isEditing ? (
                  <div className="sales-customer-contact">
                    <span>
                      <strong>{invoice.customer?.full_name || "—"}</strong>
                    </span>
                    <span>
                      Số điện thoại:{" "}
                      <strong>{invoice.customer?.phone || "—"}</strong>
                    </span>
                    <span>
                      Địa chỉ: <strong>{invoice.customer?.address || "—"}</strong>
                    </span>
                    <small>
                      Khách hàng của đơn không thể thay đổi. Nếu chọn nhầm,
                      hãy hủy đơn này và tạo đơn mới.
                    </small>
                  </div>
                ) : customerMode === "existing" ? (
                  <>
                    <SharedSearchableDropdown
                      value={customerId}
                      placeholder="Chọn khách hàng"
                      ariaLabel="Chọn khách hàng"
                      searchValue={customerSearchInput}
                      onSearchChange={handleCustomerSearchChange}
                      searching={customerSearchLoading}
                      onChange={handleCustomerSelect}
                      emptyLabel="Không tìm thấy khách hàng."
                      options={[
                        ...customers.map((customer) => ({
                          value: customer.id,
                          label: customer.full_name,
                        })),
                        ...(invoice?.customer &&
                        !customers.some(
                          (customer) => customer.id === invoice.customer.id,
                        )
                          ? [
                              {
                                value: invoice.customer.id,
                                label: invoice.customer.full_name,
                              },
                            ]
                          : []),
                      ]}
                    />
                    {selectedCustomer && (
                      <div className="sales-customer-contact">
                        <span>
                          Số điện thoại:{" "}
                          <strong>{selectedCustomer.phone || "—"}</strong>
                        </span>
                        <span>
                          Địa chỉ:{" "}
                          <strong>{selectedCustomer.address || "—"}</strong>
                        </span>
                        <span>
                          Công nợ hiện tại:{" "}
                          <strong>
                            {formatCurrency(selectedCustomer.debt_amount)}
                          </strong>
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  <CustomerFields
                    value={newCustomer}
                    onChange={(field, value) =>
                      setNewCustomer((current) => ({ ...current, [field]: value }))
                    }
                    salesAreas={salesAreas}
                    salesAreasLoading={salesAreasLoading}
                    requireSalesArea
                  />
                )}
              </div>

              <div className="sales-editor-section-heading">
                <h3>Sản phẩm</h3>
                <button
                  type="button"
                  className="sales-editor-add"
                  onClick={addItem}
                >
                  + Thêm sản phẩm
                </button>
              </div>
              <div className="sales-editor-items">
                {items.map((item, index) => {
                  const searchedProducts =
                    productSearchResults[index] || saleProducts;
                  const selectedProduct =
                    searchedProducts.find(
                      (product) =>
                        String(product.id) === String(item.productId),
                    ) ||
                    (item.productId
                      ? {
                          id: item.productId,
                          name: item.productSearch,
                          unit: item.unit,
                          default_sale_price: item.defaultPrice || undefined,
                          available_stock: item.availableStock,
                        }
                      : null);
                  const productOptions =
                    selectedProduct &&
                    !searchedProducts.some(
                      (product) =>
                        String(product.id) === String(selectedProduct.id),
                    )
                      ? [selectedProduct, ...searchedProducts]
                      : searchedProducts;
                  const priceBounds = getSalePriceBounds(
                    selectedProduct?.default_sale_price ?? item.defaultPrice,
                  );
                  const warehouseName = warehouses.find(
                    (warehouse) => String(warehouse.id) === warehouseId,
                  )?.name;
                  return (
                    <div
                      className="sales-editor-item"
                      key={`${item.productId || "new"}-${index}`}
                    >
                      <div className="sales-editor-product-field">
                        <ProductEntryField label="Sản phẩm">
                          <SharedSearchableDropdown
                        value={item.productId}
                        placeholder="Chọn sản phẩm"
                        ariaLabel="Chọn sản phẩm"
                        searchValue={
                          item.productSearch || selectedProduct?.name || ""
                        }
                        onSearchChange={(value) =>
                          handleProductSearchChange(index, value)
                        }
                        searching={Boolean(productSearchLoading[index])}
                        searchingLabel="Đang tìm sản phẩm..."
                        emptyLabel="Không tìm thấy sản phẩm."
                        emptyAction={
                          activeUser.role === "nhân viên bán hàng" &&
                          item.productSearch.trim() ? (
                            <button
                              type="button"
                              className="searchable-dropdown-action"
                              onClick={() => {
                                setProductRequestName(item.productSearch.trim());
                                setProductRequestOpen(true);
                              }}
                            >
                              + Gửi yêu cầu thêm sản phẩm
                            </button>
                          ) : null
                        }
                        onChange={(value) => handleProductSelect(index, value)}
                        options={[
                          { value: "", label: "Chọn sản phẩm" },
                          ...productOptions.map((product) => ({
                            value: product.id,
                            label: product.name,
                          })),
                        ]}
                          />
                        </ProductEntryField>
                        <ProductEntryInfo
                          product={selectedProduct}
                          stockLabel={saleSource === "employee_stock"
                            ? "Tồn kho của bạn"
                            : `Số lượng còn lại ở ${warehouseName === "Kho trung tâm"
                              ? "kho trung tâm"
                              : warehouseName || "kho đã chọn"}`}
                          stockQuantity={selectedProduct?.available_stock}
                        />
                      </div>
                      <ProductEntryField label="Số lượng">
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={item.quantity}
                          onChange={(event) =>
                            updateItem(index, "quantity", event.target.value)
                          }
                          placeholder="Nhập số lượng"
                          aria-label="Số lượng"
                          required
                        />
                      </ProductEntryField>
                      <ProductEntryField label="Giá bán">
                        <MoneyInput
                          value={item.unitPrice}
                          onChange={(value) => updateItem(index, "unitPrice", value)}
                          label="Giá bán"
                          minAmount={priceBounds?.min || 500}
                          maxAmount={priceBounds?.max || null}
                          placeholder="Nhập giá bán"
                          aria-label="Giá bán"
                          required
                        />
                        {selectedProduct && (
                          <small className={priceBounds ? "product-entry-range" : "product-entry-range is-invalid"}>
                            {priceBounds
                              ? `Cho phép: ${formatCurrency(priceBounds.min)} – ${formatCurrency(priceBounds.max)} (±10%)`
                              : "Cần đặt giá bán mặc định từ 500 đ trước khi bán."}
                          </small>
                        )}
                      </ProductEntryField>
                      <button
                        type="button"
                        className="sales-editor-remove"
                        onClick={() => removeItem(index)}
                        aria-label="Xóa sản phẩm"
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>

              {suggestedCombos.length > 0 && (
                <section className="sales-combo-suggestion" aria-label="Gợi ý combo">
                  <div className="sales-combo-suggestion-heading">
                    <div>
                      <span>GỢI Ý BÁN THEO BỘ</span>
                      <h4>Sản phẩm này có trong combo</h4>
                      <p>Chọn một bộ để tự thêm sản phẩm đi kèm, hoặc giữ sản phẩm đang chọn để bán lẻ.</p>
                    </div>
                    <button type="button" onClick={() => setComboSuggestion(null)} disabled={applyingCombo}>Chỉ bán lẻ</button>
                  </div>
                  <label className="sales-combo-set-count">
                    <span>Số bộ cần thêm</span>
                    <input type="number" min="1" max="1000" step="1" value={comboSets}
                      onChange={(event) => setComboSets(event.target.value)} aria-label="Số bộ combo" />
                  </label>
                  <div className="sales-combo-options">
                    {suggestedCombos.map((combo) => (
                      <article className="sales-combo-option" key={combo.id}>
                        <div>
                          <strong>{combo.name}</strong>
                          <p>{combo.items.map((part) => `${part.quantity} ${part.unit} ${part.product_name}`).join(" + ")}</p>
                          <small>Số lượng sản phẩm tự nhân theo số bộ; có thể chỉnh từng dòng sau khi thêm.</small>
                        </div>
                        <button type="button" onClick={() => applyCombo(combo)} disabled={applyingCombo}>
                          {applyingCombo ? "Đang kiểm tra..." : "Dùng combo"}
                        </button>
                      </article>
                    ))}
                  </div>
                </section>
              )}
              {comboNotice && <div className="sales-combo-notice" role="status">{comboNotice}</div>}

              <section className="sales-promotion-selector">
                <div className="sales-promotion-selector-heading">
                  <div>
                    <h3>Khuyến mãi</h3>
                    <p>Chỉ áp dụng chương trình đáp ứng điều kiện của đơn.</p>
                  </div>
                  <button type="button" onClick={openPromotionPicker}>
                    {selectedPromotion ? "Đổi khuyến mãi" : "Chọn khuyến mãi"}
                  </button>
                </div>
                {selectedPromotion ? (
                  <div className={`sales-selected-promotion${promotionEvaluation.eligible ? "" : " is-invalid"}`}>
                    <div>
                      <strong>{selectedPromotion.name}</strong>
                      <span>{selectedPromotion.condition_summary}</span>
                      <small>{selectedPromotion.benefit_summary}</small>
                    </div>
                    <div className="sales-selected-promotion-value">
                      <span>Mức giảm của đơn</span>
                      <strong>-{formatCurrency(discount)}</strong>
                    </div>
                    <button
                      type="button"
                      className="sales-promotion-remove"
                      onClick={() => {
                        setSelectedPromotion(null);
                        setPromotionPickerOpen(false);
                      }}
                    >
                      Xóa khỏi đơn
                    </button>
                    {!promotionEvaluation.eligible && (
                      <p>{promotionEvaluation.reason}</p>
                    )}
                  </div>
                ) : (
                  <div className="sales-promotion-empty">
                    Đơn này không áp dụng khuyến mãi.
                  </div>
                )}

                {promotionPickerOpen && (
                  <div className="sales-promotion-picker">
                    <div className="sales-promotion-picker-header">
                      <strong>Chương trình hiện có</strong>
                      <button type="button" onClick={() => setPromotionPickerOpen(false)}>
                        Đóng
                      </button>
                    </div>
                    {promotionsLoading ? (
                      <div className="sales-promotion-picker-state">Đang kiểm tra điều kiện...</div>
                    ) : promotionOptions.length ? (
                      <div className="sales-promotion-options">
                        {promotionOptions.map((promotion) => (
                          <button
                            type="button"
                            key={promotion.id}
                            className={promotion.eligible ? "is-eligible" : "is-ineligible"}
                            disabled={!promotion.eligible}
                            onClick={() => {
                              setSelectedPromotion(promotion);
                              setPromotionPickerOpen(false);
                            }}
                          >
                            <strong>{promotion.name}</strong>
                            <span>{promotion.condition_summary}</span>
                            <small>
                              {promotion.eligible
                                ? `${promotion.benefit_summary} · Giảm ${formatCurrency(promotion.calculated_discount)}`
                                : promotion.eligibility_reason}
                            </small>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="sales-promotion-picker-state">
                        Chưa có chương trình khuyến mãi đang hoạt động.
                      </div>
                    )}
                  </div>
                )}
              </section>

              <div className="sales-editor-financials">
                {saleSource === "employee_stock" && (
                  <label className="sales-editor-field sales-editor-debt-date">
                    <span>Hạn thanh toán (nếu cho nợ)</span>
                    <input
                      type="date"
                      aria-label="Hạn thanh toán (nếu cho nợ)"
                      value={paymentDueDate}
                      onChange={(event) => setPaymentDueDate(event.target.value)}
                    />
                    <small>Kế toán sẽ ghi nhận tiền sau khi đơn được lập.</small>
                  </label>
                )}
                <div className="sales-editor-totals">
                  <div className="sales-editor-total">
                    <span>Tiền hàng</span>
                    <strong>{formatCurrency(subtotal)}</strong>
                  </div>
                  {discount > 0 && (
                    <div className="sales-editor-total sales-editor-discount">
                      <span>Khuyến mãi</span>
                      <strong>-{formatCurrency(discount)}</strong>
                    </div>
                  )}
                  <div className="sales-editor-total sales-editor-final-total">
                    <span>Tổng tiền đơn</span>
                    <strong>
                      {formatCurrency(Math.max(0, subtotal - discount))}
                    </strong>
                  </div>
                </div>
              </div>
              <label className="sales-editor-field">
                <span>Ghi chú</span>
                <textarea
                  rows="3"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Nhập ghi chú cho đơn hàng"
                />
              </label>
              <div className="sales-editor-actions">
                <button type="button" onClick={onClose} disabled={saving}>
                  Hủy
                </button>
                <button
                  type="submit"
                  className="sales-editor-submit"
                  disabled={saving}
                >
                  {saving
                    ? "Đang lưu..."
                    : isEditing
                      ? "Lưu thay đổi"
                      : saleSource === "employee_stock"
                        ? "Tạo và hoàn thành"
                        : "Tạo đơn nháp"}
                </button>
              </div>
        </form>
      </div>
        {productRequestOpen && (
          <ProductRequestModal
            initialName={productRequestName}
            onClose={() => setProductRequestOpen(false)}
            onSaved={() => {
              setProductRequestOpen(false);
              setFormError("Đã gửi yêu cầu thêm sản phẩm đến quản lý.");
            }}
          />
        )}
      </div>,
    document.body,
  );
}

function SalesInvoices() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialCancelRequestFilter =
    searchParams.get("cancel_requested") === "pending" ? "pending" : "";
  const initialDebtStatus = !initialCancelRequestFilter && ["overdue", "due_today", "due_soon"].includes(
    searchParams.get("debt_status"),
  ) ? searchParams.get("debt_status") : "";
  const [invoices, setInvoices] = useState([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState("");
  const [cancelRequestFilter, setCancelRequestFilter] = useState(
    initialCancelRequestFilter,
  );
  const [debtStatus, setDebtStatus] = useState(initialDebtStatus);
  const [fromDateInput, setFromDateInput] = useState("");
  const [toDateInput, setToDateInput] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useNotificationState();
  const [dateWarning, setDateWarning] = useNotificationState();
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useNotificationState();
  const [actionLoading, setActionLoading] = useState(false);
  const [paymentHistoryLoading, setPaymentHistoryLoading] = useState(false);
  const [actionError, setActionError] = useNotificationState();
  const [confirmAction, setConfirmAction] = useState(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [statusBoard, setStatusBoard] = useState([]);
  const [statusBoardTotal, setStatusBoardTotal] = useState(0);
  const [statusBoardLoading, setStatusBoardLoading] = useState(false);
  const [statusBoardError, setStatusBoardError] = useNotificationState();
  const [pendingDiscounts, setPendingDiscounts] = useState([]);
  const [pendingDiscountPage, setPendingDiscountPage] = useState(1);
  const [pendingDiscountPagination, setPendingDiscountPagination] = useState({
    total: 0,
    totalPages: 1,
  });
  const [pendingDiscountLoading, setPendingDiscountLoading] = useState(false);
  const [pendingDiscountError, setPendingDiscountError] =
    useNotificationState();
  const [discountConfirm, setDiscountConfirm] = useState(null);
  const [discountActionLoading, setDiscountActionLoading] = useState(false);
  const [discountActionError, setDiscountActionError] = useNotificationState();
  const debounceTimerRef = useRef(null);
  const invoiceRequestIdRef = useRef(0);
  const currentUser = (() => {
    try {
      return JSON.parse(localStorage.getItem("user")) || {};
    } catch {
      return {};
    }
  })();
  const canCreateSales = ["nhân viên bán hàng", "quản lý"].includes(
    currentUser.role,
  );
  const canEditSales = ["nhân viên bán hàng", "kế toán", "quản lý"].includes(
    currentUser.role,
  );
  const canCancelDraft = ["nhân viên bán hàng", "quản lý"].includes(
    currentUser.role,
  );
  const canRequestCancel = currentUser.role === "nhân viên bán hàng";
  const canCancelDirect = currentUser.role === "quản lý";
  const canManageStatus = ["thủ kho", "quản lý"].includes(currentUser.role);
  const canSubmitWarehouse = ["nhân viên bán hàng", "quản lý"].includes(currentUser.role);
  const canConfirmDelivery = canSubmitWarehouse;
  const canRecordPayment = currentUser.role === "kế toán";
  const canCompleteSales = currentUser.role === "kế toán";

  const canApproveCancel = ["kế toán", "quản lý"].includes(currentUser.role);
  const canViewStatusBoard = currentUser.role === "quản lý";

  const canManageDueDate = canApproveCancel;

  const fetchStatusBoard = useCallback(async () => {
    if (!canViewStatusBoard) return;
    try {
      setStatusBoardLoading(true);
      setStatusBoardError("");
      const response = await authApis().get(endpoints.salesInvoiceStatusBoard);
      const groups = response.data?.statuses || [];
      setStatusBoard(groups);
      setStatusBoardTotal(
        Number(
          response.data?.total ??
            groups.reduce(
              (total, group) => total + Number(group.total || 0),
              0,
            ),
        ),
      );
    } catch (requestError) {
      setStatusBoardError(getApiError(requestError));
    } finally {
      setStatusBoardLoading(false);
    }
  }, [canViewStatusBoard, setStatusBoardError]);

  const fetchPendingDiscounts = useCallback(async () => {
    if (!canViewStatusBoard) return;
    try {
      setPendingDiscountLoading(true);
      setPendingDiscountError("");
      const response = await authApis().get(endpoints.pendingDiscountInvoices, {
        params: { page: pendingDiscountPage, per_page: DISCOUNT_PER_PAGE },
      });
      const data = response.data || {};
      setPendingDiscounts(data.invoices || []);
      setPendingDiscountPagination({
        total: Number(data.total || 0),
        totalPages: Number(data.pages || 1),
      });
    } catch (requestError) {
      setPendingDiscountError(getApiError(requestError));
    } finally {
      setPendingDiscountLoading(false);
    }
  }, [canViewStatusBoard, pendingDiscountPage, setPendingDiscountError]);

  const fetchInvoices = useCallback(async (silent = false) => {
    if (!localStorage.getItem("token")) {
      navigate("/login", {
        replace: true,
        state: { message: "Vui lòng đăng nhập để xem đơn bán hàng." },
      });
      return;
    }

    const requestId = ++invoiceRequestIdRef.current;

    try {
      if (!silent) setLoading(true);
      setError("");
      const response = await authApis().get(endpoints.salesInvoices, {
        params: {
          page,
          per_page: PER_PAGE,
          keyword: keyword || undefined,
          status: status || undefined,
          from_date: fromDate || undefined,
          to_date: toDate || undefined,
          cancel_requested:
            cancelRequestFilter === "pending" ? "true" : undefined,
          debt_status: debtStatus || undefined,
        },
      });
      if (requestId !== invoiceRequestIdRef.current) return;
      const data = response.data || {};
      setInvoices(data.invoices || []);
      setPagination({
        total: Number(data.total || 0),
        totalPages: Number(data.pages || 1),
      });
    } catch (requestError) {
      if (requestId === invoiceRequestIdRef.current) setError(getApiError(requestError));
    } finally {
      if (requestId === invoiceRequestIdRef.current) setLoading(false);
    }
  }, [cancelRequestFilter, debtStatus, fromDate, keyword, navigate, page, status, toDate]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") fetchInvoices(true);
    };
    const timer = window.setInterval(refresh, 60000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [fetchInvoices]);

  useEffect(() => {
    fetchStatusBoard();
  }, [fetchStatusBoard]);

  useEffect(() => {
    fetchPendingDiscounts();
  }, [fetchPendingDiscounts]);

  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      const value = keywordInput.trim();
      const nextFromDate = fromDateInput.trim();
      const nextToDate = toDateInput.trim();
      const warning = validateSaleDateRange(nextFromDate, nextToDate);
      if (warning) {
        setDateWarning(warning);
        return;
      }
      if (
        value === keyword &&
        nextFromDate === fromDate &&
        nextToDate === toDate
      ) return;
      setDateWarning("");
      setPage(1);
      setKeyword(value);
      setFromDate(nextFromDate);
      setToDate(nextToDate);
    }, 500);
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [fromDate, fromDateInput, keyword, keywordInput, toDate, toDateInput]);

  const openDetail = async (invoiceId) => {
    try {
      setDetailLoading(true);
      setDetailError("");
      setActionError("");
      setSelectedInvoice({ id: invoiceId });
      const response = await authApis().get(
        endpoints.salesInvoiceDetail(invoiceId),
      );
      setSelectedInvoice(response.data || null);
    } catch (requestError) {
      setDetailError(getApiError(requestError));
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    if (!detailLoading) {
      setSelectedInvoice(null);
      setDetailError("");
    }
  };

  const openCreateEditor = () => {
    setSelectedInvoice(null);
    setEditingInvoice(null);
    setShowEditor(true);
  };

  const openEditEditor = () => {
    setEditingInvoice(selectedInvoice);
    setSelectedInvoice(null);
    setShowEditor(true);
  };

  const handleEditorSaved = (invoice) => {
    if (!editingInvoice) {
      setPage(1);
      setKeywordInput("");
      setKeyword("");
      setStatus("");
      setDebtStatus("");
      setCancelRequestFilter("");
      setFromDateInput("");
      setToDateInput("");
      setFromDate("");
      setToDate("");
    }
    setShowEditor(false);
    setEditingInvoice(null);
    setSelectedInvoice(invoice || null);
    fetchInvoices();
    fetchStatusBoard();
    notifySalesActionCountChanged();
  };

  const handleCancelDraft = async () => {
    if (!selectedInvoice) return;
    setConfirmAction("cancel-draft");
  };

  const handleCancelRequest = async () => {
    if (!selectedInvoice) return;
    setConfirmAction("cancel-request");
  };

  const handleCancelDirect = async () => {
    if (!selectedInvoice) return;
    setConfirmAction("cancel-manager");
  };

  const advanceInvoiceStatus = async (nextStatus) => {
    if (!selectedInvoice) return;
    try {
      setActionLoading(true);
      setActionError("");
      const response = await authApis().put(
        endpoints.salesInvoiceStatus(selectedInvoice.id),
        { status: nextStatus },
      );
      setSelectedInvoice((current) => ({
        ...current,
        ...(response.data?.invoice || {}),
      }));
      await fetchInvoices();
      await fetchStatusBoard();
      notifySalesActionCountChanged();
    } catch (requestError) {
      setActionError(getApiError(requestError));
    } finally {
      setActionLoading(false);
    }
  };

  const submitInvoiceToWarehouse = async () => {
    if (!selectedInvoice) return;
    try {
      setActionLoading(true);
      setActionError("");
      const response = await authApis().post(endpoints.submitSalesInvoiceToWarehouse(selectedInvoice.id));
      setSelectedInvoice(response.data?.invoice || selectedInvoice);
      await Promise.all([fetchInvoices(), fetchStatusBoard()]);
      notifySalesActionCountChanged();
    } catch (requestError) {
      setActionError(getApiError(requestError));
    } finally {
      setActionLoading(false);
    }
  };

  const confirmInvoiceDelivery = async (recipient, note) => {
    if (!selectedInvoice) return;
    try {
      setActionLoading(true);
      setActionError("");
      const response = await authApis().post(endpoints.confirmSalesInvoiceDelivery(selectedInvoice.id), { recipient, note });
      setSelectedInvoice(response.data?.invoice || selectedInvoice);
      await Promise.all([fetchInvoices(), fetchStatusBoard()]);
      notifySalesActionCountChanged();
    } catch (requestError) {
      setActionError(getApiError(requestError));
    } finally {
      setActionLoading(false);
    }
  };

  const completeInvoice = async (amount, method, paymentDueDate) => {
    if (!selectedInvoice) return;
    try {
      setActionLoading(true);
      setActionError("");
      const response = await authApis().put(
        endpoints.completeSalesInvoice(selectedInvoice.id),
        { payment_amount: amount, payment_method: method, payment_due_date: paymentDueDate || null },
      );
      notifyInventoryChanged();
      setSelectedInvoice(response.data?.invoice || selectedInvoice);
      await fetchInvoices();
      await fetchStatusBoard();
      notifySalesActionCountChanged();
      window.dispatchEvent(new Event("pending-requests:refresh"));
    } catch (requestError) {
      setActionError(getApiError(requestError));
    } finally {
      setActionLoading(false);
    }
  };

  const recordInvoicePayment = async (amount, paymentMethod, paymentDueDate) => {
    if (!selectedInvoice) return;
    try {
      setActionLoading(true);
      setActionError("");
      const response = await authApis().post(endpoints.salesInvoicePayments(selectedInvoice.id), {
        amount,
        payment_method: paymentMethod,
        payment_due_date: paymentDueDate || null,
      });
      setSelectedInvoice(response.data?.invoice || selectedInvoice);
      await fetchInvoices();
      window.dispatchEvent(new Event("pending-requests:refresh"));
    } catch (requestError) {
      setActionError(getApiError(requestError));
    } finally {
      setActionLoading(false);
    }
  };

  const loadMoreInvoicePayments = async () => {
    if (!selectedInvoice || paymentHistoryLoading) return;
    const invoiceId = selectedInvoice.id;
    try {
      setPaymentHistoryLoading(true);
      setActionError("");
      const response = await authApis().get(endpoints.salesInvoicePayments(invoiceId), {
        params: { page: Number(selectedInvoice.payments_page || 1) + 1, per_page: 20 },
      });
      setSelectedInvoice((current) => {
        if (current?.id !== invoiceId) return current;
        const existingIds = new Set((current.payments || []).map((payment) => payment.id));
        return {
          ...current,
          payments: [...(current.payments || []), ...(response.data?.payments || []).filter((payment) => !existingIds.has(payment.id))],
          payments_total: Number(response.data?.total || 0),
          payments_page: Number(response.data?.page || 1),
        };
      });
    } catch (requestError) {
      setActionError(getApiError(requestError));
    } finally {
      setPaymentHistoryLoading(false);
    }
  };

  const updatePaymentDueDate = async (paymentDueDate) => {
    if (!selectedInvoice || !paymentDueDate) return;
    try {
      setActionLoading(true);
      setActionError("");
      const response = await authApis().put(
        endpoints.salesInvoicePaymentDueDate(selectedInvoice.id),
        { payment_due_date: paymentDueDate },
      );
      setSelectedInvoice(response.data?.invoice || selectedInvoice);
      await fetchInvoices();
      window.dispatchEvent(new Event("pending-requests:refresh"));
    } catch (requestError) {
      setActionError(getApiError(requestError));
    } finally {
      setActionLoading(false);
    }
  };

  const executeConfirmedAction = async () => {
    if (!selectedInvoice || !confirmAction) return;
    try {
      setActionLoading(true);
      setActionError("");
      if (
        confirmAction === "cancel-draft" ||
        confirmAction === "cancel-manager"
      ) {
        await authApis().delete(
          endpoints.salesInvoiceDetail(selectedInvoice.id),
        );
        setSelectedInvoice(null);
      } else if (confirmAction === "cancel-request") {
        const response = await authApis().post(
          endpoints.salesInvoiceCancelRequest(selectedInvoice.id),
          { cancel_note: "" },
        );
        setSelectedInvoice((current) => ({
          ...current,
          ...(response.data?.invoice || {}),
        }));
      } else {
        const response = await authApis().put(
          endpoints.salesInvoiceApproveCancel(selectedInvoice.id),
          { approved: confirmAction === "approve-cancel", note: "" },
        );
        setSelectedInvoice((current) => ({
          ...current,
          ...(response.data?.invoice || {}),
        }));
      }
      setConfirmAction(null);
      await fetchInvoices();
      await fetchStatusBoard();
      notifySalesActionCountChanged();
    } catch (requestError) {
      setActionError(getApiError(requestError));
    } finally {
      setActionLoading(false);
    }
  };

  const executeDiscountAction = async () => {
    if (!discountConfirm) return;
    try {
      setDiscountActionLoading(true);
      setDiscountActionError("");
      await authApis().put(
        endpoints.approveSalesInvoiceDiscount(discountConfirm.invoice.id),
        { approved: discountConfirm.approved, note: "" },
      );
      setDiscountConfirm(null);
      const shouldMoveToPreviousDiscountPage =
        pendingDiscounts.length === 1 && pendingDiscountPage > 1;
      if (shouldMoveToPreviousDiscountPage) {
        setPendingDiscountPage((current) => current - 1);
      }
      await Promise.all([
        shouldMoveToPreviousDiscountPage
          ? Promise.resolve()
          : fetchPendingDiscounts(),
        fetchInvoices(),
        fetchStatusBoard(),
      ]);
      notifySalesActionCountChanged();
    } catch (requestError) {
      setDiscountActionError(getApiError(requestError));
    } finally {
      setDiscountActionLoading(false);
    }
  };

  const isCancelApproval = confirmAction === "approve-cancel";
  const isCancelRejection = confirmAction === "reject-cancel";
  const isManagerCancel = confirmAction === "cancel-manager";

  return (
    <div className="sales-page">
      <div className="sales-header">
        <div>
          <h1>Đơn bán hàng</h1>
        </div>
        {canCreateSales && (
          <button
            type="button"
            className="sales-create-button"
            onClick={openCreateEditor}
          >
            + Tạo đơn bán hàng
          </button>
        )}
      </div>

      {canViewStatusBoard && (
        <section
          className="sales-status-board"
          aria-label="Tổng hợp trạng thái đơn hàng"
        >
          <div className="sales-status-board-header">
            <div>
              <h2>Tổng hợp đơn hàng</h2>
              <p>Số lượng đơn theo từng trạng thái.</p>
            </div>
            <span className="sales-status-board-total">
              {statusBoardTotal} đơn hàng
            </span>
          </div>
          <AutoDismissMessage
            message={statusBoardError}
            className="sales-alert"
          />
          {statusBoardLoading && !statusBoard.length ? (
            <Skeleton variant="cards" columns={3} />
          ) : (
            <div className="sales-status-board-grid">
              {statusBoard.map((group) => (
                <div
                  className={`sales-status-board-card ${getStatusClass(group.status)}`}
                  key={group.status}
                >
                  <span>{getStatusLabel(group.status)}</span>
                  <strong>{Number(group.total || 0)}</strong>
                  <small>đơn hàng</small>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {canViewStatusBoard && (
        <section
          className="sales-pending-discount"
          aria-label="Đơn hàng chờ duyệt khuyến mãi"
        >
          <div className="sales-pending-discount-header">
            <div>
              <h2>Đơn hàng chờ duyệt khuyến mãi</h2>
              <p></p>
            </div>
            <span>{pendingDiscountPagination.total} đơn chờ duyệt</span>
          </div>
          <AutoDismissMessage
            message={pendingDiscountError}
            className="sales-alert"
          />
          {pendingDiscountLoading ? (
            <Skeleton rows={4} columns={5} />
          ) : pendingDiscounts.length === 0 ? (
            <div className="sales-state">
              Không có đơn hàng nào đang chờ duyệt khuyến mãi.
            </div>
          ) : (
            <div className="sales-table-wrap">
              <table className="sales-table sales-pending-discount-table">
                <thead>
                  <tr>
                    <th>Mã đơn</th>
                    <th>Khách hàng</th>
                    <th>Nhân viên lập đơn</th>
                    <th className="sales-money">Tiền hàng</th>
                    <th className="sales-money">Khuyến mãi</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingDiscounts.map((invoice) => (
                    <tr
                      key={invoice.id}
                      onClick={() => openDetail(invoice.id)}
                      tabIndex="0"
                    >
                      <td>#{invoice.id}</td>
                      <td>
                        <strong>{invoice.customer?.full_name || "—"}</strong>
                        <small>{invoice.customer?.phone || ""}</small>
                      </td>
                      <td>{invoice.employee?.full_name || "—"}</td>
                      <td className="sales-money">
                        {formatCurrency(invoice.total_amount)}
                      </td>
                      <td className="sales-money sales-discount-pending-amount">
                        <strong>{formatCurrency(invoice.discount?.amount)}</strong>
                        <small>{invoice.discount?.promotion?.name || "Điều chỉnh giá cũ"}</small>
                      </td>
                      <td>
                        <div
                          className="sales-discount-actions"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setDiscountActionError("");
                              setDiscountConfirm({ invoice, approved: true });
                            }}
                          >
                            Duyệt
                          </button>
                          <button
                            type="button"
                            className="sales-action-danger"
                            onClick={() => {
                              setDiscountActionError("");
                              setDiscountConfirm({ invoice, approved: false });
                            }}
                          >
                            Từ chối
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pagination
            page={pendingDiscountPage}
            totalPages={pendingDiscountPagination.totalPages}
            onPageChange={setPendingDiscountPage}
            disabled={pendingDiscountLoading}
          />
        </section>
      )}

      <form
        className="sales-toolbar"
        onSubmit={(event) => event.preventDefault()}
      >
        <div className="sales-toolbar-primary">
        <input
          type="search"
          value={keywordInput}
          onChange={(event) => setKeywordInput(event.target.value)}
          placeholder="Tìm theo mã đơn, tên hoặc số điện thoại khách hàng"
          aria-label="Tìm kiếm đơn bán hàng"
        />
        <div className="sales-status-dropdown">
          <SharedSearchableDropdown
            value={status}
            options={STATUS_OPTIONS}
            placeholder="Tất cả trạng thái"
            onChange={(value) => {
              setPage(1);
              setStatus(String(value));
              if (value && value !== "hoàn thành") setDebtStatus("");
              if (value && !["đang xử lý", "đang giao"].includes(value)) {
                setCancelRequestFilter("");
              }
            }}
            ariaLabel="Lọc theo trạng thái đơn hàng"
          />
        </div>
        <div className="sales-debt-dropdown">
          <SharedSearchableDropdown
            value={debtStatus}
            options={DEBT_STATUS_OPTIONS}
            placeholder="Không lọc hạn thanh toán"
            onChange={(value) => {
              setPage(1);
              setDebtStatus(String(value));
              if (value) {
                setCancelRequestFilter("");
                setStatus("");
              }
            }}
            ariaLabel="Lọc theo hạn thanh toán"
          />
        </div>
        </div>
        <div className="sales-toolbar-secondary">
        <div className="sales-date-range" role="group" aria-label="Lọc theo ngày bán">
          <label className="sales-date-field">
            <span>Từ ngày</span>
            <input
              type="date"
              value={fromDateInput}
              onChange={(event) => setFromDateInput(event.target.value)}
              aria-label="Ngày bán từ"
            />
          </label>
          <span className="sales-date-separator" aria-hidden="true">–</span>
          <label className="sales-date-field">
            <span>Đến ngày</span>
            <input
              type="date"
              value={toDateInput}
              onChange={(event) => setToDateInput(event.target.value)}
              aria-label="Ngày bán đến"
            />
          </label>
        </div>
        <label className="sales-cancel-filter">
          <input
            type="checkbox"
            checked={cancelRequestFilter === "pending"}
            onChange={(event) => {
              setPage(1);
              const pendingOnly = event.target.checked;
              setCancelRequestFilter(pendingOnly ? "pending" : "");
              if (pendingOnly) {
                setDebtStatus("");
                setStatus("");
              }
            }}
          />
          <span>Chỉ xem đơn chờ duyệt hủy</span>
        </label>
        </div>
      </form>

      {cancelRequestFilter === "pending" && (
        <p className="sales-filter-context">Chỉ hiển thị đơn đang xử lý hoặc đang giao có yêu cầu hủy chờ duyệt.</p>
      )}
      {debtStatus && (
        <p className="sales-filter-context">Chỉ hiển thị đơn hoàn thành còn nợ có hạn thanh toán phù hợp.</p>
      )}

      <AutoDismissMessage message={dateWarning} type="warning" className="sales-date-warning" />
      <AutoDismissMessage message={error} className="sales-alert" />
      <div className="sales-card">
        {loading ? (
          <Skeleton rows={7} columns={5} />
        ) : invoices.length === 0 ? (
          <div className="sales-state">
            {cancelRequestFilter === "pending"
              ? "Không có đơn nào đang chờ duyệt hủy."
              : debtStatus
                ? "Không có đơn còn nợ phù hợp với hạn thanh toán đã chọn."
                : "Không có đơn hàng phù hợp."}
          </div>
        ) : (
          <div className="sales-table-wrap">
            <table className="sales-table">
              <thead>
                <tr>
                  <th>Ngày bán</th>
                  <th>Kho xuất</th>
                  <th>Khách hàng</th>
                  <th>Trạng thái</th>
                  <th>Hạn thanh toán</th>
                  <th>Số sản phẩm</th>
                  <th className="sales-money">Tổng tiền</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr
                    key={invoice.id}
                    tabIndex="0"
                    onClick={() => openDetail(invoice.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ")
                        openDetail(invoice.id);
                    }}
                  >
                    <td className="sales-order-start-cell">
                      {formatDateTime(invoice.sold_at)}
                      {requiresSalesInvoiceAction(invoice, currentUser) && (
                        <span className="sales-action-dot" aria-label={`Đơn hàng #${invoice.id} cần xử lý`} title="Đơn hàng cần xử lý" />
                      )}
                    </td>
                    <td>{invoice.sale_source === "hàng nhân viên" ? "Hàng nhân viên" : invoice.warehouse?.name || "—"}</td>
                    <td>
                      <strong>{invoice.customer?.full_name || "—"}</strong>
                      <small>{invoice.customer?.phone || ""}</small>
                    </td>
                    <td>
                      <div className="sales-status-cell">
                        <span
                          className={`sales-status-badge ${getStatusClass(invoice.workflow_stage || invoice.status)}`}
                        >
                          {getStatusLabel(invoice.workflow_stage || invoice.status)}
                        </span>
                        {hasActiveCancelRequest(invoice) && (
                          <span
                            className="sales-cancel-request-badge"
                            aria-label="Đơn hàng đang chờ duyệt hủy"
                          >
                            Chờ duyệt hủy
                          </span>
                        )}
                      </div>
                    </td>
                    <td><SalesInvoiceDueCell invoice={invoice} /></td>
                    <td>{invoice.items_count || 0}</td>
                    <td className="sales-money">
                      {formatCurrency(invoice.final_amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Pagination
        page={page}
        totalPages={pagination.totalPages}
        onPageChange={setPage}
        disabled={loading}
      />

      {selectedInvoice &&
        (detailLoading ? (
          createPortal(
            <div className="sales-detail-overlay">
              <div className="sales-detail-modal">
                <Skeleton variant="form" rows={6} />
                {detailError && (
                  <AutoDismissMessage
                    message={detailError}
                    className="sales-alert"
                  />
                )}
              </div>
            </div>,
            document.body,
          )
        ) : detailError ? (
          createPortal(
            <div className="sales-detail-overlay">
              <div
                className="sales-detail-modal"
                onClick={(event) => event.stopPropagation()}
              >
                <AutoDismissMessage
                  message={detailError}
                  className="sales-alert"
                />
                <button
                  type="button"
                  className="sales-detail-error-close"
                  onClick={closeDetail}
                >
                  Đóng
                </button>
              </div>
            </div>,
            document.body,
          )
        ) : (
          <SalesInvoiceDetail
            invoice={selectedInvoice}
            onClose={closeDetail}
            canEdit={canEditSales}
            canCancel={canCancelDraft}
            canRequestCancel={canRequestCancel}
            canCancelDirect={canCancelDirect}
            canManageStatus={canManageStatus}
            canComplete={canCompleteSales}
            canRecordPayment={canRecordPayment}
            canSubmitWarehouse={canSubmitWarehouse && (currentUser.role === "quản lý" || Number(selectedInvoice.employee?.id) === Number(currentUser.id))}
            canConfirmDelivery={canConfirmDelivery && (currentUser.role === "quản lý" || Number(selectedInvoice.employee?.id) === Number(currentUser.id))}
            needsAction={requiresSalesInvoiceAction(selectedInvoice, currentUser)}
            canApproveCancel={canApproveCancel}
            canManageDueDate={canManageDueDate}
            actionLoading={actionLoading}
            actionError={actionError}
            onEdit={openEditEditor}
            onCancelDraft={handleCancelDraft}
            onCancelRequest={handleCancelRequest}
            onCancelDirect={handleCancelDirect}
            onAdvanceStatus={advanceInvoiceStatus}
            onComplete={completeInvoice}
            onRecordPayment={recordInvoicePayment}
            onLoadMorePayments={loadMoreInvoicePayments}
            paymentHistoryLoading={paymentHistoryLoading}
            onSubmitWarehouse={submitInvoiceToWarehouse}
            onConfirmDelivery={confirmInvoiceDelivery}
            onUpdateDueDate={updatePaymentDueDate}
            onApproveCancel={(approved) =>
              setConfirmAction(approved ? "approve-cancel" : "reject-cancel")
            }
          />
        ))}
      <ConfirmDialog
        open={Boolean(confirmAction)}
        title={
          confirmAction === "cancel-draft"
            ? "Hủy đơn nháp?"
            : isManagerCancel
              ? "Hủy đơn trực tiếp?"
              : isCancelApproval
                ? "Duyệt hủy đơn?"
                : isCancelRejection
                  ? "Từ chối hủy đơn?"
                  : "Gửi yêu cầu hủy đơn?"
        }
        message={
          confirmAction === "cancel-draft"
            ? "Bạn có chắc muốn hủy đơn nháp này không?"
            : isManagerCancel
              ? "Bạn có chắc muốn hủy đơn này với quyền quản lý không?"
              : isCancelApproval
                ? "Bạn có chắc muốn duyệt hủy đơn này không?"
                : isCancelRejection
                  ? "Bạn có chắc muốn từ chối yêu cầu hủy đơn này không?"
                  : "Bạn có chắc muốn gửi yêu cầu hủy đơn này không?"
        }
        confirmLabel={
          confirmAction === "cancel-draft"
            ? "Hủy đơn"
            : isManagerCancel
              ? "Hủy đơn"
              : isCancelApproval
                ? "Duyệt hủy"
                : isCancelRejection
                  ? "Từ chối"
                  : "Gửi yêu cầu"
        }
        cancelLabel="Quay lại"
        danger={!isCancelApproval}
        loading={actionLoading}
        onConfirm={executeConfirmedAction}
        onCancel={() => setConfirmAction(null)}
      />
      <ConfirmDialog
        open={Boolean(discountConfirm)}
        title={
          discountConfirm?.approved ? "Duyệt khuyến mãi?" : "Từ chối khuyến mãi?"
        }
        message={
          discountActionError ||
          (discountConfirm
            ? `${discountConfirm.approved ? "Duyệt" : "Từ chối"} khuyến mãi ${discountConfirm.invoice.discount?.promotion?.name || "đã chọn"} với mức giảm ${formatCurrency(discountConfirm.invoice.discount?.amount)} cho đơn hàng #${discountConfirm.invoice.id}?`
            : "")
        }
        confirmLabel={discountConfirm?.approved ? "Duyệt khuyến mãi" : "Từ chối"}
        cancelLabel="Quay lại"
        danger={!discountConfirm?.approved}
        loading={discountActionLoading}
        onConfirm={executeDiscountAction}
        onCancel={() => {
          if (!discountActionLoading) {
            setDiscountActionError("");
            setDiscountConfirm(null);
          }
        }}
      />
      {showEditor && (
        <SalesInvoiceEditor
          invoice={editingInvoice}
          onClose={() => {
            setShowEditor(false);
            setEditingInvoice(null);
          }}
          onSaved={handleEditorSaved}
        />
      )}
    </div>
  );
}

export default SalesInvoices;
