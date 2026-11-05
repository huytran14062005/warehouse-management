import React from "react";
import { formatCurrency, formatQuantity } from "../utils/money";
import SearchableDropdown from "./SearchableDropdown";
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

export function ProductEntrySelector({
  products,
  product,
  value,
  onChange,
  ariaLabel,
  stockLabel,
  stockQuantity,
  showUnit = false,
}) {
  return (
    <div className="warehouse-product-field">
      <ProductEntryField label="Sản phẩm">
        <SearchableDropdown
          value={value}
          placeholder="Chọn sản phẩm"
          ariaLabel={ariaLabel}
          onChange={onChange}
          options={[
            { value: "", label: "Chọn sản phẩm" },
            ...products.map((entry) => ({
              value: entry.id,
              label: entry.name,
            })),
          ]}
        />
      </ProductEntryField>
      <ProductEntryInfo
        product={product}
        stockLabel={stockLabel}
        stockQuantity={stockQuantity}
        showUnit={showUnit}
      />
    </div>
  );
}
