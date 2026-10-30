import React from "react";
import { createPortal } from "react-dom";
import { formatCurrency, formatQuantity } from "../utils/money";
import "../css/ProductDetailModal.css";

function ProductDetailModal({ product, canEdit = false, onClose, onEdit }) {
  const quantities = [
    { label: "Tồn kho hiện tại", value: product.available_stock },
    { label: "Đã nhập", value: product.total_imported },
    { label: "Đã bán", value: product.total_sold },
    { label: "Đã hư", value: product.total_damaged },
    { label: "Đã cấp đi", value: product.total_transferred },
  ];

  return createPortal(
    <div className="product-detail-overlay">
      <section
        className="product-detail-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-detail-title"
      >
        <header className="product-detail-header">
          <div>
            <p className="product-detail-eyebrow">Chi tiết sản phẩm</p>
            <h2 id="product-detail-title">{product.name}</h2>
          </div>
          <button type="button" className="product-detail-close" onClick={onClose} aria-label="Đóng chi tiết sản phẩm">×</button>
        </header>

        <div className="product-detail-body">
          <section className="product-detail-section" aria-labelledby="product-detail-info-title">
            <h3 id="product-detail-info-title">Thông tin sản phẩm</h3>
            <dl className="product-detail-facts">
              <div><dt>Đơn vị tính:</dt><dd>{product.unit}</dd></div>
              <div><dt>Giá bán mặc định:</dt><dd>{formatCurrency(product.default_sale_price)}</dd></div>
            </dl>
          </section>

          <section className="product-detail-section" aria-labelledby="product-detail-movement-title">
            <h3 id="product-detail-movement-title">Thông tin số lượng trong kho</h3>
            <dl className="product-detail-movements">
              {quantities.map((item) => (
                <div key={item.label}>
                  <dt>{item.label}:</dt>
                  <dd>{formatQuantity(item.value)}{item.label === "Tồn kho hiện tại" ? ` ${product.unit}` : ""}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>

        <footer className="product-detail-actions">
          <button type="button" onClick={onClose}>Đóng</button>
          {canEdit && <button type="button" className="product-detail-edit" onClick={onEdit}>Chỉnh sửa sản phẩm</button>}
        </footer>
      </section>
    </div>,
    document.body,
  );
}

export default ProductDetailModal;
