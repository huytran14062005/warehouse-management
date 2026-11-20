import axios from "axios";
import { getAppPath } from "../utils/appPath";

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
  productCombos: "/products/combos",
  productComboCatalog: "/products/combos/catalog",
  productComboDetail: (comboId) => `/products/combos/${comboId}`,
  productDetail: (productId) => `/products/${productId}`,
  productsInventory: "/products/inventory",
  inventoryThreshold: "/products/inventory-threshold",
  productRequests: "/products/requests",
  priceListExport: "/products/price-list/export",
  salesInvoices: "/sales-invoices",
  salesInvoiceStatusBoard: "/sales-invoices/status-board",
  salesInvoiceActionCount: "/sales-invoices/action-count",
  salesInvoiceAssignees: "/sales-invoices/assignees",
  acceptSalesInvoice: (invoiceId) => `/sales-invoices/${invoiceId}/accept`,
  reassignSalesInvoice: (invoiceId) => `/sales-invoices/${invoiceId}/reassign`,
  deliveredSalesInvoice: (invoiceId) => `/sales-invoices/${invoiceId}/delivered`,
  deliveryStaff: "/sales-invoices/delivery-staff",
  prepareSalesInvoiceDelivery: (invoiceId) => `/sales-invoices/${invoiceId}/prepare-delivery`,
  myDeliveries: "/sales-invoices/my-deliveries",
  myDeliveryDetail: (invoiceId) => `/sales-invoices/my-deliveries/${invoiceId}`,
  startMyDelivery: (invoiceId) => `/sales-invoices/my-deliveries/${invoiceId}/start`,
  acceptMyDelivery: (invoiceId) => `/sales-invoices/my-deliveries/${invoiceId}/accept`,
  deliveredMyDelivery: (invoiceId) => `/sales-invoices/my-deliveries/${invoiceId}/delivered`,
  submitSalesInvoiceToWarehouse: (invoiceId) => `/sales-invoices/${invoiceId}/submit-to-warehouse`,
  pendingDiscountInvoices: "/sales-invoices/pending-discount",
  approveSalesInvoiceDiscount: (invoiceId) => `/sales-invoices/${invoiceId}/approve-discount`,
  salesInvoiceDetail: (invoiceId) => `/sales-invoices/${invoiceId}`,
  salesInvoiceCancelRequest: (invoiceId) => `/sales-invoices/${invoiceId}/cancel-request`,
  salesInvoiceConfirmReturn: (invoiceId) => `/sales-invoices/${invoiceId}/confirm-return`,
  salesInvoiceStatus: (invoiceId) => `/sales-invoices/${invoiceId}/status`,
  completeSalesInvoice: (invoiceId) => `/sales-invoices/${invoiceId}/complete`,
  salesInvoicePayments: (invoiceId) => `/sales-invoices/${invoiceId}/payments`,
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
  supplierDetail: (supplierId) => `/suppliers/${supplierId}`,
  importInvoices: "/import-invoices",
  importComboPreview: "/import-invoices/preview-combos",
  importInvoiceDetail: (invoiceId) => `/import-invoices/${invoiceId}`,
  importInvoicePayments: (invoiceId) => `/import-invoices/${invoiceId}/payments`,
  importInvoiceInboundFee: (invoiceId) => `/import-invoices/${invoiceId}/inbound-fee`,
  companyFunds: "/company-funds",
  companyFundsOpening: "/company-funds/opening",
  companyFundsAdjustment: "/company-funds/adjustments",
  companyFundEntries: "/company-funds/entries",
  companyFundEntriesExport: "/company-funds/entries/export",
  importInvoiceDelete: (invoiceId) => `/import-invoices/${invoiceId}`,
  damageReports: "/damage-reports",
  damageReportDetail: (reportId) => `/damage-reports/${reportId}`,
  damageReportApprove: (reportId) => `/damage-reports/${reportId}/approve`,
  damageReportReject: (reportId) => `/damage-reports/${reportId}/reject`,
  reportsMovements: "/reports/movements",
  reportsMovementsExport: "/reports/movements/export",
  reportsInventory: "/reports/inventory",
  managerSalesReport: "/reports/manager-sales",
  pricingExpenses: "/pricing/expenses",
  pricingExpense: (expenseId) => `/pricing/expenses/${expenseId}`,
  pricingExpenseCategories: "/pricing/expense-categories",
  pricingExpenseVoid: (expenseId) => `/pricing/expenses/${expenseId}/void`,
  pricingExpensePay: (expenseId) => `/pricing/expenses/${expenseId}/pay`,
  pricingCatalog: "/pricing/catalog",
  pricingBreakdown: (productId) => `/pricing/breakdown/${productId}`,
  pricingCycle: "/pricing/cycle",
  pricingPolicy: (productId) => `/pricing/policies/${productId}`,
  pricingApply: (productId) => `/pricing/apply/${productId}`,
  pricingProfitability: "/pricing/profitability",
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

