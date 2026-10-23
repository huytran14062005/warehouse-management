import "../css/Skeleton.css";

function Skeleton({ variant = "table", rows = 5, columns = 4, className = "" }) {
  if (variant === "cards") {
    return (
      <div className={`skeleton-cards ${className}`.trim()} role="status" aria-label="Đang tải dữ liệu">
        {Array.from({ length: columns }).map((_, index) => (
          <div className="skeleton-card" key={index}>
            <span className="skeleton-line skeleton-line--short" />
            <span className="skeleton-line skeleton-line--value" />
            <span className="skeleton-line" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === "form") {
    return (
      <div className={`skeleton-form ${className}`.trim()} role="status" aria-label="Đang tải dữ liệu">
        {Array.from({ length: rows }).map((_, index) => (
          <div className="skeleton-form-row" key={index}>
            <span className="skeleton-line skeleton-line--label" />
            <span className="skeleton-line" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      className={`skeleton-table ${className}`.trim()}
      style={{ "--skeleton-columns": columns }}
      role="status"
      aria-label="Đang tải dữ liệu"
    >
      <div className="skeleton-table-row skeleton-table-row--header">
        {Array.from({ length: columns }).map((_, index) => (
          <span className="skeleton-line" key={index} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div className="skeleton-table-row" key={rowIndex}>
          {Array.from({ length: columns }).map((_, columnIndex) => (
            <span
              className={`skeleton-line ${columnIndex === 0 ? "skeleton-line--wide" : ""}`.trim()}
              key={columnIndex}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export default Skeleton;
