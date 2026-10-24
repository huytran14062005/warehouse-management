import React, { useEffect, useState } from "react";
import { HashRouter, Route, Routes } from "react-router-dom";
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
import { authApis, endpoints, scheduleTokenRefresh, stopTokenRefresh } from "./configs/Apis";
import "./css/Responsive.css";

function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("user")) || null;
    } catch {
      return null;
    }
  });
  const [pendingRequests, setPendingRequests] = useState({
    total: 0,
    counts: { accounts: 0, damage_reports: 0, discount_invoices: 0, cancel_requests: 0 },
  });
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);

  useEffect(() => {
    scheduleTokenRefresh();

    const syncAuthentication = () => {
      try {
        setCurrentUser(JSON.parse(localStorage.getItem("user")) || null);
      } catch {
        setCurrentUser(null);
      }
    };

    const handleLogout = () => {
      stopTokenRefresh();
      setMobileNavigationOpen(false);
      syncAuthentication();
    };

    window.addEventListener("auth:login", syncAuthentication);
    window.addEventListener("auth:logout", handleLogout);
    window.addEventListener("storage", syncAuthentication);

    return () => {
      window.removeEventListener("auth:login", syncAuthentication);
      window.removeEventListener("auth:logout", handleLogout);
      window.removeEventListener("storage", syncAuthentication);
      stopTokenRefresh();
    };
  }, []);

  useEffect(() => {
    const isManager = currentUser?.role === "quản lý";
    if (!isManager) {
      setPendingRequests({
        total: 0,
        counts: { accounts: 0, damage_reports: 0, discount_invoices: 0, cancel_requests: 0 },
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
            counts: { accounts: 0, damage_reports: 0, discount_invoices: 0, cancel_requests: 0 },
          });
        }
      }
    };

    const handleRefresh = () => loadPendingRequests();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") loadPendingRequests();
    };

    loadPendingRequests();
    const interval = window.setInterval(loadPendingRequests, 5000);
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

  return (
    <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <div className="app-shell">
        {!currentUser && <Header />}
        <main className="app-main">
          {canViewSidebar && (
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
            {canViewSidebar && (
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
                  <Route path="/register" element={<Register />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/customers" element={<Customers />} />
                  <Route path="/products" element={<Products />} />
                  <Route path="/sales-invoices" element={<SalesInvoices />} />
                  <Route path="/promotions" element={<Promotions />} />
                  <Route path="/stock-transfers" element={<StockTransfers />} />
                  <Route path="/employee-stock" element={<EmployeeStock />} />
                  <Route path="/import-invoices" element={<ImportInvoices />} />
                  <Route path="/damage-reports" element={<DamageReports />} />
                  <Route path="/suppliers" element={<Suppliers />} />
                  <Route path="/warehouse-reports" element={<WarehouseReports />} />
                  <Route path="/manager-sales-analytics" element={<ManagerSalesAnalytics />} />
                  <Route path="/employee-accounts" element={<EmployeeAccounts />} />
                  <Route path="/manager-pending-requests" element={<PendingRequests pendingRequests={pendingRequests} />} />
                  <Route path="*" element={<Home />} />
                </Routes>
              </PageTransition>
            </div>
          </div>
        </main>
        <Footer />
        <BackToTop />
      </div>
    </HashRouter>
  );
}

export default App;
