import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Apis, { endpoints, scheduleTokenRefresh } from "../../configs/Apis";
import { getApiError } from "../../utils/apiError";
import useNotificationState from "../../utils/useNotificationState";
import AutoDismissMessage from "../../components/AutoDismissMessage";
import PasswordInput from "../../components/PasswordInput";
import "../../css/Auth.css";

function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [formData, setFormData] = useState({ username: "", password: "" });
  const [error, setError] = useNotificationState();
  const [loading, setLoading] = useState(false);

  const handleChange = (event) => {
    setFormData((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await Apis.post(endpoints.login, formData);
      const { token, user } = response.data;

      if (token) {
        localStorage.setItem("token", token);
        localStorage.setItem("user", JSON.stringify(user));
        scheduleTokenRefresh();
        window.dispatchEvent(new Event("auth:login"));
        const canViewCustomers = ["nhân viên bán hàng", "kế toán", "quản lý"].includes(user?.role);
        navigate(canViewCustomers ? "/customers" : "/");
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
        <h1>Đăng nhập</h1>
        <AutoDismissMessage message={location.state?.message} type="success" role="status" className="auth-alert auth-success" />
        <AutoDismissMessage message={error} className="auth-alert" />
        <form className="auth-form" onSubmit={handleSubmit}>
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
            <label htmlFor="password">Mật khẩu</label>
            <PasswordInput
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              autoComplete="current-password"
              required
            />
          </div>
          <div className="auth-forgot-row">
            <button
              type="button"
              className="auth-link"
              onClick={() => navigate("/forgot-password")}
            >
              Quên mật khẩu?
            </button>
          </div>
          <button className="auth-submit" type="submit" disabled={loading}>
            {loading ? "Đang xử lý..." : "Đăng nhập"}
          </button>
        </form>
        <p className="auth-link-row">
          Chưa có tài khoản?{" "}
          <button
            className="auth-link"
            type="button"
            onClick={() => navigate("/register")}
          >
            Đăng ký
          </button>
        </p>
      </section>
    </div>
  );
}

export default Login;
