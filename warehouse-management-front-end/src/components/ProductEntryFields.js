import React from "react";
import { formatCurrency, formatQuantity } from "../utils/money";
import "../css/ProductEntryFields.css";

export function ProductEntryField({ label, children, className = "" }) {
  return (
    <div className={`product-entry-field ${className}`.trim()}>
      <span className="product-entry-label">{label}</span>
      {children}
    </div>
  );
}

export function ProductEntryInfo({ product, stockLabel, stockQuantity, showUnit = false }) {
  if (!product) return null;
  return (
    <div className="product-entry-info">
      {showUnit && product.unit && <span>Đơn vị: {product.unit}</span>}
      {stockLabel && stockQuantity != null && (
        <span>{stockLabel}: {formatQuantity(stockQuantity)} {product.unit}</span>
      )}
      {product.default_sale_price != null && (
        <span>Giá bán mặc định: {formatCurrency(product.default_sale_price)}</span>
      )}
    </div>
  );
}
