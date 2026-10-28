import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { authApis, endpoints } from "../../configs/Apis";
import { getApiError } from "../../utils/apiError";
import useNotificationState from "../../utils/useNotificationState";
import { digitsOnly, formatMoneyInput } from "../../utils/money";
import AutoDismissMessage from "../../components/AutoDismissMessage";
import MoneyInput from "../../components/MoneyInput";
import Pagination from "../../components/Pagination";
import Skeleton from "../../components/Skeleton";
import "../../css/Customers.css";

const PER_PAGE = 10;

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

function getSaleSourceLabel(value) {
  const source = String(value || "").toLowerCase();
  if (source === "employee_stock" || source.includes("hàng nhân viên")) {
    return "Hàng nhân viên đi tỉnh";
  }
  if (source === "central_warehouse" || source.includes("kho trung tâm")) {
    return "Kho trung tâm";
  }
  return value || "Chưa xác định";
}

function getStatusClass(status) {
  const value = String(status || "").toLowerCase();
  if (value.includes("nháp") || value === "draft") return "customer-status-draft";
  if (value.includes("xử lý") || value === "processing") return "customer-status-processing";
  if (value.includes("giao") || value === "delivering") return "customer-status-delivering";
  if (value.includes("hoàn thành") || value === "completed") return "customer-status-completed";
  if (value.includes("hủy") || value === "cancelled") return "customer-status-cancelled";
  return "customer-status-default";
}

