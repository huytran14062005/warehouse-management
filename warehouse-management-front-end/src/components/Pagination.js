import React from "react";
import "../css/Pagination.css";

function Pagination({ page, totalPages, onPageChange, disabled = false, maxVisible = 5 }) {
  if (!totalPages || totalPages <= 1) return null;

  const pages = [];
  let start = Math.max(1, page - Math.floor(maxVisible / 2));
  const end = Math.min(totalPages, start + maxVisible - 1);
  start = Math.max(1, end - maxVisible + 1);

  if (start > 1) {
    pages.push(1);
    if (start > 2) pages.push("start-ellipsis");
  }
  for (let number = start; number <= end; number += 1) pages.push(number);
  if (end < totalPages) {
    if (end < totalPages - 1) pages.push("end-ellipsis");
    pages.push(totalPages);
  }

  const changePage = (nextPage) => {
    if (nextPage < 1 || nextPage > totalPages || nextPage === page || disabled) return;
    onPageChange(nextPage);
  };

  return (
    <div className="warehouse-pagination-controls" aria-label="Phân trang">
      <button type="button" className="warehouse-page-button warehouse-page-nav" onClick={() => changePage(page - 1)} disabled={page === 1 || disabled}>
        <span aria-hidden="true">‹</span> Trước
      </button>
      {pages.map((item) => item === "start-ellipsis" || item === "end-ellipsis" ? (
        <span key={item} className="warehouse-page-ellipsis">...</span>
      ) : (
        <button type="button" key={item} className={`warehouse-page-button ${item === page ? "active" : ""}`} onClick={() => changePage(item)} disabled={disabled}>
          {item}
        </button>
      ))}
      <button type="button" className="warehouse-page-button warehouse-page-nav" onClick={() => changePage(page + 1)} disabled={page >= totalPages || disabled}>
        Sau <span aria-hidden="true">›</span>
      </button>
    </div>
  );
}

export default Pagination;
