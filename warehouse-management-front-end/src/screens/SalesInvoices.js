import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useSearchParams } from "react-router-dom";
import { authApis, endpoints } from "../configs/Apis";
import { getApiError } from "../utils/apiError";
import useNotificationState from "../utils/useNotificationState";
import { notifyInventoryChanged } from "../utils/inventoryEvents";
import { digitsOnly, formatMoneyInput } from "../utils/money";
import ConfirmDialog from "../components/ConfirmDialog";
import AutoDismissMessage from "../components/AutoDismissMessage";
import ProductRequestModal from "../components/ProductRequestModal";
import SharedSearchableDropdown from "../components/SearchableDropdown";
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
  { value: "đang xử lý", label: "Đang xử lý" },
  { value: "đang giao", label: "Đang giao" },
  { value: "hoàn thành", label: "Hoàn thành" },
  { value: "đã hủy", label: "Đã hủy" },
];

const CANCEL_REQUEST_OPTIONS = [
  { value: "", label: "Tất cả yêu cầu hủy" },
  { value: "pending", label: "Chờ duyệt hủy" },
];

function formatCurrency(value) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const pad = (number) => String(number).padStart(2, "0");
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function getStatusClass(status) {
  const value = String(status || "").toLowerCase();
  if (value === "nháp" || value === "draft") return "sales-status-draft";
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
  return "Chưa thanh toán";
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

function SalesInvoiceDetail({
  invoice,
  onClose,
  canEdit,
  canCancel,
  canRequestCancel,
  canCancelDirect,
  canManageStatus,
  canApproveCancel,
  actionLoading,
  actionError,
  onEdit,
  onCancelDraft,
  onCancelRequest,
  onCancelDirect,
  onAdvanceStatus,
  onComplete,
  onApproveCancel,
}) {
  const [completionPayment, setCompletionPayment] = useState(
    String(invoice.paid_amount || ""),
  );
  const discountAmount = Number(invoice.discount?.amount || 0);
  const paidAmount = Number(invoice.paid_amount || 0);
  const remainingAmount = Number(invoice.remaining_amount || 0);
  const cancelled = isCancelledStatus(invoice.status);
  const discountPending = invoice.discount?.status === "chờ duyệt";
  const paymentMessage = cancelled
    ? "Đơn đã hủy nên không còn khoản cần thu."
    : paidAmount <= 0
      ? "Khách chưa thanh toán cho đơn này."
      : remainingAmount > 0
        ? "Khách đã thanh toán một phần; số còn lại là khoản cần thu của riêng đơn này."
        : "Đơn này đã được thanh toán đủ.";
  return createPortal(
    <div className="sales-detail-overlay" onClick={onClose}>
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
            <p className="sales-detail-created-at">
              Lập lúc {formatDateTime(invoice.sold_at)}
            </p>
          </div>
          <div className="sales-detail-header-tools">
            <strong
              className={`sales-status-badge ${getStatusClass(invoice.status)}`}
            >
              {getStatusLabel(invoice.status)}
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
            <section className="sales-detail-card">
              <h3>Thông tin đơn</h3>
              <dl>
                <div>
                  <dt>Nhân viên lập đơn</dt>
                  <dd>{invoice.employee?.full_name || "—"}</dd>
                </div>
                <div>
                  <dt>Nguồn hàng</dt>
                  <dd>
                    {invoice.sale_source === "hàng nhân viên"
                      ? "Hàng nhân viên đi tỉnh"
                      : "Kho trung tâm"}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="sales-detail-card">
              <h3>Khách hàng</h3>
              <dl>
                <div>
                  <dt>Họ và tên</dt>
                  <dd>{invoice.customer?.full_name || "—"}</dd>
                </div>
                <div>
                  <dt>Số điện thoại</dt>
                  <dd>{invoice.customer?.phone || "—"}</dd>
                </div>
                <div className="sales-detail-card-wide">
                  <dt>Địa chỉ giao hàng</dt>
                  <dd>{invoice.customer?.address || "—"}</dd>
                </div>
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
                        <td>{item.quantity}</td>
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

          <section className="sales-payment-card">
            <div className="sales-payment-header">
              <h3>Thanh toán</h3>
              <span
                className={`sales-payment-status ${
                  cancelled
                    ? "is-cancelled"
                    : getPaymentStatusClass(invoice.payment_status)
                }`}
              >
                {cancelled
                  ? "Không cần thanh toán"
                  : getPaymentStatusLabel(invoice.payment_status)}
              </span>
              {invoice.discount?.promotion && (
                <div className="sales-payment-promotion">
                  <strong>{invoice.discount.promotion.name}</strong>
                  <small>{invoice.discount.promotion.condition_summary}</small>
                  <small>{invoice.discount.promotion.benefit_summary}</small>
                </div>
              )}
            </div>
            <div className="sales-payment-breakdown">
              <div>
                <span>Tiền hàng</span>
                <strong>{formatCurrency(invoice.total_amount)}</strong>
              </div>
              {discountAmount > 0 && (
                <div>
                  <span>
                    Khuyến mãi{discountPending ? " (chờ duyệt)" : ""}
                  </span>
                  <strong>-{formatCurrency(discountAmount)}</strong>
                </div>
              )}
              <div className="sales-payment-total">
                <span>
                  {cancelled ? "Giá trị đơn trước khi hủy" : "Tổng tiền đơn"}
                </span>
                <strong>{formatCurrency(invoice.final_amount)}</strong>
              </div>
              {!cancelled && paidAmount > 0 && (
                <div>
                  <span>Khách đã trả</span>
                  <strong>{formatCurrency(paidAmount)}</strong>
                </div>
              )}
              {!cancelled && remainingAmount > 0 && (
                <div className="sales-payment-remaining">
                  <span>Còn phải thu</span>
                  <strong>{formatCurrency(remainingAmount)}</strong>
                </div>
              )}
            </div>
            <p className="sales-payment-help">{paymentMessage}</p>
          </section>
          {invoice.cancel_note && (
            <div className="sales-detail-cancel-note">
              <span>Lý do hủy</span>
              <p>{invoice.cancel_note}</p>
            </div>
          )}
          {invoice.note && (
            <div className="sales-detail-note">
              <span>Ghi chú</span>
              <p>{invoice.note}</p>
            </div>
          )}
          {(canEdit || canCancel || canApproveCancel) && (
            <div className="sales-detail-actions">
              {canEdit && invoice.status === "nháp" && (
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
          {canManageStatus && invoice.status === "nháp" && (
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
          {canManageStatus && invoice.status === "đang giao" && (
            <div className="sales-detail-actions sales-complete-actions">
              <input
                type="text"
                inputMode="numeric"
                value={formatMoneyInput(completionPayment)}
                onChange={(event) =>
                  setCompletionPayment(digitsOnly(event.target.value))
                }
                placeholder="Khách thanh toán"
                aria-label="Số tiền khách thanh toán"
              />
              <button
                type="button"
                onClick={() => onComplete(Number(completionPayment) || 0)}
                disabled={actionLoading}
              >
                Hoàn thành đơn
              </button>
            </div>
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

function SalesInvoiceEditor({ invoice, onClose, onSaved }) {
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
  const [employeeStock, setEmployeeStock] = useState([]);
  const [employeeStockLoading, setEmployeeStockLoading] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(
    String(invoice?.paid_amount || ""),
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
  const customerSearchTimerRef = useRef(null);
  const customerSearchTouchedRef = useRef(false);
  const productSearchTimerRefs = useRef({});
  const productSearchRequestRefs = useRef({});

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
          ? { ...item, productId: "", productSearch: value, unitPrice: "" }
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
            params: { page: 1, per_page: 100, keyword: keyword || undefined },
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
          unitPrice: selectedProduct
            ? String(selectedProduct.default_sale_price)
            : item.unitPrice,
        };
      }),
    );
  };

  const addItem = () => {
    setItems((current) => [
      ...current,
      { productId: "", productSearch: "", quantity: "1", unitPrice: "" },
    ]);
  };

  const handleSaleSourceChange = (value) => {
    setSaleSource(String(value));
    setItems([
      { productId: "", productSearch: "", quantity: "1", unitPrice: "" },
    ]);
    setProductSearchResults({});
    setProductSearchLoading({});
    setPaymentAmount("");
  };

  const removeItem = (index) => {
    setItems((current) =>
      current.filter((_, itemIndex) => itemIndex !== index),
    );
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError("");
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
    const enteredPayment = Number(paymentAmount) || 0;
    const finalAmount = subtotal - discount;
    if (
      saleSource === "employee_stock" &&
      (enteredPayment < 0 || enteredPayment > finalAmount)
    ) {
      setFormError(
        "Số tiền khách thanh toán không được lớn hơn tổng tiền đơn.",
      );
      return;
    }

    try {
      setSaving(true);
      const payload = {
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
        payment_amount: saleSource === "employee_stock" ? enteredPayment : 0,
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
    <div className="sales-editor-overlay" onClick={onClose}>
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
                        label: "Xuất từ kho trung tâm",
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
                        : "Đơn sẽ hoàn thành ngay sau khi lưu và trừ vào tồn hàng của bạn."}
                    </small>
                  )}
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
                  <div className="sales-new-customer-fields">
                    <input
                      value={newCustomer.full_name}
                      onChange={(event) =>
                        setNewCustomer((current) => ({
                          ...current,
                          full_name: event.target.value,
                        }))
                      }
                      placeholder="Họ và tên"
                    />
                    <input
                      value={newCustomer.phone}
                      onChange={(event) =>
                        setNewCustomer((current) => ({
                          ...current,
                          phone: event.target.value,
                        }))
                      }
                      placeholder="Số điện thoại"
                    />
                    <input
                      value={newCustomer.address}
                      onChange={(event) =>
                        setNewCustomer((current) => ({
                          ...current,
                          address: event.target.value,
                        }))
                      }
                      placeholder="Địa chỉ"
                    />
                    <select
                      value={newCustomer.sales_area_id}
                      disabled={salesAreasLoading}
                      onChange={(event) =>
                        setNewCustomer((current) => ({
                          ...current,
                          sales_area_id: event.target.value,
                        }))
                      }
                    >
                      <option value="">
                        {salesAreasLoading
                          ? "Đang tải khu vực bán hàng..."
                          : "Chọn khu vực bán hàng"}
                      </option>
                      {salesAreas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
                    </select>
                  </div>
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
                  return (
                    <div
                      className="sales-editor-item"
                      key={`${item.productId || "new"}-${index}`}
                    >
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
                        onChange={(value) =>
                          updateItem(index, "productId", String(value))
                        }
                        options={[
                          { value: "", label: "Chọn sản phẩm" },
                          ...productOptions.map((product) => ({
                            value: product.id,
                            label: product.name,
                          })),
                        ]}
                      />
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={item.quantity}
                        onChange={(event) =>
                          updateItem(index, "quantity", event.target.value)
                        }
                        placeholder="Số lượng"
                        aria-label="Số lượng"
                        required
                      />
                      <input
                        type="text"
                        inputMode="numeric"
                        value={formatMoneyInput(item.unitPrice)}
                        onChange={(event) =>
                          updateItem(
                            index,
                            "unitPrice",
                            digitsOnly(event.target.value),
                          )
                        }
                        placeholder="Giá bán"
                        aria-label="Giá bán"
                        required
                      />
                      <button
                        type="button"
                        className="sales-editor-remove"
                        onClick={() => removeItem(index)}
                        aria-label="Xóa sản phẩm"
                      >
                        ×
                      </button>
                      {selectedProduct?.available_stock != null && (
                        <small>
                          Tồn hiện tại: {selectedProduct.available_stock}{" "}
                          {selectedProduct.unit}
                        </small>
                      )}
                    </div>
                  );
                })}
              </div>

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
                  <label className="sales-editor-field">
                    <span>Khách thanh toán</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formatMoneyInput(paymentAmount)}
                      onChange={(event) =>
                        setPaymentAmount(digitsOnly(event.target.value))
                      }
                      placeholder="0"
                    />
                  </label>
                )}
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
                <div className="sales-editor-total">
                  <span>Tổng tiền đơn</span>
                  <strong>
                    {formatCurrency(Math.max(0, subtotal - discount))}
                  </strong>
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
  const [invoices, setInvoices] = useState([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState("");
  const [cancelRequestFilter, setCancelRequestFilter] = useState(
    initialCancelRequestFilter,
  );
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

  const canApproveCancel = ["kế toán", "quản lý"].includes(currentUser.role);
  const canViewStatusBoard = currentUser.role === "quản lý";

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

  const fetchInvoices = useCallback(async () => {
    if (!localStorage.getItem("token")) {
      navigate("/login", {
        replace: true,
        state: { message: "Vui lòng đăng nhập để xem đơn bán hàng." },
      });
      return;
    }

    try {
      setLoading(true);
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
        },
      });
      const data = response.data || {};
      setInvoices(data.invoices || []);
      setPagination({
        total: Number(data.total || 0),
        totalPages: Number(data.pages || 1),
      });
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setLoading(false);
    }
  }, [cancelRequestFilter, fromDate, keyword, navigate, page, status, toDate]);

  useEffect(() => {
    fetchInvoices();
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
    setShowEditor(false);
    setEditingInvoice(null);
    setSelectedInvoice(invoice || null);
    fetchInvoices();
    fetchStatusBoard();
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
    } catch (requestError) {
      setActionError(getApiError(requestError));
    } finally {
      setActionLoading(false);
    }
  };

  const completeInvoice = async (paymentAmount) => {
    if (!selectedInvoice) return;
    try {
      setActionLoading(true);
      setActionError("");
      const response = await authApis().put(
        endpoints.completeSalesInvoice(selectedInvoice.id),
        { payment_amount: paymentAmount },
      );
      notifyInventoryChanged();
      setSelectedInvoice(response.data?.invoice || selectedInvoice);
      await fetchInvoices();
      await fetchStatusBoard();
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
            }}
            ariaLabel="Lọc theo trạng thái đơn hàng"
          />
        </div>
        <div className="sales-cancel-dropdown">
          <SharedSearchableDropdown
            value={cancelRequestFilter}
            options={CANCEL_REQUEST_OPTIONS}
            placeholder="Tất cả yêu cầu hủy"
            onChange={(value) => {
              setPage(1);
              setCancelRequestFilter(String(value));
            }}
            ariaLabel="Lọc theo yêu cầu hủy đơn"
          />
        </div>
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
      </form>

      <AutoDismissMessage message={dateWarning} type="warning" className="sales-date-warning" />
      <AutoDismissMessage message={error} className="sales-alert" />
      <div className="sales-card">
        {loading ? (
          <Skeleton rows={7} columns={5} />
        ) : invoices.length === 0 ? (
          <div className="sales-state">Không có đơn hàng phù hợp.</div>
        ) : (
          <div className="sales-table-wrap">
            <table className="sales-table">
              <thead>
                <tr>
                  <th>Ngày bán</th>
                  <th>Khách hàng</th>
                  <th>Trạng thái</th>
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
                    <td>{formatDateTime(invoice.sold_at)}</td>
                    <td>
                      <strong>{invoice.customer?.full_name || "—"}</strong>
                      <small>{invoice.customer?.phone || ""}</small>
                    </td>
                    <td>
                      <div className="sales-status-cell">
                        <span
                          className={`sales-status-badge ${getStatusClass(invoice.status)}`}
                        >
                          {getStatusLabel(invoice.status)}
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
            <div className="sales-detail-overlay" onClick={closeDetail}>
              <div
                className="sales-detail-modal"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="sales-state">{detailError}</div>
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
            canApproveCancel={canApproveCancel}
            actionLoading={actionLoading}
            actionError={actionError}
            onEdit={openEditEditor}
            onCancelDraft={handleCancelDraft}
            onCancelRequest={handleCancelRequest}
            onCancelDirect={handleCancelDirect}
            onAdvanceStatus={advanceInvoiceStatus}
            onComplete={completeInvoice}
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
