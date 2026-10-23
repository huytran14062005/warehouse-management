import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Apis, { endpoints } from "../../configs/Apis";
import { getApiError } from "../../utils/apiError";
import AutoDismissMessage from "../../components/AutoDismissMessage";
import "../../css/Auth.css";

function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [challengeToken, setChallengeToken] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const runRequest = async (request, nextStep) => {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const response = await request();
      nextStep(response);
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setLoading(false);
    }
  };

  const requestOtp = (event) => {
    event.preventDefault();
    runRequest(
      () => Apis.post(endpoints.forgotPasswordRequest, { email: email.trim() }),
      (response) => {
        const token = response.data?.challenge_token || response.data?.challengeToken;
        if (!token) throw new Error("Backend chưa trả về mã yêu cầu OTP.");
        setChallengeToken(token);
        setStep("otp");
        setMessage(response.data?.message || "Mã OTP đã được gửi đến email của bạn.");
      },
    );
  };

  const verifyOtp = (event) => {
    event.preventDefault();
    runRequest(
      () => Apis.post(endpoints.forgotPasswordVerify, {
        email: email.trim(),
        otp,
        challenge_token: challengeToken,
      }),
      (response) => {
        const token = response.data?.reset_token || response.data?.resetToken;
        if (!token) throw new Error("Backend chưa trả về token đổi mật khẩu.");
        setResetToken(token);
        setStep("reset");
      },
    );
  };

  const resetPassword = (event) => {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }
    runRequest(
      () => Apis.post(endpoints.forgotPasswordReset, {
        reset_token: resetToken,
        new_password: newPassword,
        confirm_password: confirmPassword,
      }),
      () => navigate("/login", { state: { message: "Đổi mật khẩu thành công. Vui lòng đăng nhập lại." } }),
    );
  };

  const backToEmail = () => {
    setStep("email");
    setOtp("");
    setChallengeToken("");
    setError("");
    setMessage("");
  };

  return (
    <div className="auth-page">
      <section className="auth-card">
        <h1>Quên mật khẩu</h1>
        {step === "email" && <p className="auth-subtitle">Nhập email đã đăng ký để nhận mã OTP.</p>}
        {step === "otp" && <p className="auth-subtitle">Mã OTP có hiệu lực trong 5 phút.</p>}
        {step === "reset" && <p className="auth-subtitle">Tạo mật khẩu mới cho tài khoản của bạn.</p>}
        <AutoDismissMessage message={error} className="auth-alert" />
        <AutoDismissMessage message={message} type="success" role="status" className="auth-alert auth-success" />

        {step === "email" && (
          <form className="auth-form" onSubmit={requestOtp}>
            <div className="auth-field">
              <label htmlFor="forgot-email">Email tài khoản</label>
              <input id="forgot-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
            </div>
            <button className="auth-submit" type="submit" disabled={loading}>{loading ? "Đang gửi..." : "Gửi mã OTP"}</button>
          </form>
        )}

        {step === "otp" && (
          <form className="auth-form" onSubmit={verifyOtp}>
            <div className="auth-field">
              <label htmlFor="forgot-otp">Mã OTP 6 số</label>
              <input id="forgot-otp" type="text" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" maxLength={6} required />
            </div>
            <button className="auth-submit" type="submit" disabled={loading}>{loading ? "Đang xác thực..." : "Xác nhận OTP"}</button>
            <button className="auth-link auth-secondary-button" type="button" onClick={backToEmail}>Đổi email</button>
          </form>
        )}

        {step === "reset" && (
          <form className="auth-form" onSubmit={resetPassword}>
            <div className="auth-field">
              <label htmlFor="new-password">Mật khẩu mới</label>
              <input id="new-password" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" minLength={8} required />
            </div>
            <div className="auth-field">
              <label htmlFor="confirm-password">Xác nhận mật khẩu mới</label>
              <input id="confirm-password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" minLength={8} required />
            </div>
            <button className="auth-submit" type="submit" disabled={loading}>{loading ? "Đang cập nhật..." : "Đổi mật khẩu"}</button>
          </form>
        )}

        <p className="auth-link-row">
          <button className="auth-link" type="button" onClick={() => navigate("/login")}>Quay lại đăng nhập</button>
        </p>
      </section>
    </div>
  );
}

export default ForgotPassword;
