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
  salesInvoicePaymentDueDate: (invoiceId) => `/sales-invoices/${invoiceId}/payment-due-date`,
  promotions: "/promotions",
  promotionDetail: (promotionId) => `/promotions/${promotionId}`,
  salesEmployees: "/sales-employees",
  warehouses: "/warehouses",
  employeeStock: "/employee-stock/me",
  employeeStockById: (employeeId) => `/employee-stock/${employeeId}`,
  stockTransfers: "/stock-transfers",
  stockTransferDetail: (transferId) => `/stock-transfers/${transferId}`,
  suppliers: "/suppliers",
  importInvoices: "/import-invoices",
  importInvoiceDetail: (invoiceId) => `/import-invoices/${invoiceId}`,
  importInvoicePayments: (invoiceId) => `/import-invoices/${invoiceId}/payments`,
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

const ACCESS_TOKEN_REFRESH_LEAD_MS = 60 * 1000;
const REFRESH_RETRY_MS = 5 * 1000;
const REFRESH_LOCK_KEY = "warehouse:auth-refresh-lock";
const REFRESH_LOCK_TTL_MS = 20 * 1000;
const REFRESH_TOKEN_EVENT = "auth:token-refreshed";
const tabId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

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

const isAccessTokenUsable = (token) => {
  const expiresAt = token && readTokenExpiry(token);
  return Boolean(expiresAt && expiresAt > Date.now());
};

const readRefreshLock = () => {
  try {
    const rawLock = localStorage.getItem(REFRESH_LOCK_KEY);
    return rawLock ? JSON.parse(rawLock) : null;
  } catch {
    return null;
  }
};

const acquireRefreshLock = () => {
  const currentLock = readRefreshLock();
  if (currentLock && currentLock.expiresAt > Date.now() && currentLock.owner !== tabId) {
    return false;
  }

  const nextLock = {
    owner: tabId,
    expiresAt: Date.now() + REFRESH_LOCK_TTL_MS,
  };
  localStorage.setItem(REFRESH_LOCK_KEY, JSON.stringify(nextLock));
  return readRefreshLock()?.owner === tabId;
};

const releaseRefreshLock = () => {
  const currentLock = readRefreshLock();
  if (currentLock?.owner === tabId) {
    localStorage.removeItem(REFRESH_LOCK_KEY);
  }
};

const waitForOtherTabRefresh = (previousToken) => new Promise((resolve, reject) => {
  const startedAt = Date.now();
  let interval = null;
  let timeout = null;

  const cleanup = () => {
    window.removeEventListener("storage", checkForNewToken);
    window.removeEventListener(REFRESH_TOKEN_EVENT, checkForNewToken);
    if (interval) window.clearInterval(interval);
    if (timeout) window.clearTimeout(timeout);
  };

  const checkForNewToken = () => {
    const nextToken = localStorage.getItem("token");
    if (nextToken && nextToken !== previousToken && isAccessTokenUsable(nextToken)) {
      cleanup();
      scheduleTokenRefresh();
      resolve(nextToken);
      return;
    }

    const lock = readRefreshLock();
    if ((!lock || lock.expiresAt <= Date.now()) && Date.now() - startedAt >= REFRESH_RETRY_MS) {
      cleanup();
      reject(new Error("Không nhận được access token mới từ tab đang làm mới phiên."));
    }
  };

  window.addEventListener("storage", checkForNewToken);
  window.addEventListener(REFRESH_TOKEN_EVENT, checkForNewToken);
  interval = window.setInterval(checkForNewToken, 250);
  timeout = window.setTimeout(() => {
    cleanup();
    reject(new Error("Làm mới phiên đăng nhập mất quá nhiều thời gian."));
  }, REFRESH_LOCK_TTL_MS + REFRESH_RETRY_MS);
  checkForNewToken();
});

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
    const previousToken = localStorage.getItem("token");

    if (!acquireRefreshLock()) {
      refreshRequest = waitForOtherTabRefresh(previousToken).finally(() => {
        refreshRequest = null;
      });
    } else {
      refreshRequest = Apis.post(endpoints.refresh)
        .then((response) => {
          const token = response.data.token;
          if (!token) {
            throw new Error("Máy chủ không trả về access token mới.");
          }
          localStorage.setItem("token", token);
          window.dispatchEvent(new Event(REFRESH_TOKEN_EVENT));
          scheduleTokenRefresh();
          return token;
        })
        .finally(() => {
          releaseRefreshLock();
          refreshRequest = null;
        });
    }
  }

  return refreshRequest;
};

export const hasUsableAccessToken = () => {
  const token = localStorage.getItem("token");
  return isAccessTokenUsable(token);
};

const isRefreshSessionInvalid = (error) => error?.response?.status === 401;

const retryRefreshUntilSessionEnds = () => {
  stopTokenRefresh();

  if (!localStorage.getItem("token") && !localStorage.getItem("user")) {
    return;
  }

  refreshTimer = window.setTimeout(async () => {
    try {
      await refreshAccessToken();
    } catch (error) {
      if (isRefreshSessionInvalid(error)) {
        redirectToLoginAfterRefreshFailure();
      } else {
        retryRefreshUntilSessionEnds();
      }
    }
  }, REFRESH_RETRY_MS);
};

export const scheduleTokenRefresh = () => {
  stopTokenRefresh();

  const token = localStorage.getItem("token");
  const expiresAt = token && readTokenExpiry(token);
  if (!expiresAt) return;

  const refreshIn = Math.max(expiresAt - Date.now() - ACCESS_TOKEN_REFRESH_LEAD_MS, 5 * 1000);
  refreshTimer = window.setTimeout(async () => {
    try {
      await refreshAccessToken();
    } catch (error) {
      if (isRefreshSessionInvalid(error)) {
        redirectToLoginAfterRefreshFailure();
      } else {
        retryRefreshUntilSessionEnds();
      }
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
      if (isRefreshSessionInvalid(refreshError)) {
        redirectToLoginAfterRefreshFailure();
      } else {
        retryRefreshUntilSessionEnds();
      }
      return Promise.reject(refreshError);
    }
  },
);

export const authApis = () => authenticatedApi;

export default Apis;
