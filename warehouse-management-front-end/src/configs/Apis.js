import axios from "axios";

const baseURL = process.env.REACT_APP_API_URL || "http://localhost:5000/api";

export const endpoints = {
  register: "/auth/register",
  login: "/auth/login",
  refresh: "/auth/refresh",
  logout: "/auth/logout",
  forgotPasswordRequest: "/auth/forgot-password/request",
  forgotPasswordVerify: "/auth/forgot-password/verify",
  forgotPasswordReset: "/auth/forgot-password/reset",
  customers: "/customers",
  products: "/products",
  productDetail: (productId) => `/products/${productId}`,
  productsInventory: "/products/inventory",
  productRequests: "/products/requests",
  priceListExport: "/products/price-list/export",
  salesInvoices: "/sales-invoices",
  salesInvoiceStatusBoard: "/sales-invoices/status-board",
  pendingDiscountInvoices: "/sales-invoices/pending-discount",
  approveSalesInvoiceDiscount: (invoiceId) => `/sales-invoices/${invoiceId}/approve-discount`,
  salesInvoiceDetail: (invoiceId) => `/sales-invoices/${invoiceId}`,
  salesInvoiceCancelRequest: (invoiceId) => `/sales-invoices/${invoiceId}/cancel-request`,
  salesInvoiceStatus: (invoiceId) => `/sales-invoices/${invoiceId}/status`,
  completeSalesInvoice: (invoiceId) => `/sales-invoices/${invoiceId}/complete`,
  promotions: "/promotions",
  promotionDetail: (promotionId) => `/promotions/${promotionId}`,
  salesEmployees: "/sales-employees",
  employeeStock: "/employee-stock/me",
  employeeStockById: (employeeId) => `/employee-stock/${employeeId}`,
  stockTransfers: "/stock-transfers",
  suppliers: "/suppliers",
  importInvoices: "/import-invoices",
  importInvoiceDetail: (invoiceId) => `/import-invoices/${invoiceId}`,
  importInvoiceDelete: (invoiceId) => `/import-invoices/${invoiceId}`,
  damageReports: "/damage-reports",
  damageReportDetail: (reportId) => `/damage-reports/${reportId}`,
  damageReportApprove: (reportId) => `/damage-reports/${reportId}/approve`,
  damageReportReject: (reportId) => `/damage-reports/${reportId}/reject`,
  reportsMovements: "/reports/movements",
  reportsInventory: "/reports/inventory",
  managerSalesReport: "/reports/manager-sales",
  salesAreas: "/sales-areas",
  employeeAccounts: "/admin/employees",
  pendingRequestsSummary: "/admin/employees/pending-summary",
  approveEmployeeAccount: (employeeId) => `/admin/employees/${employeeId}/approve`,
  lockEmployeeAccount: (employeeId) => `/admin/employees/${employeeId}/lock`,
  salesInvoiceApproveCancel: (invoiceId) => `/sales-invoices/${invoiceId}/approve-cancel`,
  "customer-detail": (customerId) => `/customers/${customerId}`,
  customerUpdate: (customerId) => `/customers/${customerId}`,
  customerPayment: (customerId) => `/customers/${customerId}/payment`,
  "customer-orders": (customerId) => `/customers/${customerId}/orders`,
  "customer-order-detail": (customerId, orderId) => `/customers/${customerId}/orders/${orderId}`,
  "customer-purchased-products": (customerId) => `/customers/${customerId}/purchased-products`,
};

const Apis = axios.create({
  baseURL,
  withCredentials: true,
});

const authenticatedApi = axios.create({
  baseURL,
  withCredentials: true,
});

let refreshRequest = null;
let refreshTimer = null;

const readTokenExpiry = (token) => {
  try {
    const payload = token.split(".")[1];
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = JSON.parse(window.atob(normalized.padEnd(normalized.length + (4 - normalized.length % 4) % 4, "=")));
    return Number(decoded.exp) * 1000;
  } catch {
    return null;
  }
};

const stopTokenRefresh = () => {
  if (refreshTimer) {
    window.clearTimeout(refreshTimer);
    refreshTimer = null;
  }
};

const clearSession = () => {
  stopTokenRefresh();
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.dispatchEvent(new Event("auth:logout"));
};

const redirectToLoginAfterRefreshFailure = () => {
  clearSession();
  if (window.location.hash !== "#/login") {
    window.location.hash = "#/login";
  }
};

export const refreshAccessToken = () => {
  if (!refreshRequest) {
    refreshRequest = Apis.post(endpoints.refresh)
      .then((response) => {
        const token = response.data.token;
        if (!token) {
          throw new Error("Máy chủ không trả về access token mới.");
        }
        localStorage.setItem("token", token);
        scheduleTokenRefresh();
        return token;
      })
      .finally(() => {
        refreshRequest = null;
      });
  }

  return refreshRequest;
};

export const hasUsableAccessToken = () => {
  const token = localStorage.getItem("token");
  const expiresAt = token && readTokenExpiry(token);
  return Boolean(expiresAt && expiresAt > Date.now());
};

export const scheduleTokenRefresh = () => {
  stopTokenRefresh();

  const token = localStorage.getItem("token");
  const expiresAt = token && readTokenExpiry(token);
  if (!expiresAt) return;

  const refreshIn = Math.max(expiresAt - Date.now() - 30 * 1000, 5 * 1000);
  refreshTimer = window.setTimeout(async () => {
    try {
      await refreshAccessToken();
    } catch {
      redirectToLoginAfterRefreshFailure();
    }
  }, refreshIn);
};

export { stopTokenRefresh };

authenticatedApi.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

authenticatedApi.interceptors.response.use(
  (response) => {
    const method = String(response.config?.method || "").toLowerCase();
    if (method && method !== "get" && typeof window !== "undefined") {
      window.dispatchEvent(new Event("pending-requests:refresh"));
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    const hasAccessToken = Boolean(localStorage.getItem("token"));

    if (
      error.response?.status !== 401 ||
      originalRequest?._retry ||
      !hasAccessToken
    ) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      const token = await refreshAccessToken();
      originalRequest.headers = originalRequest.headers || {};
      originalRequest.headers.Authorization = `Bearer ${token}`;
      return authenticatedApi(originalRequest);
    } catch (refreshError) {
      redirectToLoginAfterRefreshFailure();
      return Promise.reject(refreshError);
    }
  },
);

export const authApis = () => authenticatedApi;

export default Apis;
