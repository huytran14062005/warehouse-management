import React from "react";
import "../css/FieldAlert.css";

function FieldAlert({ message, id, className = "" }) {
  if (!message) return null;

  return (
    <small id={id} className={`field-alert${className ? ` ${className}` : ""}`} role="alert">
      {message}
    </small>
  );
}

export default FieldAlert;
