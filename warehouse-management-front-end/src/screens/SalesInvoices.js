import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useSearchParams } from "react-router-dom";
import { authApis, endpoints } from "../configs/Apis";
import { getApiError } from "../utils/apiError";
import useNotificationState from "../utils/useNotificationState";
import { notifyInventoryChanged } from "../utils/inventoryEvents";
import { isSalesInvoiceRealtimeConnected } from "../utils/salesInvoiceRealtime";
import ConfirmDialog from "../components/ConfirmDialog";
import AutoDismissMessage from "../components/AutoDismissMessage";
import FieldAlert from "../components/FieldAlert";
import MoneyInput from "../components/MoneyInput";
import ProductRequestModal from "../components/ProductRequestModal";
import ProductRequestDropdownAction from "../components/ProductRequestDropdownAction";
import SharedSearchableDropdown from "../components/SearchableDropdown";
import CustomerFields from "../components/CustomerFields";
import SalesAreaField from "../components/SalesAreaField";
import PaymentMethodDropdown from "../components/PaymentMethodDropdown";
import {
  ProductEntryField,
  ProductEntryInfo,
} from "../components/ProductEntryFields";
import { getSalePriceBounds } from "../utils/salePrice";
import { formatCurrency, formatInteger as formatQuantity } from "../utils/money";
import { formatDateTime, formatIsoDate as formatDate } from "../utils/date";
import Pagination from "../components/Pagination";
import Skeleton from "../components/Skeleton";
import "../css/SalesInvoices.css";

const PER_PAGE = 10;
const DISCOUNT_PER_PAGE = 10;
const LIVE_REFRESH_INTERVAL_MS = 2000;
const CONNECTED_POLL_EVERY_TICKS = 5;
let salesAreasRequest = null;

async function getSalesAreasOnce() {
  if (!salesAreasRequest) {
    salesAreasRequest = authApis()
      .get(endpoints.salesAreas)
      .then((response) => response.data?.sales_areas || [])
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
  { value: "chờ kế toán", label: "Chờ kế toán" },
  { value: "hoàn thành", label: "Hoàn thành" },
  { value: "đã hủy", label: "Đã hủy" },
];

const DEBT_STATUS_OPTIONS = [
  { value: "", label: "Không lọc hạn thanh toán" },
  { value: "overdue", label: "Quá hạn thanh toán" },
  { value: "due_today", label: "Đến hạn hôm nay" },
  { value: "due_soon", label: "Sắp đến hạn (7 ngày)" },
];

function getRandomItems(items, count = 6) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [
      shuffled[randomIndex],
      shuffled[index],
    ];
  }
  return shuffled.slice(0, count);
}

function getComboPriceBoundsFromParts(parts) {
  const bounds = parts.map((part) => getSalePriceBounds(part.default_unit_price ?? part.unit_price));
  if (bounds.some((entry) => !entry)) return null;
  return {
    min: Math.round(parts.reduce((total, part, index) => total + bounds[index].min * Number(part.quantity || 0), 0)),
    max: Math.round(parts.reduce((total, part, index) => total + bounds[index].max * Number(part.quantity || 0), 0)),
  };
}

function allocateComboPrices(parts, targetTotal) {
  const baseTotal = parts.reduce(
    (total, part) => total + Number(part.default_unit_price ?? part.unit_price ?? 0) * Number(part.quantity || 0),
    0,
  );
  if (!baseTotal || !Number.isFinite(Number(targetTotal))) return parts;
  const ratio = Number(targetTotal) / baseTotal;
  let allocated = 0;
  return parts.map((part, index) => {
    const quantity = Number(part.quantity || 1);
    const defaultUnitPrice = Number(part.default_unit_price ?? part.unit_price ?? 0);
    const unitPrice = index === parts.length - 1
      ? Number(((Number(targetTotal) - allocated) / quantity).toFixed(2))
      : Number((defaultUnitPrice * ratio).toFixed(2));
    allocated += unitPrice * quantity;
    return { ...part, unit_price: unitPrice };
  });
}

function notifySalesActionCountChanged() {
  window.dispatchEvent(new Event("sales-invoices:action-count-refresh"));
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
  if (invoice.payment_due_status === "due_today" || days <= 1)
    return "is-due-red";
  if (days <= 3) return "is-due-orange-dark";
  if (days <= 6) return "is-due-orange-light";
  return "is-due-yellow";
}

