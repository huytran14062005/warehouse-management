import React, { useEffect, useRef, useState } from "react";
import "../css/SearchableDropdown.css";

/**
 * Shared searchable dropdown used for every selectable list in the app.
 * When onSearchChange is provided, the parent controls searching (for API-backed lists).
 * Otherwise the options are filtered locally.
 */
function SearchableDropdown({
  value,
  options,
  placeholder,
  onChange,
  ariaLabel,
  searchValue,
  onSearchChange,
  searching = false,
  searchingLabel = "Đang tìm kiếm...",
  emptyLabel = "Không tìm thấy kết quả.",
}) {
  const [open, setOpen] = useState(false);
  const [localSearch, setLocalSearch] = useState("");
  const ref = useRef(null);
  const selected = options.find(
    (option) => String(option.value) === String(value),
  );
  const controlledSearch = typeof onSearchChange === "function";
  const query = controlledSearch ? String(searchValue || "") : localSearch;
  const filteredOptions = controlledSearch || !query.trim()
    ? options
    : options.filter((option) =>
        String(option.label || "").toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
      );

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (!ref.current?.contains(event.target)) {
        setOpen(false);
        if (!controlledSearch) setLocalSearch("");
      }
    };
    const escape = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
        if (!controlledSearch) setLocalSearch("");
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [controlledSearch, open]);

  const handleSearchChange = (event) => {
    const nextValue = event.target.value;
    if (controlledSearch) onSearchChange(nextValue);
    else setLocalSearch(nextValue);
    setOpen(true);
  };

  const handleFocus = (event) => {
    // Selecting the current label lets the user start a new search immediately.
    event.currentTarget.select();
    if (!controlledSearch) setLocalSearch("");
    setOpen(true);
  };

  const handleToggle = () => {
    setOpen((current) => {
      if (!current && !controlledSearch) setLocalSearch("");
      return !current;
    });
  };

  const handleOptionChange = (option) => {
    onChange(option.value, option.label);
    setOpen(false);
    if (!controlledSearch) setLocalSearch("");
  };

  return (
    <div className="searchable-dropdown" ref={ref}>
      <div
        className="searchable-dropdown-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <input
          type="search"
          className="searchable-dropdown-input"
          value={open ? query : selected?.label || ""}
          placeholder={placeholder}
          aria-label={ariaLabel}
          onFocus={handleFocus}
          onChange={handleSearchChange}
        />
        <button
          type="button"
          className="searchable-dropdown-arrow-button"
          aria-label={open ? "Thu gọn danh sách" : "Mở danh sách"}
          onClick={handleToggle}
        >
          <svg
            className={`searchable-dropdown-arrow${open ? " is-open" : ""}`}
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            aria-hidden="true"
          >
            <polyline
              points="6 9 12 15 18 9"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
      {open && (
        <div className="searchable-dropdown-menu" role="listbox" aria-label={ariaLabel}>
          {searching ? (
            <div className="searchable-dropdown-state">{searchingLabel}</div>
          ) : filteredOptions.length ? (
            filteredOptions.map((option) => (
              <button
                type="button"
                role="option"
                aria-selected={String(option.value) === String(value)}
                className={`searchable-dropdown-option${String(option.value) === String(value) ? " is-selected" : ""}`}
                key={String(option.value) || "empty"}
                onClick={() => handleOptionChange(option)}
              >
                {option.label}
              </button>
            ))
          ) : (
            <div className="searchable-dropdown-state">{emptyLabel}</div>
          )}
        </div>
      )}
    </div>
  );
}

export default SearchableDropdown;
