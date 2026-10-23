import React, { useState } from "react";

function PasswordIcon({ visible }) {
  return (
    <svg
      className="password-toggle-icon"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12c2.2-4 5.5-6 10-6s7.8 2 10 6c-2.2 4-5.5 6-10 6S4.2 16 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      {visible && <path d="M3 3l18 18" />}
    </svg>
  );
}

function PasswordInput({ visibilityLabel = "mật khẩu", className = "", ...inputProps }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="password-input-wrapper">
      <input
        {...inputProps}
        type={visible ? "text" : "password"}
        className={`password-input${className ? ` ${className}` : ""}`}
      />
      <button
        type="button"
        className="password-toggle-btn"
        onClick={() => setVisible((current) => !current)}
        aria-label={`${visible ? "Ẩn" : "Hiện"} ${visibilityLabel}`}
        aria-pressed={visible}
      >
        <PasswordIcon visible={visible} />
      </button>
    </div>
  );
}

export default PasswordInput;
