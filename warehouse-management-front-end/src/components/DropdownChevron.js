import React from "react";
import "../css/DropdownChevron.css";

function DropdownChevron({ open = false }) {
  return (
    <svg
      className={`dropdown-chevron${open ? " is-open" : ""}`}
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
  );
}

export default DropdownChevron;