export function SalesInvoiceDueCell({ invoice }) {
  if (isCancelledStatus(invoice.status)) {
    return <span className="sales-due-empty">—</span>;
  }
  if (
    isCompletedStatus(invoice.status) &&
    Number(invoice.remaining_amount || 0) <= 0
  ) {
    return <span className="sales-due-empty">Đã thanh toán</span>;
  }
  if (!invoice.payment_due_date) {
    return (
      <span className="sales-due-empty">
        {isCompletedStatus(invoice.status) ? "Chưa đặt hạn" : "—"}
      </span>
    );
  }
  return (
    <div className="sales-due-cell">
      <span>{formatDate(invoice.payment_due_date)}</span>
      {isCompletedStatus(invoice.status) &&
        ["overdue", "due_today", "due_soon", "not_due"].includes(
          invoice.payment_due_status,
        ) && (
          <span
            className={`sales-due-badge ${getPaymentDueUrgencyClass(invoice)}`}
          >
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
  if (value === "đang xử lý" || value === "processing")
    return "sales-status-processing";
  if (value === "đang giao" || value === "delivering" || value === "chờ kế toán")
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
  const ownsInvoice =
    Number(user?.id) === Number(invoice.employee?.id) && user?.id != null;
  const assigned = Number(user?.id) === Number(invoice.current_assignee?.id) && user?.id != null;
  if (invoice.cancel_requested) return ["kế toán", "quản lý"].includes(role);
  if (
    role === "quản lý" &&
    invoice.discount?.status === "chờ duyệt" &&
    !ownsInvoice
  )
    return true;
  if (invoice.status === "nháp") {
    if (invoice.warehouse_submitted_at)
      return assigned && ["thủ kho", "quản lý"].includes(role);
    return role === "quản lý" || (role === "nhân viên bán hàng" && ownsInvoice);
  }
  if (invoice.status === "đang xử lý")
    return invoice.delivery_method === "third_party"
      ? assigned && role === "quản lý"
      : assigned && ["thủ kho", "quản lý"].includes(role);
  if (invoice.status === "đang giao") {
    if (role === "quản lý" && assigned && invoice.assignment_stage === "delivery" &&
      (invoice.delivery_method === "third_party" || !invoice.delivery_method)) return true;
    return (
      role === "kế toán" &&
      assigned && invoice.workflow_stage === "chờ kế toán" &&
      !["chờ duyệt", "từ chối"].includes(invoice.discount?.status)
    );
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

function evaluatePromotionForOrder(
  promotion,
  subtotal,
  totalQuantity,
  ignoreDates = false,
) {
  if (!promotion) return { eligible: true, discount: 0, reason: "" };
  const currentDate = new Date();
  const today = [
    currentDate.getFullYear(),
    String(currentDate.getMonth() + 1).padStart(2, "0"),
    String(currentDate.getDate()).padStart(2, "0"),
  ].join("-");
  if (!ignoreDates && promotion.start_date && today < promotion.start_date) {
    return {
      eligible: false,
      discount: 0,
      reason: "Khuyến mãi chưa đến thời gian áp dụng.",
    };
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
    discount = (subtotal * discount) / 100;
    if (Number(promotion.max_discount_amount || 0) > 0) {
      discount = Math.min(discount, Number(promotion.max_discount_amount));
    }
  }
  discount = Math.min(Math.max(0, discount), subtotal);
  return {
    eligible: discount > 0,
    discount,
    reason:
      discount > 0
        ? "Đủ điều kiện áp dụng."
        : "Đơn chưa phát sinh giá trị để giảm.",
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
}) {
  const changeAmount =
    method === "cash" ? Math.max(0, (Number(amount) || 0) - total) : 0;
  return (
    <div className="sales-payment-entry-fields">
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
    </div>
  );
}

function DeliveryPlan({
  invoice,
  canManageStatus,
  isManager,
  canDispatch,
  deliveryManagers,
  currentUserId,
  staff,
  staffLoading,
  actionLoading,
  onPrepare,
  onDispatch,
}) {
  const [editing, setEditing] = useState(!invoice.delivery_method);
  const [method, setMethod] = useState(invoice.delivery_method || "internal");
  const [courierId, setCourierId] = useState(
    String(invoice.delivery_employee?.id || ""),
  );
  const [service, setService] = useState(invoice.delivery_service || "");
  const [tracking, setTracking] = useState(invoice.tracking_number || "");
  const [fee, setFee] = useState(String(invoice.shipping_fee || ""));
  const [fundMethod, setFundMethod] = useState(
    invoice.shipping_fund_method || "",
  );
  const [deliveryManagerId, setDeliveryManagerId] = useState("");
  useEffect(() => {
    if (!deliveryManagerId && deliveryManagers.length) {
      const preferred = deliveryManagers.find((person) => isManager && Number(person.id) === Number(currentUserId));
      setDeliveryManagerId(String((preferred || deliveryManagers[0]).id));
    }
  }, [deliveryManagerId, deliveryManagers, isManager, currentUserId]);
  useEffect(() => {
    setEditing(!invoice.delivery_method);
    setMethod(invoice.delivery_method || "internal");
    setCourierId(String(invoice.delivery_employee?.id || ""));
    setService(invoice.delivery_service || "");
    setTracking(invoice.tracking_number || "");
    setFee(String(invoice.shipping_fee || ""));
    setFundMethod(invoice.shipping_fund_method || "");
  }, [
    invoice.id,
    invoice.delivery_method,
    invoice.delivery_employee?.id,
    invoice.delivery_service,
    invoice.tracking_number,
    invoice.shipping_fee,
    invoice.shipping_fund_method,
  ]);
  const processing = invoice.status === "đang xử lý";
  const repairingLegacy = invoice.status === "đang giao" && !invoice.delivery_method && isManager;
  if (!processing && !invoice.delivery_method && !repairingLegacy) return null;
  const canEdit =
    (processing || repairingLegacy) &&
    canManageStatus &&
    !invoice.cancel_requested;
  const canSave =
    method === "internal"
      ? Boolean(courierId)
      : Boolean(
          service.trim() &&
          tracking.trim() &&
          Number(fee) >= 500 &&
          fundMethod && deliveryManagerId,
        );
  const staffOptions = [
    {
      value: "",
      label: staffLoading
        ? "Đang tải nhân viên..."
        : "Chọn nhân viên giao hàng",
    },
    ...staff.map((employee) => ({
      value: String(employee.id),
      label: employee.full_name,
    })),
  ];
  return (
    <section className="sales-delivery-plan">
      <div className="sales-delivery-plan-head">
        <div>
          <h3>Phương án giao hàng</h3>
          <p>{repairingLegacy ? "Đơn cũ chưa có phương án giao. Chọn lại để tiếp tục xác nhận giao hàng." : "Chọn cách giao trước khi chuyển đơn sang Đang giao."}</p>
        </div>
        {canEdit && invoice.delivery_method && !editing && (
          <button
            type="button"
            className="sales-delivery-edit"
            onClick={() => setEditing(true)}
          >
            Thay đổi
          </button>
        )}
      </div>
      {canEdit && editing ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!canSave) return;
            onPrepare(
              method === "internal"
                ? {
                    delivery_method: method,
                    delivery_employee_id: Number(courierId),
                  }
                : {
                    delivery_method: method,
                    delivery_service: service.trim(),
                    tracking_number: tracking.trim(),
                    shipping_fee: Number(fee),
                    shipping_fund_method: fundMethod,
                    delivery_manager_id: Number(deliveryManagerId),
                  },
            );
          }}
        >
          <div
            className="sales-delivery-choice"
            role="group"
            aria-label="Hình thức giao hàng"
          >
            <label>
              <input
                type="radio"
                name={`delivery-method-${invoice.id}`}
                value="internal"
                checked={method === "internal"}
                onChange={() => setMethod("internal")}
              />{" "}
              Nhân viên công ty
            </label>
            {canManageStatus && (
              <label>
                <input
                  type="radio"
                  name={`delivery-method-${invoice.id}`}
                  value="third_party"
                  checked={method === "third_party"}
                  onChange={() => setMethod("third_party")}
                />{" "}
                Dịch vụ vận chuyển
              </label>
            )}
          </div>
          {method === "internal" ? (
            <div className="sales-delivery-fields">
              <div className="sales-delivery-field">
                <span>Nhân viên giao hàng</span>
                <SharedSearchableDropdown
                  value={courierId}
                  onChange={setCourierId}
                  options={staffOptions}
                  placeholder="Chọn nhân viên giao hàng"
                  ariaLabel="Nhân viên giao hàng"
                  disabled={staffLoading}
                />
              </div>
            </div>
          ) : (
            <div className="sales-delivery-fields">
              <label>
                Dịch vụ giao hàng
                <input
                  value={service}
                  onChange={(event) => setService(event.target.value)}
                  maxLength={120}
                  placeholder="Ví dụ: Giao Hàng Nhanh"
                  required
                />
              </label>
              <label>
                Mã vận đơn
                <input
                  value={tracking}
                  onChange={(event) => setTracking(event.target.value)}
                  maxLength={120}
                  placeholder="Nhập mã theo dõi"
                  required
                />
              </label>
              <label>
                Phí vận chuyển
                <MoneyInput
                  value={fee}
                  onChange={setFee}
                  label="Phí vận chuyển"
                  placeholder="Ví dụ: 35.000"
                  required
                />
              </label>
              <div className="sales-delivery-field">
                <span>Chi từ quỹ</span>
                <PaymentMethodDropdown
                  value={fundMethod}
                  onChange={setFundMethod}
                />
              </div>
              <div className="sales-delivery-field">
                <span>Quản lý nhận bàn giao</span>
                <SharedSearchableDropdown
                  value={deliveryManagerId}
                  onChange={setDeliveryManagerId}
                  options={[{ value: "", label: "Chọn quản lý" }, ...deliveryManagers.map((person) => ({
                    value: String(person.id), label: person.full_name,
                  }))]}
                  placeholder="Chọn quản lý" ariaLabel="Quản lý nhận đơn giao ngoài"
                />
              </div>
            </div>
          )}
          <p className="sales-delivery-hint">
            {method === "internal"
              ? !staffLoading && staff.length === 0
                ? "Chưa có nhân viên giao hàng đã được duyệt. Quản lý cần tạo và duyệt tài khoản trước."
                : "Chỉ nhân viên được chọn mới có thể bắt đầu giao đơn."
              : "Quản lý xác nhận bàn giao trước khi trừ phí vận chuyển khỏi quỹ."}
          </p>
          <div className="sales-delivery-actions">
            {invoice.delivery_method && (
              <button
                type="button"
                className="sales-delivery-edit"
                onClick={() => setEditing(false)}
              >
                Hủy sửa
              </button>
            )}
            <button type="submit" disabled={actionLoading || !canSave}>
              Lưu phương án
            </button>
          </div>
        </form>
      ) : invoice.delivery_method ? (
        <>
          {invoice.delivery_method === "internal" ? (
            <div className="sales-delivery-summary">
              <span>Nhân viên công ty</span>
              <strong>{invoice.delivery_employee?.full_name || "—"}</strong>
            </div>
          ) : (
            <div className="sales-delivery-summary-grid">
              <div className="sales-delivery-summary">
                <span>Dịch vụ</span>
                <strong>{invoice.delivery_service}</strong>
              </div>
              <div className="sales-delivery-summary">
                <span>Mã vận đơn</span>
                <strong>{invoice.tracking_number}</strong>
              </div>
              <div className="sales-delivery-summary">
                <span>Phí vận chuyển</span>
                <strong>{formatCurrency(invoice.shipping_fee)}</strong>
              </div>
              <div className="sales-delivery-summary">
                <span>Quỹ chi</span>
                <strong>
                  {invoice.shipping_fund_method === "cash"
                    ? "Tiền mặt"
                    : "Chuyển khoản"}
                </strong>
              </div>
            </div>
          )}
          {processing && (
            <p className="sales-delivery-hint">
              {invoice.delivery_method === "internal"
                ? "Đang chờ nhân viên được phân công bắt đầu giao hàng."
                : "Quỹ sẽ được trừ khi quản lý xác nhận bàn giao."}
            </p>
          )}
          {processing &&
            invoice.delivery_method === "third_party" &&
            isManager && canDispatch &&
            !invoice.cancel_requested && (
              <div className="sales-delivery-actions">
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={onDispatch}
                >
                  Xác nhận bàn giao cho dịch vụ
                </button>
              </div>
            )}
        </>
      ) : (
        <p className="sales-delivery-hint">Chưa chọn phương án giao hàng.</p>
      )}
    </section>
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
  isManager,
  currentUserId,
  deliveryStaff,
  deliveryStaffLoading,
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
  onAcceptAssignment,
  onReassign,
  onConfirmDelivered,
  onPrepareDelivery,
  onLoadMorePayments,
  paymentHistoryLoading,
}) {
  const [completionPayment, setCompletionPayment] = useState("");
  const [warehouseCandidates, setWarehouseCandidates] = useState([]);
  const [accountingCandidates, setAccountingCandidates] = useState([]);
  const [warehouseRecipientId, setWarehouseRecipientId] = useState("");
  const [accountantId, setAccountantId] = useState("");
  const [deliveryAssigneeId, setDeliveryAssigneeId] = useState("");
  const [deliveryRecipient, setDeliveryRecipient] = useState("");
  const [deliveryNote, setDeliveryNote] = useState("");
  const assignedToMe = Number(currentUserId) === Number(invoice.current_assignee?.id) && currentUserId != null;
  const activeAssignmentStage = invoice.assignment_stage ||
    (invoice.workflow_stage === "chờ kho" ? "warehouse" :
      invoice.workflow_stage === "chờ kế toán" ? "accounting" :
      ["đang xử lý", "đang giao"].includes(invoice.status)
        ? (invoice.delivery_method ? "delivery" : "warehouse") : null);
  useEffect(() => {
    if (!invoice.current_assignee?.id) return;
    const id = String(invoice.current_assignee.id);
    if (activeAssignmentStage === "warehouse") setWarehouseRecipientId(id);
    if (activeAssignmentStage === "delivery") setDeliveryAssigneeId(id);
    if (activeAssignmentStage === "accounting") setAccountantId(id);
  }, [invoice.id, invoice.current_assignee?.id, activeAssignmentStage]);
  useEffect(() => {
    let active = true;
    const params = { warehouse_id: invoice.warehouse_id };
    if (canSubmitWarehouse || canManageStatus || isManager) {
      authApis().get(endpoints.salesInvoiceAssignees, { params: { ...params, stage: "warehouse" } })
        .then(({ data }) => { if (active) setWarehouseCandidates(data.employees || []); })
        .catch(() => { if (active) setWarehouseCandidates([]); });
    }
    if (isManager) {
      authApis().get(endpoints.salesInvoiceAssignees, { params: { ...params, stage: "accounting" } })
        .then(({ data }) => { if (active) setAccountingCandidates(data.employees || []); })
        .catch(() => { if (active) setAccountingCandidates([]); });
    }
    return () => { active = false; };
  }, [invoice.id, invoice.warehouse_id, canSubmitWarehouse, canManageStatus, isManager]);
  useEffect(() => {
    if (warehouseCandidates.length && !warehouseRecipientId) setWarehouseRecipientId(String(
      activeAssignmentStage === "warehouse" && invoice.current_assignee?.id
        ? invoice.current_assignee.id : warehouseCandidates[0].id,
    ));
  }, [warehouseCandidates, warehouseRecipientId, activeAssignmentStage, invoice.current_assignee?.id]);
  useEffect(() => {
    if (accountingCandidates.length && !accountantId) setAccountantId(String(
      activeAssignmentStage === "accounting" && invoice.current_assignee?.id
        ? invoice.current_assignee.id : accountingCandidates[0].id,
    ));
  }, [accountingCandidates, accountantId, activeAssignmentStage, invoice.current_assignee?.id]);
  const deliveryCandidates = invoice.delivery_method === "internal"
    ? deliveryStaff : warehouseCandidates.filter((person) => person.role === "quản lý");
  useEffect(() => {
    if (deliveryCandidates.length && !deliveryAssigneeId) setDeliveryAssigneeId(String(
      activeAssignmentStage === "delivery" && invoice.current_assignee?.id
        ? invoice.current_assignee.id : deliveryCandidates[0].id,
    ));
  }, [deliveryCandidates, deliveryAssigneeId, activeAssignmentStage, invoice.current_assignee?.id]);
  const assigneeOptions = (staff, label) => [
    { value: "", label },
    ...staff.map((person) => ({
      value: String(person.id),
      label: person.active_count == null ? person.full_name : `${person.full_name} · ${person.active_count} đơn đang phụ trách`,
    })),
  ];
  const [completionPaymentMethod, setCompletionPaymentMethod] = useState("");
  const [paymentDueDate, setPaymentDueDate] = useState(
    invoice.payment_due_date || "",
  );
  useEffect(() => {
    setPaymentDueDate(invoice.payment_due_date || "");
  }, [invoice.id, invoice.payment_due_date]);
  const discountAmount = Number(invoice.discount?.amount || 0);
  const paidAmount = Number(invoice.paid_amount || 0);
  const remainingAmount = Number(invoice.remaining_amount || 0);
  const draft = ["nháp", "draft"].includes(
    String(invoice.status || "").toLowerCase(),
  );
  const completed = isCompletedStatus(invoice.status);
  const cancelled = isCancelledStatus(invoice.status);
  const discountPending = invoice.discount?.status === "chờ duyệt";
  const awaitingAccounting =
    canComplete &&
    invoice.workflow_stage === "chờ kế toán" && assignedToMe && Boolean(invoice.accepted_at) &&
    !invoice.cancel_requested &&
    !["chờ duyệt", "từ chối"].includes(invoice.discount?.status);
  const showPaymentDetails =
    !draft && !cancelled && (completed || paidAmount > 0 || awaitingAccounting);
  const enteredPayment = Number(completionPayment) || 0;
  const unpaidAfterEntry = Math.max(
    0,
    remainingAmount - Math.min(enteredPayment, remainingAmount),
  );
  const invalidPaymentEntry =
    actionLoading ||
    (enteredPayment > 0 && !completionPaymentMethod) ||
    (completionPaymentMethod !== "cash" && enteredPayment > remainingAmount) ||
    (awaitingAccounting
      ? unpaidAfterEntry > 0 && !paymentDueDate
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
              className={`sales-status-badge ${getStatusClass(invoice.workflow_stage || invoice.status)}`}
            >
              {getStatusLabel(invoice.workflow_stage || invoice.status)}
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
          {invoice.current_assignee && !completed && !cancelled && (
            <section className="sales-assignment-panel">
              <strong>Người phụ trách: {invoice.current_assignee.full_name}</strong>
              <span>{invoice.accepted_at ? "Đã nhận việc" : "Chờ nhận việc"}</span>
            </section>
          )}
          {assignedToMe && !invoice.accepted_at && !invoice.cancel_requested &&
            (["warehouse", "accounting"].includes(invoice.assignment_stage) ||
              (isManager && invoice.assignment_stage === "delivery")) && (
              <div className="sales-detail-actions">
                <button type="button" onClick={onAcceptAssignment} disabled={actionLoading}>Nhận xử lý đơn này</button>
              </div>
            )}
          {isManager && activeAssignmentStage && !completed && !cancelled && !invoice.cancel_requested && (
            <section className="sales-assignment-panel">
              <label>Đổi người phụ trách</label>
              <SharedSearchableDropdown
                value={activeAssignmentStage === "warehouse" ? warehouseRecipientId : activeAssignmentStage === "delivery" ? deliveryAssigneeId : accountantId}
                onChange={activeAssignmentStage === "warehouse" ? setWarehouseRecipientId : activeAssignmentStage === "delivery" ? setDeliveryAssigneeId : setAccountantId}
                options={assigneeOptions(activeAssignmentStage === "warehouse" ? warehouseCandidates : activeAssignmentStage === "delivery" ? deliveryCandidates : accountingCandidates, "Chọn người nhận")}
                placeholder="Chọn người nhận"
                ariaLabel="Đổi người phụ trách đơn"
              />
              <button type="button" disabled={actionLoading || !(activeAssignmentStage === "warehouse" ? warehouseRecipientId : activeAssignmentStage === "delivery" ? deliveryAssigneeId : accountantId) ||
                Number(activeAssignmentStage === "warehouse" ? warehouseRecipientId : activeAssignmentStage === "delivery" ? deliveryAssigneeId : accountantId) === Number(invoice.current_assignee?.id)}
                onClick={() => onReassign(activeAssignmentStage === "warehouse" ? warehouseRecipientId : activeAssignmentStage === "delivery" ? deliveryAssigneeId : accountantId)}>
                Lưu phân công
              </button>
            </section>
          )}
          <div className="sales-detail-overview">
            <section className="sales-detail-info-section">
              <h3>Thông tin đơn</h3>
              <dl>
                <SalesDetailLine label="Thời gian lập đơn">
                  {formatDateTime(invoice.sold_at)}
                </SalesDetailLine>
                <SalesDetailLine label="Nhân viên lập đơn">
                  {invoice.employee?.full_name || "—"}
                </SalesDetailLine>
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
                <SalesDetailLine label="Họ và tên">
                  {invoice.customer?.full_name || "—"}
                </SalesDetailLine>
                <SalesDetailLine label="Số điện thoại">
                  {invoice.customer?.phone || "—"}
                </SalesDetailLine>
                <SalesDetailLine label="Địa chỉ giao hàng">
                  {invoice.customer?.address || "—"}
                </SalesDetailLine>
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
                <span
                  className={`sales-payment-status ${getPaymentStatusClass(invoice.payment_status)}`}
                >
                  {getPaymentStatusLabel(invoice.payment_status)}
                </span>
              </div>
            )}
            <dl>
              {!draft && !cancelled && discountAmount > 0 && (
                <SalesDetailLine
                  label={`Khuyến mãi${discountPending ? " (chờ duyệt)" : ""}`}
                >
                  -{formatCurrency(discountAmount)}
                </SalesDetailLine>
              )}
              <SalesDetailLine
                label={
                  cancelled ? "Giá trị đơn trước khi hủy" : "Tổng tiền đơn"
                }
                className="sales-payment-total"
              >
                {formatCurrency(invoice.final_amount)}
              </SalesDetailLine>
              {!draft && paidAmount > 0 && (
                <SalesDetailLine label="Khách đã trả">
                  {formatCurrency(paidAmount)}
                </SalesDetailLine>
              )}
              {showPaymentDetails &&
                (completed || awaitingAccounting) &&
                remainingAmount > 0 && (
                  <SalesDetailLine
                    label="Số tiền cần trả"
                    className="sales-payment-remaining"
                  >
                    {formatCurrency(remainingAmount)}
                  </SalesDetailLine>
                )}
              {showPaymentDetails &&
                (completed || awaitingAccounting) &&
                remainingAmount > 0 &&
                invoice.payment_due_date && (
                  <SalesDetailLine label="Hạn thanh toán">
                    {formatDate(invoice.payment_due_date)}
                  </SalesDetailLine>
                )}
              {showPaymentDetails &&
                completed &&
                remainingAmount > 0 &&
                invoice.payment_due_date &&
                ["overdue", "due_today", "due_soon", "not_due"].includes(
                  invoice.payment_due_status,
                ) && (
                  <SalesDetailLine
                    label="Tình trạng hạn"
                    className={`sales-payment-due-status ${getPaymentDueUrgencyClass(invoice)}`}
                  >
                    {getPaymentDueLabel(invoice)}
                  </SalesDetailLine>
                )}
            </dl>
          </section>
          {canManageDueDate &&
            (completed || awaitingAccounting) &&
            remainingAmount > 0 && (
              <section
                className="sales-due-date-editor"
                aria-label="Hạn thanh toán"
              >
                <div className="sales-due-date-copy">
                  <strong>Hạn thanh toán</strong>
                  <p>
                    Ngày khách hẹn trả số tiền còn nợ. Không cần thu tiền để đặt
                    hạn.
                  </p>
                </div>
                <div className="sales-due-date-controls">
                  <label>
                    <span>Ngày hẹn</span>
                    <input
                      type="date"
                      value={paymentDueDate}
                      onChange={(event) =>
                        setPaymentDueDate(event.target.value)
                      }
                    />
                  </label>
                  {completed && (
                    <button
                      type="button"
                      onClick={() => onUpdateDueDate(paymentDueDate)}
                      disabled={
                        actionLoading ||
                        !paymentDueDate ||
                        paymentDueDate === invoice.payment_due_date
                      }
                    >
                      Lưu hạn thanh toán
                    </button>
                  )}
                </div>
                {awaitingAccounting &&
                  unpaidAfterEntry > 0 &&
                  !paymentDueDate && (
                    <small>
                      Chọn ngày hẹn để hoàn thành đơn khi khách chưa trả đủ.
                    </small>
                  )}
              </section>
            )}
          {((canRecordPayment && completed && remainingAmount > 0) ||
            awaitingAccounting) && (
            <div className="sales-detail-actions sales-complete-actions">
              <div className="sales-completion-heading">
                <strong>
                  {awaitingAccounting
                    ? "Thu tiền ngay (không bắt buộc)"
                    : "Ghi nhận thanh toán"}
                </strong>
                {awaitingAccounting && (
                  <p>
                    Khi hoàn thành đơn, kế toán xác nhận đã giao. Nếu khách hẹn
                    trả sau, để trống số tiền.
                  </p>
                )}
              </div>
              <SalesPaymentFields
                amount={completionPayment}
                onAmountChange={setCompletionPayment}
                method={completionPaymentMethod}
                onMethodChange={setCompletionPaymentMethod}
                total={remainingAmount}
                amountLabel="Số tiền khách trả"
              />
              <div className="sales-completion-actions">
                <button
                  type="button"
                  onClick={() =>
                    awaitingAccounting
                      ? onComplete(
                          enteredPayment,
                          completionPaymentMethod || null,
                          paymentDueDate,
                        )
                      : onRecordPayment(enteredPayment, completionPaymentMethod)
                  }
                  disabled={invalidPaymentEntry}
                >
                  {awaitingAccounting
                    ? enteredPayment > 0
                      ? "Hoàn thành và thu tiền"
                      : "Hoàn thành đơn, ghi công nợ"
                    : "Lưu thanh toán"}
                </button>
              </div>
            </div>
          )}
          {!draft && invoice.payments?.length > 0 && (
            <section
              className="sales-payment-history"
              aria-label="Lịch sử thanh toán"
            >
              <h4>
                Lịch sử thanh toán
                {invoice.payments_total > 0
                  ? ` (${invoice.payments_total})`
                  : ""}
              </h4>
              {invoice.payments.map((payment) => (
                <div key={payment.id}>
                  <span>
                    {payment.payment_method === "cash"
                      ? "Tiền mặt"
                      : payment.payment_method === "bank_transfer"
                        ? "Chuyển khoản"
                        : "Chưa xác định"}
                    {" ("}
                    <time dateTime={payment.paid_at}>
                      {formatDateTime(payment.paid_at, true)}
                    </time>
                    {")"}
                    <small>
                      Người xác nhận thanh toán:{" "}
                      {payment.confirmed_by?.full_name || "Chưa có thông tin"}
                    </small>
                    {payment.note?.startsWith("Khách đưa ") && (
                      <small>{payment.note}</small>
                    )}
                  </span>
                  <strong>{formatCurrency(payment.amount)}</strong>
                </div>
              ))}
              {invoice.payments.length <
                Number(invoice.payments_total || invoice.payments.length) &&
                Number(invoice.payments_page || 1) <
                  Math.ceil(Number(invoice.payments_total || 0) / 20) && (
                  <button
                    type="button"
                    className="sales-payment-more"
                    onClick={onLoadMorePayments}
                    disabled={paymentHistoryLoading}
                  >
                    {paymentHistoryLoading
                      ? "Đang tải..."
                      : "Xem thêm thanh toán"}
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
              <summary>Lịch sử xử lý</summary>
              <ul className="sales-workflow-timeline">
                {[...invoice.workflow_events].reverse().map((event) => (
                  <li key={event.id}>
                    <div className="sales-workflow-entry-line">
                      <span>
                        {{
                          submitted_to_warehouse: "Đã gửi kho",
                          warehouse_processing: "Kho bắt đầu xử lý",
                          delivery_prepared: "Đã chọn phương án giao hàng",
                          dispatched: "Đã bắt đầu giao hàng",
                          delivered_to_accounting: "Đã giao hàng, bàn giao kế toán",
                          legacy_delivery_repaired: "Đã khôi phục phương án giao cho đơn cũ",
                          assigned: "Đã phân công người xử lý",
                          accepted: "Đã nhận xử lý",
                          completed: "Kế toán hoàn thành đơn",
                          cancelled: "Đã hủy đơn",
                        }[event.action] || event.action}
                      </span>
                      <time dateTime={event.occurred_at}>
                        {formatDateTime(event.occurred_at)}
                      </time>
                    </div>
                    <small>
                      {event.actor || "Nhân viên"}
                      {event.action === "assigned" && event.recipient
                        ? ` → ${event.recipient}`
                        : event.detail ? ` · ${event.detail}` : ""}
                    </small>
                  </li>
                ))}
              </ul>
            </details>
          )}
          {(canEdit || canCancel || canApproveCancel) && (
            <div className="sales-detail-actions">
              {canEdit &&
                invoice.status === "nháp" &&
                !invoice.warehouse_submitted_at && (
                  <button
                    type="button"
                    onClick={onEdit}
                    disabled={actionLoading}
                  >
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
          {canSubmitWarehouse &&
            invoice.status === "nháp" &&
            !invoice.warehouse_submitted_at && (
              <div className="sales-detail-actions">
                <div className="sales-assignment-picker">
                  <label>Thủ kho nhận đơn</label>
                  <SharedSearchableDropdown
                    value={warehouseRecipientId}
                    onChange={setWarehouseRecipientId}
                    options={assigneeOptions(warehouseCandidates, "Chọn thủ kho")}
                    placeholder="Chọn thủ kho"
                    ariaLabel="Thủ kho nhận đơn"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => onSubmitWarehouse(warehouseRecipientId)}
                  disabled={actionLoading || !warehouseRecipientId}
                >
                  Gửi đơn cho kho
                </button>
              </div>
            )}
          {canManageStatus && assignedToMe && Boolean(invoice.accepted_at) && invoice.assignment_stage === "warehouse" &&
            invoice.status === "nháp" &&
            Boolean(invoice.warehouse_submitted_at) && (
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
          <DeliveryPlan
            invoice={invoice}
            canManageStatus={(canManageStatus && assignedToMe && Boolean(invoice.accepted_at) && invoice.assignment_stage === "warehouse") || (isManager && invoice.status === "đang xử lý" && invoice.assignment_stage === "delivery") || (isManager && invoice.status === "đang giao" && !invoice.delivery_method)}
            isManager={isManager}
            canDispatch={isManager && assignedToMe && Boolean(invoice.accepted_at) && invoice.assignment_stage === "delivery"}
            deliveryManagers={warehouseCandidates.filter((person) => person.role === "quản lý")}
            currentUserId={currentUserId}
            staff={deliveryStaff}
            staffLoading={deliveryStaffLoading}
            actionLoading={actionLoading}
            onPrepare={onPrepareDelivery}
            onDispatch={() => onAdvanceStatus("đang giao")}
          />
          {isManager && assignedToMe && invoice.assignment_stage === "delivery" &&
            Boolean(invoice.accepted_at) && invoice.delivery_method === "third_party" && invoice.status === "đang giao" &&
            !invoice.accounting_handoff_at && !invoice.cancel_requested && (
              <section className="sales-assignment-panel">
                <h3>Xác nhận đối tác đã giao hàng</h3>
                <input value={deliveryRecipient} onChange={(event) => setDeliveryRecipient(event.target.value)}
                  placeholder="Tên người nhận hàng" maxLength={120} />
                <input value={deliveryNote} onChange={(event) => setDeliveryNote(event.target.value)}
                  placeholder="Ghi chú giao hàng (nếu có)" maxLength={1000} />
                <SharedSearchableDropdown value={accountantId} onChange={setAccountantId}
                  options={assigneeOptions(accountingCandidates, "Chọn kế toán")}
                  placeholder="Chọn kế toán tiếp nhận" ariaLabel="Kế toán tiếp nhận" />
                <button type="button" disabled={actionLoading || !deliveryRecipient.trim() || !accountantId}
                  onClick={() => onConfirmDelivered({ recipient: deliveryRecipient.trim(), note: deliveryNote.trim(), accountant_id: Number(accountantId) })}>
                  Xác nhận đã giao và bàn giao kế toán
                </button>
              </section>
            )}
          {invoice.delivered_at && (
            <p className="sales-delivery-proof">
              {invoice.delivery_recipient
                ? `Đã giao cho ${invoice.delivery_recipient} lúc ${formatDateTime(invoice.delivered_at)}`
                : `Đã giao lúc ${formatDateTime(invoice.delivered_at)}`}
              {invoice.delivery_note ? ` · ${invoice.delivery_note}` : ""}
            </p>
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
  const [salesAreas, setSalesAreas] = useState([]);
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
  const [warehouseId, setWarehouseId] = useState(
    String(invoice?.warehouse_id || ""),
  );
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
  const [salesAreaOverrideId, setSalesAreaOverrideId] = useState("");
  const [items, setItems] = useState(
    (invoice?.items || []).map((item) => ({
      productId: String(item.product_id),
      productSearch: item.product_name || "",
      unit: item.unit || "",
      defaultPrice:
        item.default_sale_price != null ? String(item.default_sale_price) : "",
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
  const [comboDropdownSamples, setComboDropdownSamples] = useState({});
  const [productRequestName, setProductRequestName] = useState("");
  const [productRequestOpen, setProductRequestOpen] = useState(false);
  const [combos, setCombos] = useState([]);
  const [comboSuggestion, setComboSuggestion] = useState(null);
  const [comboSets, setComboSets] = useState("1");
  const [applyingCombo, setApplyingCombo] = useState(false);
  const [formSuccess, setFormSuccess] = useState("");
  const customerSearchTimerRef = useRef(null);
  const customerSearchRequestRef = useRef(0);
  const customerSearchTouchedRef = useRef(false);
  const productSearchTimerRefs = useRef({});
  const productSearchRequestRefs = useRef({});

  useEffect(() => {
    let cancelled = false;
    authApis()
      .get(endpoints.warehouses)
      .then((response) => {
        if (cancelled) return;
        setWarehouses(response.data?.warehouses || []);
        setWarehouseId(
          (current) =>
            current || String(response.data?.default_warehouse_id || ""),
        );
      })
      .catch((requestError) => {
        if (!cancelled) setFormError(getApiError(requestError));
      });
    return () => {
      cancelled = true;
    };
  }, [setFormError]);

  useEffect(() => {
    if (isEditing || salesAreas.length) {
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
  }, [isEditing, salesAreas.length, setFormError]);

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
    authApis()
      .get(endpoints.productCombos)
      .then((response) => {
        if (active) setCombos(response.data?.combos || []);
      })
      .catch((requestError) => {
        if (active) setFormError(getApiError(requestError));
      });
    return () => {
      active = false;
    };
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
    customerSearchRequestRef.current += 1;
    setCustomerSearchInput(value);
    setCustomerId("");
    setSelectedCustomer(null);
    setCustomers([]);
    setCustomerSearchLoading(true);
  };

  const handleCustomerDropdownOpen = async () => {
    if (customerSearchInput.trim() || customerSearchLoading) return;

    const requestId = customerSearchRequestRef.current + 1;
    customerSearchRequestRef.current = requestId;
    setCustomerSearchLoading(true);
    try {
      const response = await authApis().get(endpoints.customers, {
        params: { page: 1, per_page: 100 },
      });
      if (customerSearchRequestRef.current === requestId) {
        setCustomers(getRandomItems(response.data?.customers || []));
      }
    } catch (requestError) {
      if (customerSearchRequestRef.current === requestId) {
        setFormError(getApiError(requestError));
      }
    } finally {
      if (customerSearchRequestRef.current === requestId) {
        setCustomerSearchLoading(false);
      }
    }
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

  const handleSalesAreaCreated = (area) => setSalesAreas((current) =>
    [...current.filter((item) => item.id !== area.id), area]
      .sort((first, second) => first.name.localeCompare(second.name, "vi"))
  );

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
    ? combos.filter((combo) =>
        combo.items.some(
          (part) => String(part.product_id) === comboSuggestion.productId,
        ),
      )
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
    setComboSuggestion(null);
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              productId: "",
              productSearch: value,
              defaultPrice: "",
              unitPrice: "",
            }
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

  const handleProductDropdownOpen = async (index) => {
    const item = items[index];
    if (item?.productSearch?.trim() || productSearchLoading[index]) return;

    const sampledCombos = getRandomItems(combos, 2);
    setComboDropdownSamples((current) => ({
      ...current,
      [index]: sampledCombos,
    }));

    if (saleSource === "employee_stock") {
      setProductSearchResults((current) => ({
        ...current,
        [index]: getRandomItems(saleProducts),
      }));
      return;
    }

    const requestId = (productSearchRequestRefs.current[index] || 0) + 1;
    productSearchRequestRefs.current[index] = requestId;
    setProductSearchLoading((current) => ({ ...current, [index]: true }));
    try {
      const response = await authApis().get(endpoints.productsInventory, {
        params: {
          warehouse_id: warehouseId || undefined,
          page: 1,
          per_page: 100,
        },
      });
      if (productSearchRequestRefs.current[index] !== requestId) return;
      setProductSearchResults((current) => ({
        ...current,
        [index]: getRandomItems(response.data?.products || []),
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
          defaultPrice:
            selectedProduct?.default_sale_price != null
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
    if (String(value).startsWith("combo:")) {
      const combo = combos.find(
        (entry) => `combo:${entry.id}` === String(value),
      );
      setComboSuggestion(null);
      setFormSuccess("");
      if (combo) applyCombo(combo, index);
      return;
    }
    const productId = String(value);
    updateItem(index, "productId", productId);
    setFormSuccess("");
    setComboSets("1");
    setComboSuggestion(productId ? { index, productId } : null);
  };

  const applyCombo = async (combo, targetIndex = null) => {
    if (targetIndex === null && !comboSuggestion) return;
    const index = targetIndex ?? comboSuggestion.index;
    if (!items[index]) return;
    if (
      targetIndex === null &&
      String(items[index].productId) !== comboSuggestion.productId
    ) {
      setComboSuggestion(null);
      return;
    }
    const numberOfSets = targetIndex === null ? Number(comboSets) : 1;
    if (
      !Number.isInteger(numberOfSets) ||
      numberOfSets < 1 ||
      numberOfSets > 1000
    ) {
      setFormError("Số bộ combo phải là số nguyên từ 1 đến 1.000.");
      return;
    }
    const comboProductIds = new Set(
      combo.items.map((part) => String(part.product_id)),
    );
    if (items.some((item, itemIndex) => {
      if (itemIndex === index) return false;
      if (item.type === "combo") {
        return item.comboProducts?.some((part) =>
          comboProductIds.has(String(part.product_id)),
        );
      }
      return comboProductIds.has(String(item.productId));
    })) {
      setFormError(
        "Combo có sản phẩm đã nằm ở dòng khác. Hãy gộp về một dòng trước khi dùng combo.",
      );
      return;
    }
    try {
      setApplyingCombo(true);
      setFormError("");
      const productDetails = await Promise.all(
        combo.items.map(async (part) => {
          if (saleSource === "employee_stock") {
            return saleProducts.find(
              (product) => String(product.id) === String(part.product_id),
            );
          }
          const response = await authApis().get(
            endpoints.productDetail(part.product_id),
            {
              params: { warehouse_id: warehouseId },
            },
          );
          return response.data?.product;
        }),
      );
      if (productDetails.some((product) => !product)) {
        setFormError(
          "Một số sản phẩm của combo chưa có trong nguồn hàng đã chọn.",
        );
        return;
      }
      const unpricedProduct = productDetails.find(
        (product) => !getSalePriceBounds(product.default_sale_price),
      );
      if (unpricedProduct) {
        setFormError(
          `${unpricedProduct.name} cần có giá bán mặc định từ 500 đ trước khi thêm combo.`,
        );
        return;
      }

      const next = [...items];
      let totalComboPrice = 0;
      const comboProducts = [];

      for (const [partIndex, part] of combo.items.entries()) {
        const product = productDetails[partIndex];
        const requestedQuantity = Number(part.quantity) * numberOfSets;

        if (Number(product.available_stock || 0) < requestedQuantity) {
          setFormError(
            `${product.name} không đủ tồn kho để thêm combo (${requestedQuantity} cần, ${product.available_stock || 0} còn).`,
          );
          return;
        }

        totalComboPrice +=
          Number(product.default_sale_price) * Number(part.quantity);
        comboProducts.push({
          product_id: String(product.id),
          product_name: product.name,
          unit: product.unit,
          quantity: Number(part.quantity),
          unit_price: Number(product.default_sale_price),
          default_unit_price: Number(product.default_sale_price),
          available_stock: product.available_stock,
        });
      }

      const calculatedComboPrice = Math.round(totalComboPrice);
      const comboPriceBounds = getComboPriceBoundsFromParts(comboProducts);
      const configuredComboPrice = Number(combo.sale_price ?? calculatedComboPrice);
      if (
        !comboPriceBounds ||
        configuredComboPrice < comboPriceBounds.min ||
        configuredComboPrice > comboPriceBounds.max
      ) {
        setFormError(
          `Giá combo "${combo.name}" đã thay đổi theo giá sản phẩm. Hãy cập nhật lại combo trong phần quản lý sản phẩm.`,
        );
        return;
      }

      next[index] = {
        type: "combo",
        comboId: String(combo.id),
        comboName: combo.name,
        comboProducts: allocateComboPrices(comboProducts, configuredComboPrice),
        comboBasePrice: calculatedComboPrice,
        quantity: String(numberOfSets),
        unitPrice: String(configuredComboPrice),
        productId: "",
        productSearch: combo.name,
      };

      setItems(next);
      setComboSuggestion(null);
      setFormSuccess(
        `Đã thêm combo "${combo.name}" (${numberOfSets} bộ). Bạn có thể chỉnh số lượng trước khi lưu đơn.`,
      );
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
    setFormSuccess("");
    setItems([
      { productId: "", productSearch: "", quantity: "1", unitPrice: "" },
    ]);
    setProductSearchResults({});
    setProductSearchLoading({});
    setComboDropdownSamples({});
  };

  const handleWarehouseChange = (value) => {
    setWarehouseId(String(value));
    setComboSuggestion(null);
    setFormSuccess("");
    Object.values(productSearchTimerRefs.current).forEach(clearTimeout);
    Object.keys(productSearchRequestRefs.current).forEach((key) => {
      productSearchRequestRefs.current[key] += 1;
    });
    setItems([
      { productId: "", productSearch: "", quantity: "1", unitPrice: "" },
    ]);
    setProductSearchResults({});
    setProductSearchLoading({});
    setComboDropdownSamples({});
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
      if (item.type === "combo") {
        if (Number(item.quantity) <= 0) {
          setFormError("Số bộ combo phải lớn hơn 0.");
          return;
        }
        const comboPriceBounds = getComboPriceBoundsFromParts(item.comboProducts || []);
        if (
          !comboPriceBounds ||
          Number(item.unitPrice) < comboPriceBounds.min ||
          Number(item.unitPrice) > comboPriceBounds.max
        ) {
          setFormError(
            "Giá combo phải nằm trong giới hạn ±10% giá bán mặc định của các sản phẩm trong bộ.",
          );
          return;
        }
        continue;
      }

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
        setFormError(
          "Sản phẩm đã chọn chưa có giá bán mặc định hợp lệ từ 500 đ. Vui lòng cập nhật giá sản phẩm trước khi bán.",
        );
        return;
      }
      if (
        Number(item.unitPrice) < priceBounds.min ||
        Number(item.unitPrice) > priceBounds.max
      ) {
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
                sales_area_id: newCustomer.sales_area_id
                  ? Number(newCustomer.sales_area_id)
                  : null,
              }
            : undefined,
        sales_area_id: !isEditing && customerMode === "existing" && salesAreaOverrideId
          ? Number(salesAreaOverrideId)
          : null,
        note: note.trim(),
        discount_amount: 0,
        promotion_id: selectedPromotion?.id || null,
        sale_source: saleSource,
        payment_due_date: paymentDueDate || null,
        items: items.flatMap((item) => {
          if (item.type === "combo" && item.comboProducts) {
            const numberOfSets = Number(item.quantity);
            return item.comboProducts.map((comboProduct) => ({
              product_id: Number(comboProduct.product_id),
              quantity: Number(comboProduct.quantity) * numberOfSets,
              unit_price: Number(comboProduct.unit_price),
            }));
          }
          return [
            {
              product_id: Number(item.productId),
              quantity: Number(item.quantity),
              unit_price: Number(item.unitPrice),
            },
          ];
        }),
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
          <AutoDismissMessage message={formSuccess} type="success" role="status" />
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
                options={warehouses.map((warehouse) => ({
                  value: warehouse.id,
                  label: warehouse.name,
                }))}
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
                  Khách hàng của đơn không thể thay đổi. Nếu chọn nhầm, hãy hủy
                  đơn này và tạo đơn mới.
                </small>
              </div>
            ) : customerMode === "existing" ? (
              <>
                <SharedSearchableDropdown
                  value={customerId}
                  placeholder="Chọn khách hàng"
                  ariaLabel="Chọn khách hàng"
                  onOpen={handleCustomerDropdownOpen}
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
                <div className="sales-customer-area">
                  <SalesAreaField
                    value={salesAreaOverrideId || selectedCustomer?.sales_area_id || ""}
                    onChange={setSalesAreaOverrideId}
                    salesAreas={salesAreas}
                    salesAreasLoading={salesAreasLoading}
                    onSalesAreaCreated={handleSalesAreaCreated}
                  />
                  <small>Khu vực chọn ở đây chỉ áp dụng cho đơn này.</small>
                </div>
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
                onSalesAreaCreated={handleSalesAreaCreated}
              />
            )}
          </div>

          <div className="sales-editor-section-heading">
            <h3>Sản phẩm và combo</h3>
            <button
              type="button"
              className="sales-editor-add"
              onClick={addItem}
            >
              + Thêm sản phẩm / combo
            </button>
          </div>
          <div className="sales-editor-items">
            {items.map((item, index) => {
              if (item.type === "combo") {
                const comboProductsList =
                  item.comboProducts
                    ?.map((cp) => `${cp.product_name} × ${cp.quantity}`)
                    .join(", ") || "";
                const totalPrice =
                  Number(item.unitPrice) * Number(item.quantity);
                const comboPriceBounds = getComboPriceBoundsFromParts(item.comboProducts || []);

                return (
                  <div
                    className="sales-editor-item sales-editor-item-combo"
                    key={`combo-${item.comboId}-${index}`}
                  >
                    <div className="sales-editor-product-field">
                      <ProductEntryField label="Sản phẩm / combo">
                        <div className="sales-combo-display">
                          <strong>
                            {item.comboName} ({item.quantity} bộ)
                          </strong>
                          <small className="sales-combo-detail">
                            Gồm: {comboProductsList}
                          </small>
                        </div>
                      </ProductEntryField>
                    </div>
                    <ProductEntryField label="Số bộ">
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={item.quantity}
                        onChange={(event) =>
                          updateItem(index, "quantity", event.target.value)
                        }
                        placeholder="Số bộ"
                        aria-label="Số bộ combo"
                        required
                      />
                    </ProductEntryField>
                    <ProductEntryField label="Tổng giá">
                      <MoneyInput
                        value={String(totalPrice)}
                        onChange={(value) => {
                          const newTotalPrice = Number(value);
                          const quantity = Number(item.quantity) || 1;
                          const newUnitPrice = newTotalPrice / quantity;
                          setItems((current) => current.map((row, rowIndex) => rowIndex === index
                            ? {
                              ...row,
                              unitPrice: String(newUnitPrice),
                              comboProducts: allocateComboPrices(row.comboProducts || [], newUnitPrice),
                            }
                            : row));
                        }}
                        label="Tổng giá"
                        minAmount={
                          comboPriceBounds?.min
                            ? comboPriceBounds.min * Number(item.quantity)
                            : 500
                        }
                        maxAmount={
                          comboPriceBounds?.max
                            ? comboPriceBounds.max * Number(item.quantity)
                            : null
                        }
                        placeholder="Nhập tổng giá"
                        aria-label="Tổng giá combo"
                        required
                      />
                      {comboPriceBounds && (
                        <small className="product-entry-range">
                          Giá 1 bộ: {formatCurrency(item.unitPrice)} • Cho phép:{" "}
                          {formatCurrency(
                            comboPriceBounds.min * Number(item.quantity),
                          )}{" "}
                          –{" "}
                          {formatCurrency(
                            comboPriceBounds.max * Number(item.quantity),
                          )}{" "}
                          (±10%)
                        </small>
                      )}
                    </ProductEntryField>
                    <button
                      type="button"
                      className="sales-editor-remove"
                      onClick={() => removeItem(index)}
                      aria-label="Xóa combo"
                    >
                      ×
                    </button>
                  </div>
                );
              }

              const searchedProducts =
                productSearchResults[index] || saleProducts;
              const selectedProduct =
                searchedProducts.find(
                  (product) => String(product.id) === String(item.productId),
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
              const comboQuery = item.productSearch.trim().toLocaleLowerCase();
              const comboOptions = comboQuery
                ? combos.filter((combo) =>
                    combo.name.toLocaleLowerCase().includes(comboQuery),
                  )
                : comboDropdownSamples[index] || [];
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
                    <ProductEntryField label="Sản phẩm / combo">
                      <SharedSearchableDropdown
                        value={item.productId}
                        placeholder="Chọn sản phẩm hoặc combo"
                        ariaLabel="Chọn sản phẩm hoặc combo"
                        onOpen={() => handleProductDropdownOpen(index)}
                        searchValue={
                          item.productSearch || selectedProduct?.name || ""
                        }
                        onSearchChange={(value) =>
                          handleProductSearchChange(index, value)
                        }
                        searching={Boolean(productSearchLoading[index] && !comboOptions.length)}
                        searchingLabel="Đang tìm sản phẩm và combo..."
                        emptyLabel="Không tìm thấy sản phẩm hoặc combo."
                        filterLocally
                        emptyAction={
                          activeUser.role === "nhân viên bán hàng" ? (
                            <ProductRequestDropdownAction
                              query={item.productSearch}
                              onRequest={(name) => {
                                setProductRequestName(name);
                                setProductRequestOpen(true);
                              }}
                            />
                          ) : null
                        }
                        onChange={(value) => handleProductSelect(index, value)}
                        disabled={applyingCombo}
                        options={[
                          { value: "", label: "Chọn sản phẩm hoặc combo" },
                          ...comboOptions.map((combo) => ({
                            value: `combo:${combo.id}`,
                            label: `Combo: ${combo.name}`,
                          })),
                          ...productOptions.map((product) => ({
                            value: product.id,
                            label: product.name,
                          })),
                        ]}
                      />
                    </ProductEntryField>
                    <ProductEntryInfo
                      product={selectedProduct}
                      stockLabel={
                        saleSource === "employee_stock"
                          ? "Tồn kho của bạn"
                          : `Số lượng còn lại ở ${
                              warehouseName === "Kho trung tâm"
                                ? "kho trung tâm"
                                : warehouseName || "kho đã chọn"
                            }`
                      }
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
                      onChange={(value) =>
                        updateItem(index, "unitPrice", value)
                      }
                      label="Giá bán"
                      minAmount={priceBounds?.min || 500}
                      maxAmount={priceBounds?.max || null}
                      placeholder="Nhập giá bán"
                      aria-label="Giá bán"
                      required
                    />
                    {selectedProduct && (
                      <small
                        className={
                          priceBounds
                            ? "product-entry-range"
                            : "product-entry-range is-invalid"
                        }
                      >
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
            <section
              className="sales-combo-suggestion"
              aria-label="Gợi ý combo"
            >
              <div className="sales-combo-suggestion-heading">
                <div>
                  <h4>Danh sách combo của sản phẩm đã chọn</h4>
                </div>
                <button
                  type="button"
                  onClick={() => setComboSuggestion(null)}
                  disabled={applyingCombo}
                >
                  Chỉ bán lẻ
                </button>
              </div>

              <div className="sales-combo-options">
                {suggestedCombos.map((combo) => (
                  <article className="sales-combo-option" key={combo.id}>
                    <div>
                      <strong>{combo.name}</strong>
                      <p>
                        {combo.items
                          .map(
                            (part) =>
                              `${part.quantity} ${part.unit} ${part.product_name}`,
                          )
                          .join(" + ")}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => applyCombo(combo)}
                      disabled={applyingCombo}
                    >
                      {applyingCombo ? "Đang kiểm tra..." : "Dùng combo"}
                    </button>
                  </article>
                ))}
              </div>
            </section>
          )}

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
              <div
                className={`sales-selected-promotion${promotionEvaluation.eligible ? "" : " is-invalid"}`}
              >
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
                  <button
                    type="button"
                    onClick={() => setPromotionPickerOpen(false)}
                  >
                    Đóng
                  </button>
                </div>
                {promotionsLoading ? (
                  <div className="sales-promotion-picker-state">
                    Đang kiểm tra điều kiện...
                  </div>
                ) : promotionOptions.length ? (
                  <div className="sales-promotion-options">
                    {promotionOptions.map((promotion) => (
                      <button
                        type="button"
                        key={promotion.id}
                        className={
                          promotion.eligible ? "is-eligible" : "is-ineligible"
                        }
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
            <label className="sales-editor-field sales-editor-debt-date">
              <span>Hạn thanh toán (nếu cho nợ)</span>
              <input
                type="date"
                aria-label="Hạn thanh toán (nếu cho nợ)"
                value={paymentDueDate}
                onChange={(event) => setPaymentDueDate(event.target.value)}
              />
            </label>
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
  const initialDebtStatus =
    !initialCancelRequestFilter &&
    ["overdue", "due_today", "due_soon"].includes(
      searchParams.get("debt_status"),
    )
      ? searchParams.get("debt_status")
      : "";
  const [invoices, setInvoices] = useState([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState("");
  const [mineOnly, setMineOnly] = useState(false);
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
  const [deliveryStaff, setDeliveryStaff] = useState([]);
  const [deliveryStaffLoading, setDeliveryStaffLoading] = useState(false);
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
  const invoiceFetchInFlightRef = useRef(null);
  const statusBoardRequestIdRef = useRef(0);
  const statusBoardInFlightRef = useRef(null);
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
  const canSubmitWarehouse = ["nhân viên bán hàng", "quản lý"].includes(
    currentUser.role,
  );
  const canRecordPayment = currentUser.role === "kế toán";
  const canCompleteSales = currentUser.role === "kế toán";

  const canApproveCancel = ["kế toán", "quản lý"].includes(currentUser.role);
  const canViewStatusBoard = currentUser.role === "quản lý";

  const canManageDueDate = canApproveCancel;

  useEffect(() => {
    if (!canManageStatus || !(selectedInvoice?.status === "đang xử lý" ||
      (currentUser.role === "quản lý" && selectedInvoice?.status === "đang giao" &&
        ["internal", null, undefined].includes(selectedInvoice?.delivery_method)))) return;
    let active = true;
    setDeliveryStaffLoading(true);
    authApis()
      .get(endpoints.deliveryStaff)
      .then((response) => {
        if (active) setDeliveryStaff(response.data?.employees || []);
      })
      .catch((requestError) => {
        if (active) setActionError(getApiError(requestError));
      })
      .finally(() => {
        if (active) setDeliveryStaffLoading(false);
      });
    return () => {
      active = false;
    };
  }, [
    canManageStatus,
    selectedInvoice?.id,
    selectedInvoice?.status,
    selectedInvoice?.delivery_method,
    currentUser.role,
    setActionError,
  ]);

  const fetchStatusBoard = useCallback(async (force = false) => {
    if (!canViewStatusBoard || (statusBoardInFlightRef.current !== null && !force)) return;
    const requestId = ++statusBoardRequestIdRef.current;
    statusBoardInFlightRef.current = requestId;
    try {
      setStatusBoardLoading(true);
      setStatusBoardError("");
      const response = await authApis().get(endpoints.salesInvoiceStatusBoard);
      if (requestId !== statusBoardRequestIdRef.current) return;
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
      if (requestId === statusBoardRequestIdRef.current) setStatusBoardError(getApiError(requestError));
    } finally {
      if (statusBoardInFlightRef.current === requestId) {
        statusBoardInFlightRef.current = null;
        setStatusBoardLoading(false);
      }
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

  const fetchInvoices = useCallback(
    async (silent = false, force = false) => {
      if (silent && !force && invoiceFetchInFlightRef.current !== null) return;
      if (!localStorage.getItem("token")) {
        navigate("/login", {
          replace: true,
          state: { message: "Vui lòng đăng nhập để xem đơn bán hàng." },
        });
        return;
      }

      const requestId = ++invoiceRequestIdRef.current;
      invoiceFetchInFlightRef.current = requestId;

      try {
        if (!silent) setLoading(true);
        if (!silent) setError("");
        const response = await authApis().get(endpoints.salesInvoices, {
          params: {
            page,
            per_page: PER_PAGE,
            keyword: keyword || undefined,
            status: status || undefined,
            mine: mineOnly ? 1 : undefined,
            from_date: fromDate || undefined,
            to_date: toDate || undefined,
            cancel_requested:
              cancelRequestFilter === "pending" ? "true" : undefined,
            debt_status: debtStatus || undefined,
            fresh: force ? 1 : undefined,
          },
        });
        if (requestId !== invoiceRequestIdRef.current) return;
        const data = response.data || {};
        setError("");
        setInvoices(data.invoices || []);
        setPagination({
          total: Number(data.total || 0),
          totalPages: Number(data.pages || 1),
        });
      } catch (requestError) {
        if (requestId === invoiceRequestIdRef.current)
          setError(getApiError(requestError));
      } finally {
        if (invoiceFetchInFlightRef.current === requestId) invoiceFetchInFlightRef.current = null;
        if (requestId === invoiceRequestIdRef.current) setLoading(false);
      }
    },
    [
      cancelRequestFilter,
      debtStatus,
      fromDate,
      keyword,
      mineOnly,
      navigate,
      page,
      status,
      toDate,
    ],
  );

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  useEffect(() => {
    const refresh = async () => {
      if (actionLoading) return;
      fetchInvoices(true, true);
      fetchStatusBoard(true);
      if (selectedInvoice?.id) {
        try {
          const response = await authApis().get(endpoints.salesInvoiceDetail(selectedInvoice.id));
          setSelectedInvoice((current) => current?.id === selectedInvoice.id ? response.data : current);
        } catch (_) { /* The list refresh still reflects the committed change. */ }
      }
    };
    window.addEventListener("sales-invoices:realtime-refresh", refresh);
    return () => window.removeEventListener("sales-invoices:realtime-refresh", refresh);
  }, [actionLoading, fetchInvoices, fetchStatusBoard, selectedInvoice?.id]);

  useEffect(() => {
    let refreshing = false;
    let ticks = 0;
    const refresh = async (force = false) => {
      if (document.visibilityState !== "visible" || refreshing || showEditor || actionLoading) return;
      ticks += 1;
      if (!force && isSalesInvoiceRealtimeConnected() && ticks % CONNECTED_POLL_EVERY_TICKS !== 0) return;
      refreshing = true;
      try {
        await Promise.all([fetchInvoices(true), fetchStatusBoard()]);
      } finally {
        refreshing = false;
      }
    };
    const timer = window.setInterval(() => refresh(), LIVE_REFRESH_INTERVAL_MS);
    const onVisibilityChange = () => refresh(true);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [actionLoading, fetchInvoices, fetchStatusBoard, showEditor]);

  useEffect(() => {
    const invoiceId = selectedInvoice?.id;
    if (!invoiceId || detailLoading || showEditor || actionLoading || confirmAction) return undefined;
    let active = true;
    let refreshing = false;
    let ticks = 0;
    const refreshDetail = async (force = false) => {
      if (!active || document.visibilityState !== "visible" || refreshing) return;
      ticks += 1;
      if (!force && isSalesInvoiceRealtimeConnected() && ticks % CONNECTED_POLL_EVERY_TICKS !== 0) return;
      refreshing = true;
      try {
        const response = await authApis().get(endpoints.salesInvoiceDetail(invoiceId));
        if (active && response.data?.id === invoiceId) {
          setSelectedInvoice((current) => current?.id === invoiceId ? response.data : current);
        }
      } catch {
        // The next refresh will retry; keep the current detail visible.
      } finally {
        refreshing = false;
      }
    };
    const timer = window.setInterval(() => refreshDetail(), LIVE_REFRESH_INTERVAL_MS);
    const onVisibilityChange = () => refreshDetail(true);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [actionLoading, confirmAction, detailLoading, selectedInvoice?.id, showEditor]);

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
      )
        return;
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

  const showUpdatedInvoiceInList = (invoice, previousStage) => {
    if (!invoice) return;
    // Discard a list request started before this successful status change.
    invoiceRequestIdRef.current += 1;
    const nextStage = invoice.workflow_stage || invoice.status;
    setInvoices((current) => current.map((row) =>
      row.id === invoice.id
        ? {
            ...row,
            status: invoice.status,
            workflow_stage: nextStage,
            cancel_requested: invoice.cancel_requested,
            warehouse_submitted_at: invoice.warehouse_submitted_at,
            current_assignee: invoice.current_assignee,
            assignment_stage: invoice.assignment_stage,
            accepted_at: invoice.accepted_at,
            accounting_handoff_at: invoice.accounting_handoff_at,
          }
        : row,
    ));
    if (previousStage && previousStage !== nextStage) {
      statusBoardRequestIdRef.current += 1;
      setStatusBoard((current) => current.map((group) => {
        if (group.status === previousStage) {
          return { ...group, total: Math.max(0, Number(group.total) - 1) };
        }
        if (group.status === nextStage) {
          return { ...group, total: Number(group.total) + 1 };
        }
        return group;
      }));
    }
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
      showUpdatedInvoiceInList(response.data?.invoice, selectedInvoice.workflow_stage || selectedInvoice.status);
      fetchInvoices(true, true);
      fetchStatusBoard(true);
      notifySalesActionCountChanged();
    } catch (requestError) {
      setActionError(getApiError(requestError));
    } finally {
      setActionLoading(false);
    }
  };

  const submitInvoiceToWarehouse = async (recipientId) => {
    if (!selectedInvoice) return;
    try {
      setActionLoading(true);
      setActionError("");
      const response = await authApis().post(
        endpoints.submitSalesInvoiceToWarehouse(selectedInvoice.id),
        { recipient_id: Number(recipientId) },
      );
      setSelectedInvoice(response.data?.invoice || selectedInvoice);
      showUpdatedInvoiceInList(response.data?.invoice, selectedInvoice.workflow_stage || selectedInvoice.status);
      fetchInvoices(true, true);
      fetchStatusBoard(true);
      notifySalesActionCountChanged();
    } catch (requestError) {
      setActionError(getApiError(requestError));
    } finally {
      setActionLoading(false);
    }
  };

  const runAssignmentAction = async (method, endpoint, data) => {
    if (!selectedInvoice) return;
    try {
      setActionLoading(true);
      setActionError("");
      const response = await authApis()[method](endpoint(selectedInvoice.id), data);
      setSelectedInvoice(response.data?.invoice || selectedInvoice);
      showUpdatedInvoiceInList(response.data?.invoice, selectedInvoice.workflow_stage || selectedInvoice.status);
      fetchInvoices(true, true);
      fetchStatusBoard(true);
      notifySalesActionCountChanged();
    } catch (requestError) {
      setActionError(getApiError(requestError));
    } finally {
      setActionLoading(false);
    }
  };

  const prepareInvoiceDelivery = async (deliveryPlan) => {
    if (!selectedInvoice) return;
    try {
      setActionLoading(true);
      setActionError("");
      const response = await authApis().put(
        endpoints.prepareSalesInvoiceDelivery(selectedInvoice.id),
        deliveryPlan,
      );
      setSelectedInvoice(response.data?.invoice || selectedInvoice);
      await fetchInvoices();
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
        {
          payment_amount: amount,
          payment_method: method,
          payment_due_date: paymentDueDate || null,
        },
      );
      notifyInventoryChanged();
      setSelectedInvoice(response.data?.invoice || selectedInvoice);
      showUpdatedInvoiceInList(response.data?.invoice, selectedInvoice.workflow_stage || selectedInvoice.status);
      fetchInvoices(true, true);
      fetchStatusBoard(true);
      notifySalesActionCountChanged();
      window.dispatchEvent(new Event("pending-requests:refresh"));
    } catch (requestError) {
      setActionError(getApiError(requestError));
    } finally {
      setActionLoading(false);
    }
  };

  const recordInvoicePayment = async (amount, paymentMethod) => {
    if (!selectedInvoice) return;
    try {
      setActionLoading(true);
      setActionError("");
      const response = await authApis().post(
        endpoints.salesInvoicePayments(selectedInvoice.id),
        {
          amount,
          payment_method: paymentMethod,
        },
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

  const loadMoreInvoicePayments = async () => {
    if (!selectedInvoice || paymentHistoryLoading) return;
    const invoiceId = selectedInvoice.id;
    try {
      setPaymentHistoryLoading(true);
      setActionError("");
      const response = await authApis().get(
        endpoints.salesInvoicePayments(invoiceId),
        {
          params: {
            page: Number(selectedInvoice.payments_page || 1) + 1,
            per_page: 20,
          },
        },
      );
      setSelectedInvoice((current) => {
        if (current?.id !== invoiceId) return current;
        const existingIds = new Set(
          (current.payments || []).map((payment) => payment.id),
        );
        return {
          ...current,
          payments: [
            ...(current.payments || []),
            ...(response.data?.payments || []).filter(
              (payment) => !existingIds.has(payment.id),
            ),
          ],
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
    if (confirmAction === "dispatch-third-party") {
      setConfirmAction(null);
      await advanceInvoiceStatus("đang giao");
      return;
    }
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
                        <strong>
                          {formatCurrency(invoice.discount?.amount)}
                        </strong>
                        <small>
                          {invoice.discount?.promotion?.name ||
                            "Điều chỉnh giá cũ"}
                        </small>
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
          {["thủ kho", "kế toán", "quản lý"].includes(currentUser.role) && (
            <label className="sales-mine-filter">
              <input type="checkbox" checked={mineOnly} onChange={(event) => { setPage(1); setMineOnly(event.target.checked); }} />
              Việc của tôi
            </label>
          )}
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
          <div
            className="sales-date-range"
            role="group"
            aria-label="Lọc theo ngày bán"
          >
            <label className="sales-date-field">
              <span>Từ ngày</span>
              <input
                className="field-alert-target"
                type="date"
                value={fromDateInput}
                onChange={(event) => setFromDateInput(event.target.value)}
                aria-label="Ngày bán từ"
                aria-invalid={Boolean(dateWarning)}
                aria-describedby={dateWarning ? "sales-date-range-alert" : undefined}
              />
            </label>
            <span className="sales-date-separator" aria-hidden="true">
              –
            </span>
            <label className="sales-date-field">
              <span>Đến ngày</span>
              <input
                className="field-alert-target"
                type="date"
                value={toDateInput}
                onChange={(event) => setToDateInput(event.target.value)}
                aria-label="Ngày bán đến"
                aria-invalid={Boolean(dateWarning)}
                aria-describedby={dateWarning ? "sales-date-range-alert" : undefined}
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
        <p className="sales-filter-context">
          Chỉ hiển thị đơn đang xử lý hoặc đang giao có yêu cầu hủy chờ duyệt.
        </p>
      )}
      {debtStatus && (
        <p className="sales-filter-context">
          Chỉ hiển thị đơn hoàn thành còn nợ có hạn thanh toán phù hợp.
        </p>
      )}

      <FieldAlert
        id="sales-date-range-alert"
        message={dateWarning}
        className="sales-date-warning"
      />
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
                    className={
                      requiresSalesInvoiceAction(invoice, currentUser)
                        ? "sales-row-needs-action"
                        : undefined
                    }
                    tabIndex="0"
                    onClick={() => openDetail(invoice.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ")
                        openDetail(invoice.id);
                    }}
                  >
                    <td>{formatDateTime(invoice.sold_at)}</td>
                    <td>
                      {invoice.sale_source === "hàng nhân viên"
                        ? "Hàng nhân viên"
                        : invoice.warehouse?.name || "—"}
                    </td>
                    <td>
                      <strong>{invoice.customer?.full_name || "—"}</strong>
                      <small>{invoice.customer?.phone || ""}</small>
                    </td>
                    <td>
                      <div className="sales-status-cell">
                        <span
                          className={`sales-status-badge ${getStatusClass(invoice.workflow_stage || invoice.status)}`}
                        >
                          {getStatusLabel(
                            invoice.workflow_stage || invoice.status,
                          )}
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
                    <td>
                      <SalesInvoiceDueCell invoice={invoice} />
                    </td>
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
            currentUserId={currentUser.id}
            canRecordPayment={canRecordPayment}
            canSubmitWarehouse={
              canSubmitWarehouse &&
              (currentUser.role === "quản lý" ||
                Number(selectedInvoice.employee?.id) === Number(currentUser.id))
            }
            isManager={currentUser.role === "quản lý"}
            deliveryStaff={deliveryStaff}
            deliveryStaffLoading={deliveryStaffLoading}
            canApproveCancel={canApproveCancel}
            canManageDueDate={canManageDueDate}
            actionLoading={actionLoading}
            actionError={actionError}
            onEdit={openEditEditor}
            onCancelDraft={handleCancelDraft}
            onCancelRequest={handleCancelRequest}
            onCancelDirect={handleCancelDirect}
            onAdvanceStatus={(nextStatus) => {
              if (
                nextStatus === "đang giao" &&
                selectedInvoice.delivery_method === "third_party"
              ) {
                setConfirmAction("dispatch-third-party");
              } else {
                advanceInvoiceStatus(nextStatus);
              }
            }}
            onComplete={completeInvoice}
            onRecordPayment={recordInvoicePayment}
            onLoadMorePayments={loadMoreInvoicePayments}
            paymentHistoryLoading={paymentHistoryLoading}
            onSubmitWarehouse={submitInvoiceToWarehouse}
            onAcceptAssignment={() => runAssignmentAction("post", endpoints.acceptSalesInvoice)}
            onReassign={(recipientId) => runAssignmentAction("put", endpoints.reassignSalesInvoice, { recipient_id: Number(recipientId) })}
            onConfirmDelivered={(data) => runAssignmentAction("post", endpoints.deliveredSalesInvoice, data)}
            onPrepareDelivery={prepareInvoiceDelivery}
            onUpdateDueDate={updatePaymentDueDate}
            onApproveCancel={(approved) =>
              setConfirmAction(approved ? "approve-cancel" : "reject-cancel")
            }
          />
        ))}
      <ConfirmDialog
        open={Boolean(confirmAction)}
        title={
          confirmAction === "dispatch-third-party"
            ? "Bàn giao cho dịch vụ vận chuyển?"
            : confirmAction === "cancel-draft"
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
          confirmAction === "dispatch-third-party"
            ? `Đơn #${selectedInvoice?.id || ""} sẽ chuyển sang Đang giao. Phí ${formatCurrency(selectedInvoice?.shipping_fee)} sẽ được trừ từ quỹ ${selectedInvoice?.shipping_fund_method === "cash" ? "tiền mặt" : "chuyển khoản"}.`
            : confirmAction === "cancel-draft"
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
          confirmAction === "dispatch-third-party"
            ? "Xác nhận bàn giao"
            : confirmAction === "cancel-draft"
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
        danger={!isCancelApproval && confirmAction !== "dispatch-third-party"}
        loading={actionLoading}
        onConfirm={executeConfirmedAction}
        onCancel={() => setConfirmAction(null)}
      />
      <ConfirmDialog
        open={Boolean(discountConfirm)}
        title={
          discountConfirm?.approved
            ? "Duyệt khuyến mãi?"
            : "Từ chối khuyến mãi?"
        }
        message={
          discountActionError ||
          (discountConfirm
            ? `${discountConfirm.approved ? "Duyệt" : "Từ chối"} khuyến mãi ${discountConfirm.invoice.discount?.promotion?.name || "đã chọn"} với mức giảm ${formatCurrency(discountConfirm.invoice.discount?.amount)} cho đơn hàng #${discountConfirm.invoice.id}?`
            : "")
        }
        confirmLabel={
          discountConfirm?.approved ? "Duyệt khuyến mãi" : "Từ chối"
        }
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
