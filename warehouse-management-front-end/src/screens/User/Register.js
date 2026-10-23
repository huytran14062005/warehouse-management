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
            <input
              id="password"
              name="password"
              type="password"
              minLength="8"
              value={formData.password}
              onChange={handleChange}
              required
            />
          </div>
          <div className="auth-field">
            <label htmlFor="confirm">Xác nhận mật khẩu</label>
            <input
              id="confirm"
              name="confirm"
              type="password"
              minLength="8"
              value={formData.confirm}
              onChange={handleChange}
              required
            />
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