// Coalesce identical GETs while they are in flight. A page can mount two
// dependent components at the same time; sharing the promise prevents two
// MySQL round-trips without changing the response or freshness semantics.
const inFlightGetRequests = new Map();
const readResponseCache = new Map();
let readCacheGeneration = 0;

// These endpoints are reference data rather than live transactions. A short
// client-side TTL makes navigation and modal editors feel immediate while any
// write request below invalidates the cache before the next read.
const READ_CACHE_TTLS = new Map([
  ["/warehouses", 60 * 1000],
  ["/sales-employees", 60 * 1000],
  ["/sales-invoices/delivery-staff", 15 * 1000],
  ["/pricing/expense-categories", 60 * 1000],
  ["/sales-areas", 60 * 1000],
  ["/products/combos/catalog", 30 * 1000],
]);

const serializeForCache = (value) => {
  if (value === undefined) return "undefined";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(serializeForCache).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${serializeForCache(value[key])}`).join(",")}}`;
};

const getApiPath = (url) => {
  const rawUrl = String(url || "").split("?", 1)[0];
  if (!/^https?:\/\//i.test(rawUrl)) {
    return rawUrl.startsWith("/") ? rawUrl : `/${rawUrl}`;
  }

  try {
    const parsed = new URL(rawUrl);
    const apiPath = new URL(baseURL).pathname.replace(/\/$/, "");
    return parsed.pathname.startsWith(apiPath)
      ? parsed.pathname.slice(apiPath.length) || "/"
      : parsed.pathname;
  } catch {
    return rawUrl;
  }
};

const readAccessTokenForCache = () => {
  try {
    return localStorage.getItem("token") || "";
  } catch {
    return "";
  }
};

const clearReadResponseCache = () => {
  readCacheGeneration += 1;
  readResponseCache.clear();
};

const installGetOptimization = (client) => {
  const originalGet = client.get.bind(client);

  client.get = (url, config = {}) => {
    config = config || {};
    const method = String(config.method || "get").toLowerCase();
    if (method !== "get") return originalGet(url, config);

    const path = getApiPath(url);
    const token = readAccessTokenForCache();
    const cacheTtl = READ_CACHE_TTLS.get(path) || 0;
    const key = `${token}:${path}:${serializeForCache(config.params || {})}`;
    const now = Date.now();
    const cached = cacheTtl ? readResponseCache.get(key) : null;
    if (cached && cached.expiresAt > now) {
      return Promise.resolve(cached.response);
    }
    if (cached) readResponseCache.delete(key);

    const existing = inFlightGetRequests.get(key);
    if (existing) return existing;

    const generation = readCacheGeneration;
    const request = originalGet(url, config)
      .then((response) => {
        if (cacheTtl && generation === readCacheGeneration && response?.status >= 200 && response.status < 300) {
          readResponseCache.set(key, {
            response,
            expiresAt: Date.now() + cacheTtl,
          });
        }
        return response;
      })
      .finally(() => {
        if (inFlightGetRequests.get(key) === request) inFlightGetRequests.delete(key);
      });

    inFlightGetRequests.set(key, request);
    return request;
  };

  return client;
};

installGetOptimization(authenticatedApi);

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
  if (window.location.pathname !== getAppPath("/login")) {
    window.location.replace(getAppPath("/login"));
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
  const method = String(config.method || "get").toLowerCase();
  if (method !== "get") clearReadResponseCache();

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
