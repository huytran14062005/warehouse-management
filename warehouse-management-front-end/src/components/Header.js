import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Apis, { endpoints } from "../configs/Apis";
import ConfirmDialog from "./ConfirmDialog";
import "../css/Header.css";

function Header() {
  const navigate = useNavigate();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("user")) || null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const syncUser = () => {
      try {
        setUser(JSON.parse(localStorage.getItem("user")) || null);
      } catch {
        setUser(null);
      }
    };

    const handleStorageChange = (event) => {
      if (event.key === "user" || event.key === "token") syncUser();
    };

    window.addEventListener("auth:login", syncUser);
    window.addEventListener("auth:logout", syncUser);
    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener("auth:login", syncUser);
      window.removeEventListener("auth:logout", syncUser);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  const handleLogoutClick = () => {
    setShowLogoutConfirm(true);
  };

  const handleConfirmLogout = async () => {
    setShowLogoutConfirm(false);
    await Apis.post(endpoints.logout).catch(() => null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.dispatchEvent(new Event("auth:logout"));
    navigate("/");
  };

  const displayName = user?.full_name || user?.username || "bạn";

  return (
    <>
      <header className="internal-header">
      <div className="internal-header-inner">
        <button className="internal-brand" type="button" onClick={() => navigate("/")}>
          <span className="internal-logo">
            <img src={`${process.env.PUBLIC_URL}/official_logo.jpg`} alt="Logo Hiệp Phát" />
          </span>
          <span className="internal-brand-name">HIỆP PHÁT</span>
        </button>
        <div className="internal-auth-actions">
          {user ? (
            <>
              <span className="internal-welcome">Xin chào, {displayName}</span>
              <button className="auth-button auth-button-outline" type="button" onClick={handleLogoutClick}>
                Đăng xuất
              </button>
            </>
          ) : (
            <>
              <button className="auth-button auth-button-outline" type="button" onClick={() => navigate("/register")}>Đăng ký</button>
              <button className="auth-button auth-button-primary" type="button" onClick={() => navigate("/login")}>Đăng nhập</button>
            </>
          )}
        </div>
      </div>
      </header>
      <ConfirmDialog
        open={showLogoutConfirm}
        title="Đăng xuất tài khoản?"
        message={<>Bạn có chắc muốn đăng xuất khỏi tài khoản <strong>{displayName}</strong> không?</>}
        confirmLabel="Đăng xuất"
        onConfirm={handleConfirmLogout}
        onCancel={() => setShowLogoutConfirm(false)}
      />
    </>
  );
}

export default Header;
