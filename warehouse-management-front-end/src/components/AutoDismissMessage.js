import React, { useEffect, useState } from "react";
import "../css/Notifications.css";

function AutoDismissMessage({ message, type = "error", role = "alert", className = "" }) {
  const [visibleMessage, setVisibleMessage] = useState(message);

  useEffect(() => {
    setVisibleMessage(message);
    if (!message) return undefined;

    const timeout = window.setTimeout(() => setVisibleMessage(""), 3000);
    return () => window.clearTimeout(timeout);
  }, [message]);

  if (!visibleMessage) return null;

  return (
    <div className={`app-notification app-notification-${type} ${className}`.trim()} role={role}>
      {visibleMessage}
    </div>
  );
}

export default AutoDismissMessage;
