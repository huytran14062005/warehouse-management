import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Apis, { endpoints } from "../../configs/Apis";
import { getApiError } from "../../utils/apiError";
import useNotificationState from "../../utils/useNotificationState";
import AutoDismissMessage from "../../components/AutoDismissMessage";
import "../../css/Auth.css";

const initialForm = {
  full_name: "",
  phone: "",
  username: "",
  email: "",
  password: "",
  confirm: "",
  role: "nhân viên bán hàng",
};

const roleOptions = [
  { value: "nhân viên bán hàng", label: "Nhân viên bán hàng" },
  { value: "thủ kho", label: "Thủ kho" },
  { value: "kế toán", label: "Kế toán" },
];

function Register() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState(initialForm);
  const [error, setError] = useNotificationState();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const [roleSearch, setRoleSearch] = useState("");
  const roleDropdownRef = useRef(null);

  useEffect(() => {
    if (!roleOpen) {
      return undefined;
    }

    const handleOutsideClick = (event) => {
      if (!roleDropdownRef.current?.contains(event.target)) {
        setRoleOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setRoleOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [roleOpen]);

  const handleChange = (event) => {
    setFormData((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (formData.password !== formData.confirm) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }

    setLoading(true);

    try {
      const response = await Apis.post(endpoints.register, formData);

      if (response.status === 201) {
        navigate("/login", {
          state: {
            message:
              "Đăng ký thành công. Vui lòng chờ quản lý duyệt tài khoản trước khi đăng nhập.",
          },
        });
      }
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <section className="auth-card">
        <h1>Đăng ký tài khoản</h1>
        <AutoDismissMessage message={error} className="auth-alert" />
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-field">
            <label htmlFor="full_name">Họ và tên</label>
            <input
              id="full_name"
              name="full_name"
              value={formData.full_name}
              onChange={handleChange}
              required
            />
          </div>
          <div className="auth-field">
            <label htmlFor="phone">Số điện thoại</label>
            <input
              id="phone"
              name="phone"
              type="tel"
              value={formData.phone}
              onChange={handleChange}
              required
            />
          </div>
          <div className="auth-field">
            <label htmlFor="username">Tên đăng nhập</label>
            <input
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              required
            />
          </div>
          <div className="auth-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              autoComplete="email"
              required
            />
          </div>
          <div className="auth-field">
            <label htmlFor="password">Mật khẩu</label>
            <div className="password-input-wrapper">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                minLength="8"
                value={formData.password}
                onChange={handleChange}
                className="password-input"
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              >
                {showPassword ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <line x1="1" y1="1" x2="23" y2="23" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx="12" cy="12" r="3" strokeWidth="2" />
                  </svg>
                )}
              </button>
            </div>
          </div>
          <div className="auth-field">
            <label htmlFor="confirm">Xác nhận mật khẩu</label>
            <div className="password-input-wrapper">
              <input
                id="confirm"
                name="confirm"
                type={showConfirmPassword ? "text" : "password"}
                minLength="8"
                value={formData.confirm}
                onChange={handleChange}
                className="password-input"
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowConfirmPassword((current) => !current)}
                aria-label={showConfirmPassword ? "Ẩn mật khẩu xác nhận" : "Hiện mật khẩu xác nhận"}
              >
                {showConfirmPassword ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <line x1="1" y1="1" x2="23" y2="23" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx="12" cy="12" r="3" strokeWidth="2" />
                  </svg>
                )}
              </button>
            </div>
          </div>
          <div className="auth-field">
            <span className="auth-label">Vai trò</span>
            <div className="role-dropdown" ref={roleDropdownRef}>
              <button
                className="role-dropdown-trigger"
                type="button"
                aria-haspopup="listbox"
                aria-expanded={roleOpen}
                onClick={() =>
                  setRoleOpen((current) => {
                    if (!current) setRoleSearch("");
                    return !current;
                  })
                }
              >
                <span>
                  {
                    roleOptions.find((option) => option.value === formData.role)
                      ?.label
                  }
                </span>
                <svg
                  className={`role-dropdown-arrow${roleOpen ? " is-open" : ""}`}
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    d="m6 9 6 6 6-6"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              {roleOpen && (
                <div
                  className="role-dropdown-menu"
                  role="listbox"
                  aria-label="Chọn vai trò"
                >
                  <input
                    type="search"
                    className="role-dropdown-search"
                    value={roleSearch}
                    onChange={(event) => setRoleSearch(event.target.value)}
                    placeholder="Tìm vai trò..."
                    aria-label="Tìm vai trò"
                  />
                  {roleOptions
                    .filter((option) =>
                      String(option.label)
                        .toLocaleLowerCase()
                        .includes(roleSearch.trim().toLocaleLowerCase()),
                    )
                    .map((option) => (
                      <button
                        className={`role-dropdown-option${formData.role === option.value ? " is-selected" : ""}`}
                        type="button"
                        role="option"
                        aria-selected={formData.role === option.value}
                        key={option.value}
                        onClick={() => {
                          setFormData((current) => ({
                            ...current,
                            role: option.value,
                          }));
                          setRoleSearch("");
                          setRoleOpen(false);
                        }}
                      >
                        {option.label}
                      </button>
                    ))}
                </div>
              )}
            </div>
          </div>
          <button className="auth-submit" type="submit" disabled={loading}>
            {loading ? "Đang xử lý..." : "Đăng ký"}
          </button>
        </form>
        <p className="auth-link-row">
          Đã có tài khoản?{" "}
          <button
            className="auth-link"
            type="button"
            onClick={() => navigate("/login")}
          >
            Đăng nhập
          </button>
        </p>
      </section>
    </div>
  );
}

export default Register;