function CustomerEditModal({ customer, onClose, onSaved }) {
  const [fullName, setFullName] = useState(customer.full_name || "");
  const [phone, setPhone] = useState(customer.phone || "");
  const [address, setAddress] = useState(customer.address || "");
  const [salesAreaId, setSalesAreaId] = useState(String(customer.sales_area_id || ""));
  const [salesAreas, setSalesAreas] = useState([]);
  const [debtAmount, setDebtAmount] = useState(
    String(Math.round(Number(customer.debt_amount || 0))),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useNotificationState();

  useEffect(() => {
    authApis().get(endpoints.salesAreas)
      .then((response) => setSalesAreas(response.data?.sales_areas || []))
      .catch(() => setSalesAreas([]));
  }, []);

  const nextDebt = Number(digitsOnly(debtAmount) || 0);
  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (!fullName.trim() || !phone.trim() || !address.trim()) {
      setError("Vui lòng nhập đầy đủ họ tên, số điện thoại và địa chỉ.");
      return;
    }
    try {
      setSaving(true);
      const response = await authApis().put(endpoints.customerUpdate(customer.id), {
        full_name: fullName.trim(),
        phone: phone.trim(),
        address: address.trim(),
        sales_area_id: salesAreaId ? Number(salesAreaId) : null,
        debt_amount: nextDebt,
      });
      onSaved(response.data?.customer);
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="customer-modal-overlay">
      <form className="customer-modal customer-edit-modal" onSubmit={submit} onClick={(event) => event.stopPropagation()}>
        <div className="customer-modal-header">
          <h2>Chỉnh sửa thông tin khách hàng</h2>
          <button type="button" className="customer-modal-close" onClick={onClose} disabled={saving} aria-label="Đóng">×</button>
        </div>
        <div className="customer-modal-body">
          <p className="customer-edit-help">Thông tin khách hàng sẽ được cập nhật sau khi lưu thành công.</p>
          <AutoDismissMessage message={error} className="customers-alert" />
          <label className="customer-edit-field"><span>Họ và tên</span><input value={fullName} onChange={(event) => setFullName(event.target.value)} maxLength={150} required /></label>
          <label className="customer-edit-field"><span>Số điện thoại</span><input value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" maxLength={20} required /></label>
          <label className="customer-edit-field"><span>Địa chỉ</span><textarea value={address} onChange={(event) => setAddress(event.target.value)} rows="3" required /></label>
          <label className="customer-edit-field"><span>Khu vực bán hàng</span><select value={salesAreaId} onChange={(event) => setSalesAreaId(event.target.value)}><option value="">Chọn khu vực</option>{salesAreas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}</select></label>
          <label className="customer-edit-field">
            <span>Công nợ</span>
            <MoneyInput
              value={debtAmount}
              onChange={setDebtAmount}
              label="Công nợ"
              allowZero
              required
            />
          </label>
          <div className="customer-edit-actions">
            <button type="button" onClick={onClose} disabled={saving}>Hủy</button>
            <button type="submit" disabled={saving}>{saving ? "Đang lưu..." : "Lưu thay đổi"}</button>
          </div>
        </div>
      </form>
    </div>,
    document.body,
  );
}

function Customers() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [debtMinInput, setDebtMinInput] = useState("");
  const [debtMin, setDebtMin] = useState("");
  const [debtMaxInput, setDebtMaxInput] = useState("");
  const [debtMax, setDebtMax] = useState("");
  const [hasDebt, setHasDebt] = useState(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const [customerSummary, setCustomerSummary] = useState({
    total_customers: 0,
    total_collected: 0,
    total_sales: 0,
    total_debt: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useNotificationState();
  const [showDetail, setShowDetail] = useState(false);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useNotificationState();
  const [detailTab, setDetailTab] = useState("overview");
  const [orders, setOrders] = useState([]);
  const [ordersPagination, setOrdersPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useNotificationState();
  const [ordersCustomerId, setOrdersCustomerId] = useState(null);
  const [ordersLoadedPage, setOrdersLoadedPage] = useState(null);
  const [orderPage, setOrderPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderDetailLoading, setOrderDetailLoading] = useState(false);
  const [orderDetailError, setOrderDetailError] = useNotificationState();
  const [purchasedProducts, setPurchasedProducts] = useState([]);
  const [productsSummary, setProductsSummary] = useState(null);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useNotificationState();
  const [productsCustomerId, setProductsCustomerId] = useState(null);
  const [productsLoadedPage, setProductsLoadedPage] = useState(null);
  const [productsPage, setProductsPage] = useState(1);
  const [productsPagination, setProductsPagination] = useState({ total: 0, totalPages: 1 });
  const [paymentsPage, setPaymentsPage] = useState(1);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [paymentError, setPaymentError] = useNotificationState();
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const debounceTimerRef = useRef(null);
  const currentUser = (() => {
    try {
      return JSON.parse(localStorage.getItem("user")) || {};
    } catch {
      return {};
    }
  })();
  const canReceivePayment = ["kế toán", "quản lý"].includes(currentUser.role);
  const canViewCustomerFinancial = ["kế toán", "quản lý"].includes(currentUser.role);
  const canEditCustomer = currentUser.role === "quản lý";

  const fetchCustomers = useCallback(async () => {
    if (!localStorage.getItem("token")) {
      navigate("/login", {
        replace: true,
        state: { message: "Vui lòng đăng nhập để xem danh sách khách hàng." },
      });
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await authApis().get(endpoints.customers, {
        params: {
          page,
          per_page: PER_PAGE,
          keyword: keyword || undefined,
          has_debt: hasDebt ? true : undefined,
          debt_min: debtMin || undefined,
          debt_max: debtMax || undefined,
        },
      });

      const data = response.data || {};
      const responsePagination = data.pagination || {};
      setCustomers(data.customers || []);
      setPagination({
        total: Number(responsePagination.total || 0),
        totalPages: Number(responsePagination.total_pages || 1),
      });
      setCustomerSummary({
        total_customers: Number(data.summary?.total_customers || 0),
        total_collected: Number(data.summary?.total_collected || 0),
        total_sales: Number(data.summary?.total_sales || 0),
        total_debt: Number(data.summary?.total_debt || 0),
      });
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setLoading(false);
    }
  }, [debtMax, debtMin, hasDebt, keyword, navigate, page]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      const value = keywordInput.trim();

      if (value === keyword) return;

      setPage(1);
      setKeyword(value);
    }, 500);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [keywordInput, keyword]);

  const handleSearch = (event) => {
    event.preventDefault();
    const nextDebtMin = digitsOnly(debtMinInput);
    const nextDebtMax = digitsOnly(debtMaxInput);
    if (nextDebtMin && nextDebtMax && Number(nextDebtMin) > Number(nextDebtMax)) {
      setError("Mức công nợ từ không được lớn hơn mức công nợ đến.");
      return;
    }
    setPage(1);
    setKeyword(keywordInput.trim());
    setDebtMin(nextDebtMin);
    setDebtMax(nextDebtMax);
  };

  const handleDebtFilterChange = (event) => {
    setPage(1);
    setHasDebt(event.target.checked);
  };

  const handlePageChange = (nextPage) => {
    if (nextPage < 1 || nextPage > pagination.totalPages || nextPage === page) {
      return;
    }
    setPage(nextPage);
  };

  const handleViewDetail = async (customerId) => {
    setShowDetail(true);
    setDetail(null);
    setDetailError("");
    setDetailLoading(true);
    setDetailTab("overview");
    setOrders([]);
    setOrdersPagination({ page: 1, totalPages: 1, total: 0 });
    setOrdersError("");
    setOrdersCustomerId(null);
    setOrdersLoadedPage(null);
    setOrderPage(1);
    setSelectedOrder(null);
    setOrderDetailError("");
    setPurchasedProducts([]);
    setProductsSummary(null);
    setProductsError("");
    setProductsCustomerId(null);
    setProductsLoadedPage(null);
    setProductsPage(1);
    setProductsPagination({ total: 0, totalPages: 1 });
    setPaymentsPage(1);

    try {
      const response = await authApis().get(endpoints["customer-detail"](customerId), {
        params: { payment_page: 1, payment_per_page: PER_PAGE },
      });
      setDetail(response.data);
    } catch (requestError) {
      setDetailError(getApiError(requestError));
    } finally {
      setDetailLoading(false);
    }
  };

  const customerId = detail?.customer?.id;

  useEffect(() => {
    if (!showDetail || detailTab !== "orders" || !customerId) return undefined;
    if (ordersCustomerId === customerId && ordersLoadedPage === orderPage) return undefined;

    let cancelled = false;
    const loadOrders = async () => {
      setOrdersLoading(true);
      setOrdersError("");
      try {
        const response = await authApis().get(endpoints["customer-orders"](customerId), {
          params: { page: orderPage, per_page: PER_PAGE },
        });
        if (cancelled) return;
        const data = response.data || {};
        const responsePagination = data.pagination || {};
        setOrders(data.orders || []);
        setOrdersPagination({
          page: Number(responsePagination.page || orderPage),
          totalPages: Number(responsePagination.total_pages || 1),
          total: Number(responsePagination.total || 0),
        });
        setOrdersCustomerId(customerId);
        setOrdersLoadedPage(orderPage);
      } catch (requestError) {
        if (!cancelled) setOrdersError(getApiError(requestError));
      } finally {
        if (!cancelled) setOrdersLoading(false);
      }
    };

    loadOrders();
    return () => {
      cancelled = true;
    };
  }, [customerId, detailTab, orderPage, ordersCustomerId, ordersLoadedPage, showDetail]);

  useEffect(() => {
    if (!showDetail || detailTab !== "products" || !customerId) return undefined;
    if (productsCustomerId === customerId && productsLoadedPage === productsPage) return undefined;

    let cancelled = false;
    const loadPurchasedProducts = async () => {
      setProductsLoading(true);
      setProductsError("");
      try {
        const response = await authApis().get(endpoints["customer-purchased-products"](customerId), {
          params: { page: productsPage, per_page: PER_PAGE },
        });
        if (cancelled) return;
        const data = response.data || {};
        setPurchasedProducts(data.products || []);
        setProductsSummary(data.summary || null);
        setProductsCustomerId(customerId);
        setProductsLoadedPage(productsPage);
        const responsePagination = data.pagination || {};
        setProductsPagination({
          total: Number(responsePagination.total || 0),
          totalPages: Number(responsePagination.total_pages || 1),
        });
      } catch (requestError) {
        if (!cancelled) setProductsError(getApiError(requestError));
      } finally {
        if (!cancelled) setProductsLoading(false);
      }
    };

    loadPurchasedProducts();
    return () => {
      cancelled = true;
    };
  }, [customerId, detailTab, productsCustomerId, productsLoadedPage, productsPage, showDetail]);

  const handlePaymentPageChange = async (nextPage) => {
    if (!customerId || nextPage === paymentsPage) return;
    setPaymentsLoading(true);
    try {
      const response = await authApis().get(endpoints["customer-detail"](customerId), {
        params: { payment_page: nextPage, payment_per_page: PER_PAGE },
      });
      const data = response.data || {};
      setDetail((current) => current ? {
        ...current,
        payments: data.payments || [],
        payments_pagination: data.payments_pagination || current.payments_pagination,
      } : current);
      setPaymentsPage(nextPage);
    } catch (requestError) {
      setDetailError(getApiError(requestError));
    } finally {
      setPaymentsLoading(false);
    }
  };

  const handleViewOrderDetail = async (orderId) => {
    if (!customerId) return;
    setSelectedOrder(null);
    setOrderDetailError("");
    setOrderDetailLoading(true);

    try {
      const response = await authApis().get(
        endpoints["customer-order-detail"](customerId, orderId),
      );
      setSelectedOrder(response.data?.order || null);
    } catch (requestError) {
      setOrderDetailError(getApiError(requestError));
    } finally {
      setOrderDetailLoading(false);
    }
  };

  const closeDetail = useCallback(() => {
    setShowDetail(false);
    setDetail(null);
    setDetailError("");
    setShowPaymentForm(false);
    setPaymentError("");
    setPaymentMethod("");
  }, []);

  const handleOldDebtPayment = async (event) => {
    event.preventDefault();
    if (!customerId) return;
    const amount = Number(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setPaymentError("Số tiền trả nợ phải lớn hơn 0.");
      return;
    }
    if (amount < 500) {
      setPaymentError("Số tiền trả nợ tối thiểu là 500 đ.");
      return;
    }
    if (!paymentMethod) {
      setPaymentError("Vui lòng chọn phương thức thanh toán.");
      return;
    }
    if (amount > Number(detail.customer.debt_amount || 0)) {
      setPaymentError("Số tiền trả vượt quá công nợ hiện tại.");
      return;
    }
    try {
      setPaymentSaving(true);
      setPaymentError("");
      const response = await authApis().post(endpoints.customerPayment(customerId), {
        amount,
        payment_method: paymentMethod,
        note: paymentNote.trim(),
      });
      const paymentCustomer = response.data?.customer;
      setDetail((current) => current ? {
        ...current,
        customer: { ...current.customer, debt_amount: paymentCustomer?.debt_amount_new ?? current.customer.debt_amount },
      } : current);
      setPaymentAmount("");
      setPaymentNote("");
      setPaymentMethod("");
      setShowPaymentForm(false);
      await fetchCustomers();
      window.dispatchEvent(new Event("pending-requests:refresh"));
    } catch (requestError) {
      setPaymentError(getApiError(requestError));
    } finally {
      setPaymentSaving(false);
    }
  };

  useEffect(() => {
    if (!showDetail) return undefined;

    const handleEscape = (event) => {
      if (event.key === "Escape") closeDetail();
    };

    document.addEventListener("keydown", handleEscape);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [closeDetail, showDetail]);

  return (
    <div className="customers-page">
      <div className="customers-header">
        <div>
          <h1>Danh sách khách hàng</h1>
        </div>
      </div>

      <form className="customers-toolbar" onSubmit={handleSearch}>
        <input
          type="search"
          value={keywordInput}
          onChange={(event) => setKeywordInput(event.target.value)}
          placeholder="Tìm theo tên, số điện thoại hoặc địa chỉ"
          aria-label="Tìm kiếm theo tên, số điện thoại hoặc địa chỉ"
        />
        <div className="customers-debt-range" role="group" aria-label="Lọc theo khoảng công nợ">
          <input
            type="text"
            inputMode="numeric"
            value={formatMoneyInput(debtMinInput)}
            onChange={(event) => setDebtMinInput(digitsOnly(event.target.value))}
            placeholder="Công nợ từ"
            aria-label="Công nợ từ"
          />
          <span>–</span>
          <input
            type="text"
            inputMode="numeric"
            value={formatMoneyInput(debtMaxInput)}
            onChange={(event) => setDebtMaxInput(digitsOnly(event.target.value))}
            placeholder="Công nợ đến"
            aria-label="Công nợ đến"
          />
        </div>
        <button type="submit">Tìm kiếm</button>
        <label className="customers-debt-filter">
          <input
            type="checkbox"
            checked={hasDebt}
            onChange={handleDebtFilterChange}
          />
          <span>Chỉ hiện khách còn công nợ</span>
        </label>
      </form>

      <AutoDismissMessage message={error} className="customers-alert" />

      {canViewCustomerFinancial && (
        <div className="customers-summary" aria-label="Tổng quan khách hàng">
          <div className="customers-summary-card customers-summary-card--paid">
            <span>Tổng tiền đã thu</span>
            <strong>{formatCurrency(customerSummary.total_collected)}</strong>
          </div>
          <div className="customers-summary-card customers-summary-card--debt">
            <span>Tổng công nợ hiện tại</span>
            <strong>{formatCurrency(customerSummary.total_debt)}</strong>
          </div>
        </div>
      )}

      <div className="customers-card">
        <div className="customers-table-meta">
          <span>Tổng số khách hàng</span>
          <strong>{customerSummary.total_customers.toLocaleString("vi-VN")}</strong>
        </div>
        {loading ? (
          <Skeleton rows={6} columns={6} />
        ) : customers.length === 0 ? (
          <div className="customers-state">Không có khách hàng phù hợp.</div>
        ) : (
          <div className="customers-table-wrapper">
            <table className="customers-table">
              <thead>
                <tr>
                  <th>Họ và tên</th>
                  <th>Số điện thoại</th>
                  <th>Địa chỉ</th>
                  {canViewCustomerFinancial && (
                    <>
                      <th className="customers-money">Tổng đã mua</th>
                      <th className="customers-money">Đã thanh toán</th>
                      <th className="customers-money">Công nợ</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr
                    key={customer.id}
                    className="customers-row-clickable"
                    tabIndex={0}
                    onClick={() => handleViewDetail(customer.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        handleViewDetail(customer.id);
                      }
                    }}
                  >
                    <td className="customers-name">{customer.full_name}</td>
                    <td>{customer.phone}</td>
                    <td>{customer.address}</td>
                    {canViewCustomerFinancial && (
                      <>
                        <td className="customers-money">{formatCurrency(customer.total_sales_amount)}</td>
                        <td className="customers-money">{formatCurrency(customer.total_paid_amount)}</td>
                        <td className="customers-money">{formatCurrency(customer.debt_amount)}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Pagination page={page} totalPages={pagination.totalPages} onPageChange={handlePageChange} disabled={loading} />

      {showDetail && createPortal(
        <div className="customer-modal-overlay">
          <section
            className="customer-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="customer-detail-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="customer-modal-header">
              <h2 id="customer-detail-title">Chi tiết khách hàng</h2>
              <button type="button" className="customer-modal-close" onClick={closeDetail} aria-label="Đóng">
                ×
              </button>
            </div>

            <div className="customer-modal-body">
              {detailLoading ? (
                <Skeleton variant="form" rows={4} className="customer-modal-skeleton" />
              ) : detailError ? (
                <AutoDismissMessage message={detailError} className="customers-alert" />
              ) : detail?.customer ? (
                <>
                  <div className="customer-detail-summary">
                    <div className="customer-detail-avatar">
                      {detail.customer.full_name?.charAt(0)?.toUpperCase()}
                    </div>
                    <div>
                      <h3>{detail.customer.full_name}</h3>
                      <p>Mã khách hàng: #{detail.customer.id}</p>
                    </div>
                    {canEditCustomer && (
                      <button type="button" className="customer-edit-trigger" onClick={() => setEditingCustomer(detail.customer)}>
                        Chỉnh sửa
                      </button>
                    )}
                  </div>

                  <div className="customer-detail-tabs" role="tablist" aria-label="Thông tin mua hàng">
                    <button
                      type="button"
                      className={detailTab === "overview" ? "is-active" : ""}
                      onClick={() => setDetailTab("overview")}
                    >
                      Tổng quan
                    </button>
                    <button
                      type="button"
                      className={detailTab === "orders" ? "is-active" : ""}
                      onClick={() => setDetailTab("orders")}
                    >
                      Lịch sử đơn hàng
                    </button>
                    <button
                      type="button"
                      className={detailTab === "products" ? "is-active" : ""}
                      onClick={() => setDetailTab("products")}
                    >
                      Sản phẩm đã mua
                    </button>
                  </div>

                  {detailTab === "overview" && (
                    <>
                  <div className="customer-detail-info">
                    <div>
                      <span>Số điện thoại</span>
                      <strong>{detail.customer.phone}</strong>
                    </div>
                    <div>
                      <span>Địa chỉ</span>
                      <strong>{detail.customer.address}</strong>
                    </div>
                    {canViewCustomerFinancial && (
                      <div>
                        <span>Công nợ hiện tại</span>
                        <strong>{formatCurrency(detail.customer.debt_amount)}</strong>
                      </div>
                    )}
                  </div>

                  <div className="customer-detail-stats">
                    <div>
                      <span>Tổng đơn hàng</span>
                      <strong>{detail.statistics?.total_orders || 0}</strong>
                    </div>
                    <div>
                      <span>Đơn hoàn thành</span>
                      <strong>{detail.statistics?.total_completed_orders || 0}</strong>
                    </div>
                    {canViewCustomerFinancial && (
                      <>
                        <div>
                          <span>Tổng đã mua</span>
                          <strong>{formatCurrency(detail.statistics?.total_spent)}</strong>
                        </div>
                        <div>
                          <span>Đã mua năm {detail.statistics?.current_year || new Date().getFullYear()}</span>
                          <strong>{formatCurrency(detail.statistics?.total_spent_current_year)}</strong>
                        </div>
                      </>
                    )}
                  </div>
                  {canReceivePayment && Number(detail.customer.debt_amount || 0) > 0 && (
                    <div className="customer-payment-section">
                      {!showPaymentForm ? (
                        <button type="button" className="customer-payment-button" onClick={() => setShowPaymentForm(true)}>
                          Ghi nhận khách trả nợ cũ
                        </button>
                      ) : (
                        <form className="customer-payment-form" onSubmit={handleOldDebtPayment}>
                          <h4>Ghi nhận trả nợ cũ</h4>
                          <AutoDismissMessage message={paymentError} className="customers-alert" />
                          <MoneyInput
                            value={paymentAmount}
                            onChange={setPaymentAmount}
                            label="Số tiền khách trả"
                            placeholder="Từ 500 đ"
                            required
                          />
                          <select
                            value={paymentMethod}
                            onChange={(event) => setPaymentMethod(event.target.value)}
                            required
                          >
                            <option value="">{"Chọn phương thức thanh toán"}</option>
                            <option value="cash">{"Tiền mặt"}</option>
                            <option value="bank_transfer">{"Chuyển khoản"}</option>
                          </select>
                          <input
                            value={paymentNote}
                            onChange={(event) => setPaymentNote(event.target.value)}
                            placeholder="Ghi chú (không bắt buộc)"
                          />
                          <div className="customer-payment-actions">
                            <button type="button" onClick={() => { setShowPaymentForm(false); setPaymentError(""); setPaymentMethod(""); }} disabled={paymentSaving}>Hủy</button>
                            <button type="submit" disabled={paymentSaving}>{paymentSaving ? "Đang lưu..." : "Lưu thanh toán"}</button>
                          </div>
                        </form>
                      )}
                    </div>
                  )}
                  {detail.payments?.length > 0 && (
                    <div className="customer-payment-history">
                      <h4>Lịch sử thanh toán</h4>
                      {detail.payments.map((payment) => (
                        <div className="customer-payment-history-item" key={payment.id}>
                          <div>
                            <strong>
                              {formatCurrency(payment.amount)} · {payment.payment_type} · {
                                payment.payment_method === "cash"
                                  ? "Tiền mặt"
                                  : payment.payment_method === "bank_transfer"
                                    ? "Chuyển khoản"
                                    : "Chưa xác định"
                              }
                            </strong>
                            <span>{payment.note || "Không có ghi chú"}</span>
                          </div>
                          <small>
                            {payment.employee?.full_name || "—"} · {formatDateTime(payment.paid_at)}
                          </small>
                        </div>
                      ))}
                      <Pagination
                        page={Number(detail.payments_pagination?.page || paymentsPage)}
                        totalPages={Number(detail.payments_pagination?.total_pages || 1)}
                        onPageChange={handlePaymentPageChange}
                        disabled={paymentsLoading}
                      />
                    </div>
                  )}
                    </>
                  )}

                  {detailTab === "orders" && (
                    <div className="customer-history-panel">
                      {selectedOrder || orderDetailLoading || orderDetailError ? (
                        <div className="customer-order-detail">
                          <button type="button" className="customer-back-button" onClick={() => setSelectedOrder(null)} aria-label="Quay lại danh sách đơn hàng">
                            ‹
                          </button>
                          {orderDetailLoading ? (
                            <Skeleton rows={4} columns={5} className="customer-history-skeleton" />
                          ) : orderDetailError ? (
                            <AutoDismissMessage message={orderDetailError} className="customers-alert" />
                          ) : (
                            <>
                              <div className="customer-order-heading">
                                <div>
                                  <h3>Đơn hàng #{selectedOrder.id}</h3>
                                  <p>
                                    {formatDateTime(selectedOrder.sold_at)}
                                    <span className={`customer-order-status customer-status-badge ${getStatusClass(selectedOrder.status)}`}>Trạng thái: {selectedOrder.status}</span>
                                  </p>
                                </div>
                              </div>
                              <div className="customer-order-meta">
                                <div><span>Người tạo đơn</span><strong>{selectedOrder.employee?.full_name}</strong></div>
                                <div><span>Nguồn hàng</span><strong>{getSaleSourceLabel(selectedOrder.sale_source)}</strong></div>
                                <div><span>Ghi chú</span><strong>{selectedOrder.note || "—"}</strong></div>
                              </div>
                              <div className="customer-order-items">
                                <div className="customer-history-table-wrap">
                                  <table className="customer-history-table">
                                    <thead><tr><th>Sản phẩm</th><th>SL</th><th>Đơn giá</th><th>Thành tiền</th></tr></thead>
                                    <tbody>
                                      {(selectedOrder.items || []).map((item) => (
                                        <tr key={item.id}>
                                          <td>{item.product_name}</td>
                                          <td>{item.quantity} {item.unit}</td>
                                          <td>{formatCurrency(item.unit_price)}</td>
                                          <td>{formatCurrency(item.total)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                                <div className="customer-order-total">
                                  <span>Tiền hàng: {formatCurrency(selectedOrder.total_amount)}</span>
                                  {Number(selectedOrder.discount_amount || 0) > 0 && (
                                    <span>
                                      Khuyến mãi{selectedOrder.promotion?.name ? ` (${selectedOrder.promotion.name})` : ""}: {formatCurrency(selectedOrder.discount_amount)}
                                    </span>
                                  )}
                                  <strong>Tổng tiền đơn: {formatCurrency(selectedOrder.final_amount ?? selectedOrder.total_amount)}</strong>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      ) : (
                        <>
                          <div className="customer-history-heading">
                            <strong>Lịch sử đơn hàng</strong>
                            <span>{ordersPagination.total} đơn hàng</span>
                          </div>
                          {ordersLoading ? (
                            <Skeleton rows={4} columns={5} className="customer-history-skeleton" />
                          ) : ordersError ? (
                            <AutoDismissMessage message={ordersError} className="customers-alert" />
                          ) : orders.length === 0 ? (
                            <div className="customer-modal-state">Khách hàng chưa có đơn hàng.</div>
                          ) : (
                            <>
                              <div className="customer-history-table-wrap">
                                <table className="customer-history-table customer-orders-table">
                                  <thead><tr><th>Mã đơn</th><th>Ngày bán</th><th>Trạng thái</th><th>Số sản phẩm</th><th className="customers-money">Tổng tiền</th></tr></thead>
                                  <tbody>
                                    {orders.map((order) => (
                                      <tr key={order.id} tabIndex={0} onClick={() => handleViewOrderDetail(order.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); handleViewOrderDetail(order.id); } }}>
                                        <td className="customers-name">#{order.id}</td>
                                        <td>{formatDateTime(order.sold_at)}</td>
                                        <td><span className={`customer-status-badge ${getStatusClass(order.status)}`}>{order.status}</span></td>
                                        <td>{order.items_count}</td>
                                        <td className="customers-money">{formatCurrency(order.final_amount ?? order.total_amount)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                              <Pagination page={orderPage} totalPages={ordersPagination.totalPages} onPageChange={setOrderPage} disabled={ordersLoading} />
                            </>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {detailTab === "products" && (
                    <div className="customer-history-panel">
                      {productsLoading ? (
                        <Skeleton rows={4} columns={4} className="customer-history-skeleton" />
                      ) : productsError ? (
                        <AutoDismissMessage message={productsError} className="customers-alert" />
                      ) : purchasedProducts.length === 0 ? (
                        <div className="customer-modal-state">Khách hàng chưa mua sản phẩm nào.</div>
                      ) : (
                        <>
                          <div className="customer-history-heading">
                            <strong>Sản phẩm đã mua</strong>
                            <span>{productsSummary?.total_products || purchasedProducts.length} sản phẩm</span>
                          </div>
                          <div className="customer-history-table-wrap">
                            <table className="customer-history-table">
                              <thead><tr><th>Sản phẩm</th><th>Đơn vị</th><th>Tổng số lượng</th><th>Lần mua gần nhất</th><th className="customers-money">Tổng tiền</th></tr></thead>
                              <tbody>
                                {purchasedProducts.map((product) => (
                                  <tr key={product.product_id}>
                                    <td className="customers-name">{product.product_name}</td>
                                    <td>{product.unit}</td>
                                    <td>{product.total_quantity}</td>
                                    <td>{formatDateTime(product.last_purchased)}</td>
                                    <td className="customers-money">{formatCurrency(product.total_amount)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <Pagination
                            page={productsPage}
                            totalPages={productsPagination.totalPages}
                            onPageChange={setProductsPage}
                            disabled={productsLoading}
                          />
                          <div className="customer-products-total">Tổng tiền hàng: <strong>{formatCurrency(productsSummary?.total_spent)}</strong></div>
                        </>
                      )}
                    </div>
                  )}
                </>
              ) : null}
            </div>
          </section>
        </div>,
        document.body,
      )}
      {editingCustomer && (
        <CustomerEditModal
          customer={editingCustomer}
          onClose={() => setEditingCustomer(null)}
          onSaved={(updatedCustomer) => {
            setEditingCustomer(null);
            setDetail((current) => current ? { ...current, customer: updatedCustomer || current.customer } : current);
            fetchCustomers();
          }}
        />
      )}
    </div>
  );
}

export default Customers;
