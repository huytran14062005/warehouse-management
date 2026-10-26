import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import "../css/Notifications.css";

function AutoDismissMessage({ message, type = "error", role = "alert", className = "" }) {
  const [visibleMessage, setVisibleMessage] = useState(message);

  useEffect(() => {
    setVisibleMessage(message);
    if (!message) return undefined;

    const timeout = window.setTimeout(
      () => setVisibleMessage(""),
      type === "success" ? 5000 : 10000,
    );
    return () => window.clearTimeout(timeout);
  }, [message, type]);

  if (!visibleMessage) return null;

  const icon = type === "success" ? "✓" : type === "warning" ? "!" : "×";

  const notification = (
    <div className={`app-notification app-notification-${type} ${className}`.trim()} role={role}>
      <span className="app-notification-icon" aria-hidden="true">{icon}</span>
      <span className="app-notification-message">{visibleMessage}</span>
      <button
        type="button"
        className="app-notification-close"
        aria-label="Đóng thông báo"
        onClick={() => setVisibleMessage("")}
      >
        ×
      </button>
    </div>
  );

  return typeof document === "undefined" ? notification : createPortal(notification, document.body);
}

export default AutoDismissMessage;
