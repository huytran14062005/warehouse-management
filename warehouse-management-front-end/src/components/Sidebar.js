import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import Apis, { endpoints } from "../configs/Apis";
import ConfirmDialog from "./ConfirmDialog";
import "../css/Sidebar.css";

function Sidebar({ user, pendingRequests, isMobileOpen = false, onMobileClose = () => {} }) {
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const displayName = user?.full_name || user?.username || "bạn";
  const canViewCustomers = [
    "nhân viên bán hàng",
    "kế toán",
    "quản lý",
  ].includes(user?.role);
  const canViewProducts = ["nhân viên bán hàng", "thủ kho", "quản lý"].includes(
    user?.role,
  );
  const canViewSalesInvoices = [
    "kế toán",
    "nhân viên bán hàng",
    "thủ kho",
    "quản lý",
  ].includes(user?.role);
  const canManageStockTransfers = ["thủ kho", "quản lý"].includes(user?.role);
  const canViewImportInvoices = ["thủ kho", "kế toán", "quản lý"].includes(user?.role);
  const canViewDamageReports = ["thủ kho", "kế toán", "quản lý"].includes(user?.role);
  const canViewSuppliers = ["thủ kho", "kế toán", "quản lý"].includes(user?.role);
  const canViewWarehouseReports = ["thủ kho", "kế toán", "quản lý"].includes(user?.role);
  const canViewManagerSalesAnalytics = user?.role === "quản lý";
  const canManageEmployeeAccounts = user?.role === "quản lý";
  const pendingCounts = pendingRequests?.counts || {};
  const pendingTotal = Number(pendingRequests?.total || 0);
  const salesPendingCount = Number(pendingCounts.discount_invoices || 0) + Number(pendingCounts.cancel_requests || 0);

  const handleConfirmLogout = async () => {
    setShowLogoutConfirm(false);
    onMobileClose();
    await Apis.post(endpoints.logout).catch(() => null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.dispatchEvent(new Event("auth:logout"));
    navigate("/");
  };

  return (
    <>
      <aside
        id="internal-sidebar-navigation"
        className={`internal-sidebar${isCollapsed ? " is-collapsed" : ""}${isMobileOpen ? " is-mobile-open" : ""}`}
      >
        <div>
          <div className="internal-sidebar-heading">
            <span className="internal-sidebar-heading-text">DANH MỤC</span>
            <button
              type="button"
              className="internal-sidebar-toggle"
              aria-label={
                isCollapsed
                  ? "Mở rộng thanh chức năng"
                  : "Thu gọn thanh chức năng"
              }
              onClick={() => setIsCollapsed((current) => !current)}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                aria-hidden="true"
              >
                <polyline
                  points={isCollapsed ? "9 18 15 12 9 6" : "15 18 9 12 15 6"}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <button
              type="button"
              className="internal-sidebar-mobile-close"
              aria-label="Đóng danh mục chức năng"
              onClick={onMobileClose}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <nav className="internal-sidebar-nav" aria-label="Chức năng quản lý">
            {canManageEmployeeAccounts && (
              <NavLink
                to="/manager-pending-requests"
                onClick={onMobileClose}
                className={({ isActive }) =>
                  `internal-sidebar-link${isActive ? " is-active" : ""}`
                }
              >
                <span>Yêu cầu cần duyệt</span>
                {pendingTotal > 0 && <span className="internal-sidebar-badge">{pendingTotal}</span>}
              </NavLink>
            )}
            {canViewCustomers && (
              <NavLink
                to="/customers"
                onClick={onMobileClose}
                className={({ isActive }) =>
                  `internal-sidebar-link${isActive ? " is-active" : ""}`
                }
              >
                <span>Danh sách khách hàng</span>
              </NavLink>
            )}
            {canViewProducts && (
              <NavLink
                to="/products"
                onClick={onMobileClose}
                className={({ isActive }) =>
                  `internal-sidebar-link${isActive ? " is-active" : ""}`
                }
              >
                <span>Danh sách sản phẩm</span>
              </NavLink>
            )}
            {canViewSalesInvoices && (
              <NavLink
                to="/sales-invoices"
                onClick={onMobileClose}
                className={({ isActive }) =>
                  `internal-sidebar-link${isActive ? " is-active" : ""}`
                }
              >
                <span>Đơn bán hàng</span>
                {salesPendingCount > 0 && <span className="internal-sidebar-badge">{salesPendingCount}</span>}
              </NavLink>
            )}
            {canManageEmployeeAccounts && (
              <NavLink
                to="/promotions"
                onClick={onMobileClose}
                className={({ isActive }) =>
                  `internal-sidebar-link${isActive ? " is-active" : ""}`
                }
              >
                <span>Khuyến mãi</span>
              </NavLink>
            )}
            {canManageStockTransfers && (
              <NavLink
                to="/stock-transfers"
                onClick={onMobileClose}
                className={({ isActive }) =>
                  `internal-sidebar-link${isActive ? " is-active" : ""}`
                }
              >
                <span>Điều chuyển hàng</span>
              </NavLink>
            )}
            {canManageStockTransfers && (
              <NavLink
                to="/employee-stock"
                onClick={onMobileClose}
                className={({ isActive }) =>
                  `internal-sidebar-link${isActive ? " is-active" : ""}`
                }
              >
                <span>Tồn kho nhân viên</span>
              </NavLink>
            )}
            {canViewImportInvoices && (
              <NavLink
                to="/import-invoices"
                onClick={onMobileClose}
                className={({ isActive }) =>
                  `internal-sidebar-link${isActive ? " is-active" : ""}`
                }
              >
                <span>Phiếu nhập kho</span>
              </NavLink>
            )}
            {canViewDamageReports && (
              <NavLink
                to="/damage-reports"
                onClick={onMobileClose}
                className={({ isActive }) =>
                  `internal-sidebar-link${isActive ? " is-active" : ""}`
                }
              >
                <span>Hàng hư hỏng</span>
                {Number(pendingCounts.damage_reports || 0) > 0 && <span className="internal-sidebar-badge">{pendingCounts.damage_reports}</span>}
              </NavLink>
            )}
            {canViewSuppliers && (
              <NavLink
                to="/suppliers"
                onClick={onMobileClose}
                className={({ isActive }) =>
                  `internal-sidebar-link${isActive ? " is-active" : ""}`
                }
              >
                <span>Nhà cung cấp</span>
              </NavLink>
            )}
            {canViewWarehouseReports && (
              <NavLink
                to="/warehouse-reports"
                onClick={onMobileClose}
                className={({ isActive }) =>
                  `internal-sidebar-link${isActive ? " is-active" : ""}`
                }
              >
                <span>Báo cáo kho</span>
              </NavLink>
            )}
            {canViewManagerSalesAnalytics && (
              <NavLink
                to="/manager-sales-analytics"
                onClick={onMobileClose}
                className={({ isActive }) =>
                  `internal-sidebar-link${isActive ? " is-active" : ""}`
                }
              >
                <span>Thống kê công nợ &amp; doanh thu</span>
              </NavLink>
            )}
            {canManageEmployeeAccounts && (
              <NavLink
                to="/employee-accounts"
                onClick={onMobileClose}
                className={({ isActive }) =>
                  `internal-sidebar-link${isActive ? " is-active" : ""}`
                }
              >
                <span>Quản lý tài khoản</span>
                {Number(pendingCounts.accounts || 0) > 0 && <span className="internal-sidebar-badge">{pendingCounts.accounts}</span>}
              </NavLink>
            )}
          </nav>
        </div>

        <div className="internal-sidebar-account">
          <div className="internal-sidebar-brand-row">
            <img
              className="internal-sidebar-logo"
              src={`${process.env.PUBLIC_URL}/official_logo.jpg`}
              alt="Logo Hiệp Phát"
            />
            <div className="internal-sidebar-account-name">HIỆP PHÁT</div>
          </div>
          <div className="internal-sidebar-greeting">
            Xin chào, <strong>{displayName}</strong>
          </div>
          <button
            type="button"
            className="internal-sidebar-logout"
            onClick={() => setShowLogoutConfirm(true)}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <polyline
                points="16 17 21 12 16 7"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <line
                x1="21"
                y1="12"
                x2="9"
                y2="12"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      <ConfirmDialog
        open={showLogoutConfirm}
        title="Đăng xuất tài khoản?"
        message={
          <>
            Bạn có chắc muốn đăng xuất khỏi tài khoản{" "}
            <strong>{displayName}</strong> không?
          </>
        }
        confirmLabel="Đăng xuất"
        onConfirm={handleConfirmLogout}
        onCancel={() => setShowLogoutConfirm(false)}
      />
    </>
  );
}

export default Sidebar;
