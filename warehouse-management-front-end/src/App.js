import React, { useEffect, useRef, useState } from "react";
import { HashRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import Footer from "./components/Footer";
import Header from "./components/Header";
import BackToTop from "./components/BackToTop";
import PageTransition from "./components/PageTransition";
import Sidebar from "./components/Sidebar";
import Customers from "./screens/Customers/Customers";
import Home from "./screens/Home/Home";
import Login from "./screens/User/Login";
import ForgotPassword from "./screens/User/ForgotPassword";
import Products from "./screens/Products";
import SalesInvoices from "./screens/SalesInvoices";
import StockTransfers from "./screens/StockTransfers";
import EmployeeStock from "./screens/EmployeeStock";
import ImportInvoices from "./screens/ImportInvoices";
import DamageReports from "./screens/DamageReports";
import Suppliers from "./screens/Suppliers";
import WarehouseReports from "./screens/WarehouseReports";
import ManagerSalesAnalytics from "./screens/ManagerSalesAnalytics";
import Register from "./screens/User/Register";
import EmployeeAccounts from "./screens/EmployeeAccounts";
import PendingRequests from "./screens/PendingRequests";
import Promotions from "./screens/Promotions";
import {
  authApis,
  endpoints,
  hasUsableAccessToken,
  refreshAccessToken,
  scheduleTokenRefresh,
  stopTokenRefresh,
} from "./configs/Apis";
import "./css/Responsive.css";

const PUBLIC_AUTH_PATHS = ["/login", "/register", "/forgot-password"];

const readStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user")) || null;
  } catch {
    return null;
  }
};

const clearStoredSession = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.dispatchEvent(new Event("auth:logout"));
};

function RequireAuthentication({ children, currentUser, authReady }) {
  const location = useLocation();

  if (!authReady) {
    return <div className="auth-route-loading" role="status">Đang kiểm tra phiên đăng nhập...</div>;
  }

  if (!currentUser || !localStorage.getItem("token")) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname, message: "Vui lòng đăng nhập để tiếp tục." }}
      />
    );
  }

  return children;
}

function PublicOnlyRoute({ children, currentUser, authReady }) {
  if (!authReady) {
    return <div className="auth-route-loading" role="status">Đang kiểm tra phiên đăng nhập...</div>;
  }

  if (currentUser && localStorage.getItem("token")) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function AppFrame() {
  const location = useLocation();
  const currentUserRef = useRef(null);
  const storageSyncTimerRef = useRef(null);
  const [authReady, setAuthReady] = useState(false);
  const [currentUser, setCurrentUser] = useState(() => {
    return readStoredUser();
  });
  const [pendingRequests, setPendingRequests] = useState({
    total: 0,
    counts: { accounts: 0, damage_reports: 0, discount_invoices: 0, cancel_requests: 0, product_requests: 0, overdue_debts: 0, due_today_debts: 0, due_soon_debts: 0 },
  });
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  useEffect(() => {
    let cancelled = false;

    const restoreSession = async () => {
      // Restore an access token on startup when the refresh cookie still
      // exists but localStorage has an expired or missing access token.
      const hasStoredUser = Boolean(localStorage.getItem("user"));
      if (hasStoredUser && !hasUsableAccessToken()) {
        try {
          await refreshAccessToken();
        } catch (error) {
          if (!cancelled) {
            // An expired access token is recoverable while the refresh
            // session is still valid. Only a definitive 401 from /refresh
            // means that the user must sign in again.
            if (error.response?.status === 401) {
              stopTokenRefresh();
              clearStoredSession();
              setCurrentUser(null);
            } else {
              scheduleTokenRefresh();
            }
          }
        }
      } else {
        scheduleTokenRefresh();
      }

      if (!cancelled) setAuthReady(true);
    };

    restoreSession();

    const syncAuthentication = () => {
      setCurrentUser(readStoredUser());
    };

    const syncAuthenticationFromOtherTab = () => {
      const nextUser = readStoredUser();
      const hasToken = Boolean(localStorage.getItem("token"));
      const previousUser = currentUserRef.current;
      const currentPath = window.location.hash.replace(/^#/, "").split("?")[0] || "/";

      if (!nextUser || !hasToken) {
        stopTokenRefresh();
        setCurrentUser(null);
        if (!PUBLIC_AUTH_PATHS.includes(currentPath)) {
          window.location.hash = "#/login";
        }
        return;
      }

      scheduleTokenRefresh();
      setCurrentUser(nextUser);

      const identityChanged = previousUser && (
        previousUser.id !== nextUser.id || previousUser.username !== nextUser.username
      );
      if (identityChanged) {
        window.location.hash = "#/";
        window.location.reload();
      }
    };

    const handleStorage = (event) => {
      if (event.key !== "user" && event.key !== "token") return;
      if (storageSyncTimerRef.current) window.clearTimeout(storageSyncTimerRef.current);
      storageSyncTimerRef.current = window.setTimeout(() => {
        storageSyncTimerRef.current = null;
        syncAuthenticationFromOtherTab();
      }, 0);
    };

    const handleLogout = () => {
      stopTokenRefresh();
      setMobileNavigationOpen(false);
      syncAuthentication();
    };

    window.addEventListener("auth:login", syncAuthentication);
    window.addEventListener("auth:logout", handleLogout);
    window.addEventListener("storage", handleStorage);

    return () => {
      cancelled = true;
      if (storageSyncTimerRef.current) window.clearTimeout(storageSyncTimerRef.current);
      window.removeEventListener("auth:login", syncAuthentication);
      window.removeEventListener("auth:logout", handleLogout);
      window.removeEventListener("storage", handleStorage);
      stopTokenRefresh();
    };
  }, []);

  useEffect(() => {
    const isManager = currentUser?.role === "quản lý";
    if (!isManager) {
      setPendingRequests({
        total: 0,
        counts: { accounts: 0, damage_reports: 0, discount_invoices: 0, cancel_requests: 0, product_requests: 0, overdue_debts: 0, due_today_debts: 0, due_soon_debts: 0 },
      });
      return undefined;
    }

    let cancelled = false;
    const loadPendingRequests = async () => {
      try {
        const response = await authApis().get(endpoints.pendingRequestsSummary);
        if (!cancelled) {
          setPendingRequests({
            total: Number(response.data?.total || 0),
            counts: response.data?.counts || {},
          });
        }
      } catch (error) {
        if (!cancelled && [401, 403].includes(error.response?.status)) {
          setPendingRequests({
            total: 0,
            counts: { accounts: 0, damage_reports: 0, discount_invoices: 0, cancel_requests: 0, product_requests: 0, overdue_debts: 0, due_today_debts: 0, due_soon_debts: 0 },
          });
        }
      }
    };

    const handleRefresh = () => loadPendingRequests();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") loadPendingRequests();
    };

    loadPendingRequests();
    const interval = window.setInterval(loadPendingRequests, 60 * 1000);
    window.addEventListener("pending-requests:refresh", handleRefresh);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("pending-requests:refresh", handleRefresh);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [currentUser?.role]);

  useEffect(() => {
    if (!mobileNavigationOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setMobileNavigationOpen(false);
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileNavigationOpen]);

  const canViewSidebar = [
    "kế toán",
    "nhân viên bán hàng",
    "thủ kho",
    "quản lý",
  ].includes(currentUser?.role);

  const showSidebar = canViewSidebar && !PUBLIC_AUTH_PATHS.includes(location.pathname);
  const requireAuth = (element) => (
    <RequireAuthentication currentUser={currentUser} authReady={authReady}>
      {element}
    </RequireAuthentication>
  );

  return (
    <div className="app-shell">
        {!currentUser && <Header />}
        <main className="app-main">
          {showSidebar && (
            <div className="mobile-navigation-bar">
              <button
                type="button"
                className="mobile-navigation-toggle"
                aria-label="Mở danh mục chức năng"
                aria-controls="internal-sidebar-navigation"
                aria-expanded={mobileNavigationOpen}
                onClick={() => setMobileNavigationOpen(true)}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                  <path d="M4 6h16M4 12h16M4 18h16" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
              <div className="mobile-navigation-brand">
                <img src={`${process.env.PUBLIC_URL}/official_logo.jpg`} alt="" aria-hidden="true" />
                <div>
                  <strong>HIỆP PHÁT</strong>
                  <span>{currentUser?.role || "Quản lý kho"}</span>
                </div>
              </div>
            </div>
          )}
          <div className="app-main-layout">
            {showSidebar && (
              <>
                <button
                  type="button"
                  className={`mobile-navigation-overlay${mobileNavigationOpen ? " is-visible" : ""}`}
                  aria-label="Đóng danh mục chức năng"
                  onClick={() => setMobileNavigationOpen(false)}
                />
                <Sidebar
                  user={currentUser}
                  pendingRequests={pendingRequests}
                  isMobileOpen={mobileNavigationOpen}
                  onMobileClose={() => setMobileNavigationOpen(false)}
                />
              </>
            )}
            <div className="app-route-content">
              <PageTransition>
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/register" element={<PublicOnlyRoute currentUser={currentUser} authReady={authReady}><Register /></PublicOnlyRoute>} />
                  <Route path="/login" element={<PublicOnlyRoute currentUser={currentUser} authReady={authReady}><Login /></PublicOnlyRoute>} />
                  <Route path="/forgot-password" element={<PublicOnlyRoute currentUser={currentUser} authReady={authReady}><ForgotPassword /></PublicOnlyRoute>} />
                  <Route path="/customers" element={requireAuth(<Customers />)} />
                  <Route path="/products" element={requireAuth(<Products />)} />
                  <Route path="/sales-invoices" element={requireAuth(<SalesInvoices />)} />
                  <Route path="/promotions" element={requireAuth(<Promotions />)} />
                  <Route path="/stock-transfers" element={requireAuth(<StockTransfers />)} />
                  <Route path="/employee-stock" element={requireAuth(<EmployeeStock />)} />
                  <Route path="/import-invoices" element={requireAuth(<ImportInvoices />)} />
                  <Route path="/damage-reports" element={requireAuth(<DamageReports />)} />
                  <Route path="/suppliers" element={requireAuth(<Suppliers />)} />
                  <Route path="/warehouse-reports" element={requireAuth(<WarehouseReports />)} />
                  <Route path="/manager-sales-analytics" element={requireAuth(<ManagerSalesAnalytics />)} />
                  <Route path="/employee-accounts" element={requireAuth(<EmployeeAccounts />)} />
                  <Route path="/manager-pending-requests" element={requireAuth(<PendingRequests pendingRequests={pendingRequests} />)} />
                  <Route path="*" element={<Home />} />
                </Routes>
              </PageTransition>
            </div>
          </div>
        </main>
        <Footer />
        <BackToTop />
    </div>
  );
}

function App() {
  return (
    <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppFrame />
    </HashRouter>
  );
}

export default App;
