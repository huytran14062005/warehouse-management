import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { authApis, endpoints } from "../configs/Apis";
import { getApiError } from "../utils/apiError";
import useNotificationState from "../utils/useNotificationState";
import { getInventoryStatus } from "../utils/inventoryStatus";
import { INVENTORY_CHANGED_EVENT } from "../utils/inventoryEvents";
import { digitsOnly, formatMoneyInput } from "../utils/money";
import AutoDismissMessage from "../components/AutoDismissMessage";
import SharedSearchableDropdown from "../components/SearchableDropdown";
import Pagination from "../components/Pagination";
import Skeleton from "../components/Skeleton";
import "../css/Products.css";
import "../css/WarehouseOperations.css";

const PER_PAGE = 10;

const INVENTORY_STATUS_OPTIONS = [
  { value: "", label: "Tất cả trạng thái" },
  { value: "available", label: "Còn hàng" },
  { value: "low", label: "Sắp hết hàng" },
  { value: "empty", label: "Hết hàng" },
];

function formatCurrency(value) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatQuantity(value) {
  return new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 3,
  }).format(Number(value || 0));
}

function validatePriceRange(minPrice, maxPrice) {
  const minText = String(minPrice || "").trim();
  const maxText = String(maxPrice || "").trim();
  const minValue = Number(minText);
  const maxValue = Number(maxText);

  if (minText && (!Number.isFinite(minValue) || minValue < 0)) {
    return "Giá từ phải là số không âm.";
  }
  if (maxText && (!Number.isFinite(maxValue) || maxValue < 0)) {
    return "Giá đến phải là số không âm.";
  }
  if (minText && maxText && minValue > maxValue) {
    return "Giá từ không được lớn hơn giá đến.";
  }
  return "";
}

function ProductEditor({ request, product, onClose, onSaved }) {
  const editing = Boolean(product?.id);
  const source = product || request;
  const [name, setName] = useState(source?.name || "");
  const [unit, setUnit] = useState(source?.unit || "");
  const [price, setPrice] = useState(product ? String(product.default_sale_price || "") : "");
  const [note, setNote] = useState(request?.note || "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (!name.trim() || !unit.trim()) {
      setError("Vui lòng nhập tên sản phẩm và đơn vị tính.");
      return;
    }
    try {
      setSaving(true);
      const payload = {
        name: name.trim(),
        unit: unit.trim(),
        default_sale_price: Number(price || 0),
      };
      if (editing) await authApis().put(endpoints.productDetail(product.id), payload);
      else await authApis().post(endpoints.products, { ...payload, note: note.trim(), request_id: request?.id || null });
      onSaved();
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="warehouse-modal-overlay">
      <div className="warehouse-modal warehouse-editor-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <div className="warehouse-modal-header">
          <div>
            <h2>{editing ? "Chỉnh sửa sản phẩm" : request ? "Xử lý yêu cầu thêm sản phẩm" : "Thêm sản phẩm"}</h2>
            {request && <small>Người gửi: {request.requested_by?.full_name} ({request.requested_by?.role})</small>}
          </div>
          <button type="button" className="warehouse-modal-close" onClick={onClose} aria-label="Đóng">×</button>
        </div>
        <form className="warehouse-modal-body" onSubmit={submit}>
          <AutoDismissMessage message={error} className="warehouse-error" />
          <label className="warehouse-field">
            <span>Tên sản phẩm</span>
            <input value={name} onChange={(event) => setName(event.target.value)} required autoFocus />
          </label>
          <label className="warehouse-field">
            <span>Đơn vị tính</span>
            <input value={unit} onChange={(event) => setUnit(event.target.value)} placeholder="Ví dụ: Cái, Hộp, Kg" required />
          </label>
          <label className="warehouse-field">
            <span>Giá bán mặc định</span>
            <input type="text" inputMode="numeric" value={formatMoneyInput(price)} onChange={(event) => setPrice(digitsOnly(event.target.value))} placeholder="0" />
          </label>
          {!editing && <label className="warehouse-field">
            <span>Ghi chú</span>
            <textarea rows="3" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Thông tin thêm về sản phẩm" />
          </label>}
          <div className="warehouse-modal-actions">
            <button type="button" onClick={onClose} disabled={saving}>Hủy</button>
            <button type="submit" className="warehouse-primary-button" disabled={saving}>{saving ? "Đang lưu..." : editing ? "Lưu thay đổi" : "Thêm sản phẩm"}</button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}

function ProductDetail({ product, canEdit, onClose, onEdit }) {
  return createPortal(
    <div className="warehouse-modal-overlay">
      <div className="warehouse-modal product-detail-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <div className="warehouse-modal-header">
          <div>
            <p className="product-detail-eyebrow">CHI TIẾT SẢN PHẨM</p>
            <h2>{product.name}</h2>
          </div>
          <button type="button" className="warehouse-modal-close" onClick={onClose} aria-label="Đóng">×</button>
        </div>
        <div className="warehouse-modal-body">
          <div className="product-detail-summary">
            <div><span>Đơn vị tính</span><strong>{product.unit}</strong></div>
            <div><span>Giá bán mặc định</span><strong>{formatCurrency(product.default_sale_price)}</strong></div>
            <div><span>Tồn kho</span><strong>{formatQuantity(product.available_stock)}</strong></div>
          </div>
          <div className="product-detail-stats">
            <div><span>Đã nhập</span><strong>{formatQuantity(product.total_imported)}</strong></div>
            <div><span>Đã bán</span><strong>{formatQuantity(product.total_sold)}</strong></div>
            <div><span>Đã hư</span><strong>{formatQuantity(product.total_damaged)}</strong></div>
            <div><span>Đã cấp đi</span><strong>{formatQuantity(product.total_transferred)}</strong></div>
          </div>
          <h3 className="product-detail-section-title">Tồn theo kho</h3>
          {product.warehouses?.length ? (
            <div className="product-detail-warehouse-list">
              {product.warehouses.map((warehouse) => (
                <div key={warehouse.warehouse_id} className="product-detail-warehouse-row">
                  <span>{warehouse.warehouse_name}</span>
                  <strong>{formatQuantity(warehouse.stock)} {product.unit}</strong>
                </div>
              ))}
            </div>
          ) : <p className="product-detail-empty">Chưa có phát sinh tồn kho.</p>}
          <div className="warehouse-modal-actions">
            <button type="button" onClick={onClose}>Đóng</button>
            {canEdit && <button type="button" className="warehouse-primary-button" onClick={onEdit}>Chỉnh sửa sản phẩm</button>}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Products() {
  const navigate = useNavigate();
  const location = useLocation();
  const [products, setProducts] = useState([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [minPriceInput, setMinPriceInput] = useState("");
  const [maxPriceInput, setMaxPriceInput] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [statusInput, setStatusInput] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useNotificationState();
  const [validationWarning, setValidationWarning] = useNotificationState();
  const debounceTimerRef = useRef(null);

  const currentUser = (() => {
    try {
      return JSON.parse(localStorage.getItem("user")) || {};
    } catch {
      return {};
    }
  })();
  const canExportPriceList = ["kế toán", "quản lý"].includes(currentUser.role);
  const canCreateProducts = currentUser.role === "quản lý";
  const [exportingPdf, setExportingPdf] = useState(false);
  const [productEditor, setProductEditor] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const productRequestId = new URLSearchParams(location.search).get("product_request_id");

  const openProductDetail = async (product) => {
    setSelectedProduct(null);
    setDetailLoading(true);
    try {
      const response = await authApis().get(endpoints.productDetail(product.id));
      setSelectedProduct(response.data?.product || product);
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setDetailLoading(false);
    }
  };

  const fetchProducts = useCallback(async () => {
    if (!localStorage.getItem("token")) {
      navigate("/login", {
        replace: true,
        state: { message: "Vui lòng đăng nhập để xem tồn kho." },
      });
      return;
    }

    try {
      setLoading(true);
      setError("");
      const response = await authApis().get(endpoints.productsInventory, {
        params: {
          page,
          per_page: PER_PAGE,
          keyword: keyword || undefined,
          min_price: minPrice || undefined,
          max_price: maxPrice || undefined,
          status: status || undefined,
        },
      });

      const data = response.data || {};
      const responsePagination = data.pagination || {};
      setProducts(data.products || []);
      setPagination({
        total: Number(responsePagination.total || 0),
        totalPages: Number(responsePagination.total_pages || 1),
      });
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setLoading(false);
    }
  }, [keyword, maxPrice, minPrice, navigate, page, status]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    const refreshProducts = () => fetchProducts();
    window.addEventListener(INVENTORY_CHANGED_EVENT, refreshProducts);
    return () => window.removeEventListener(INVENTORY_CHANGED_EVENT, refreshProducts);
  }, [fetchProducts]);

  useEffect(() => {
    if (!canCreateProducts || !productRequestId) return undefined;
    let cancelled = false;
    authApis().get(endpoints.productRequests)
      .then((response) => {
        if (cancelled) return;
        const request = (response.data?.requests || []).find((item) => String(item.id) === String(productRequestId));
        if (request) {
          setProductEditor(request);
        } else {
          setError("Yêu cầu sản phẩm không còn ở trạng thái chờ xử lý.");
        }
      })
      .catch((requestError) => {
        if (!cancelled) setError(getApiError(requestError));
      });
    return () => {
      cancelled = true;
    };
  }, [canCreateProducts, productRequestId, setError]);

  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      const value = keywordInput.trim();
      const minValue = minPriceInput.trim();
      const maxValue = maxPriceInput.trim();
      const statusValue = statusInput.trim();
      const warning = validatePriceRange(minValue, maxValue);

      if (warning) {
        setValidationWarning(warning);
        return;
      }

      if (
        value === keyword &&
        minValue === minPrice &&
        maxValue === maxPrice &&
        statusValue === status
      )
        return;

      setValidationWarning("");
      setPage(1);
      setKeyword(value);
      setMinPrice(minValue);
      setMaxPrice(maxValue);
      setStatus(statusValue);
    }, 500);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [keywordInput, keyword, maxPrice, maxPriceInput, minPrice, minPriceInput, status, statusInput]);

  const handleSearch = (event) => {
    event.preventDefault();
    const warning = validatePriceRange(minPriceInput, maxPriceInput);
    if (warning) {
      setValidationWarning(warning);
      return;
    }

    setValidationWarning("");
    setPage(1);
    setKeyword(keywordInput.trim());
    setMinPrice(minPriceInput.trim());
    setMaxPrice(maxPriceInput.trim());
    setStatus(statusInput.trim());
  };

  const handleExportPriceList = async () => {
    try {
      setExportingPdf(true);
      setError("");
      const response = await authApis().get(endpoints.priceListExport, {
        params: {
          format: "pdf",
          keyword: keyword || undefined,
          min_price: minPrice || undefined,
          max_price: maxPrice || undefined,
          status: status || undefined,
        },
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = "bang_bao_gia.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (requestError) {
      if (requestError.response?.data instanceof Blob) {
        try {
          const payload = JSON.parse(await requestError.response.data.text());
          setError(payload.error || "Không thể xuất bảng báo giá.");
        } catch {
          setError("Không thể xuất bảng báo giá.");
        }
      } else {
        setError(getApiError(requestError));
      }
    } finally {
      setExportingPdf(false);
    }
  };

  const handlePageChange = (nextPage) => {
    if (nextPage < 1 || nextPage > pagination.totalPages || nextPage === page) {
      return;
    }
    setPage(nextPage);
  };

  return (
    <div className="products-page">
      <div className="products-header">
        <div>
          <h1>Danh sách sản phẩm</h1>
        </div>
        {(canExportPriceList || canCreateProducts) && (
          <div className="products-export-actions" aria-label="Xuất bảng báo giá">
            {canCreateProducts && (
              <button type="button" className="products-export-button products-export-button-primary" onClick={() => setProductEditor("new")}>
                + Thêm sản phẩm
              </button>
            )}
            {canExportPriceList && (
            <button
              type="button"
              className="products-export-button products-export-button-primary"
              disabled={exportingPdf}
              onClick={handleExportPriceList}
            >
              {exportingPdf ? "Đang xuất..." : "Xuất PDF"}
            </button>
            )}
          </div>
        )}
      </div>

      <form className="products-toolbar" onSubmit={handleSearch}>
        <input
          type="search"
          value={keywordInput}
          onChange={(event) => setKeywordInput(event.target.value)}
          placeholder="Tìm theo tên sản phẩm"
          aria-label="Tìm kiếm sản phẩm"
        />
        <label className="products-price-field">
          <input
            type="text"
            inputMode="numeric"
            value={formatMoneyInput(minPriceInput)}
            onChange={(event) => setMinPriceInput(digitsOnly(event.target.value))}
            placeholder="Giá từ"
            aria-label="Giá từ"
            aria-invalid={Boolean(validationWarning)}
          />
        </label>
        <label className="products-price-field">
          <input
            type="text"
            inputMode="numeric"
            value={formatMoneyInput(maxPriceInput)}
            onChange={(event) => setMaxPriceInput(digitsOnly(event.target.value))}
            placeholder="Giá đến"
            aria-label="Giá đến"
            aria-invalid={Boolean(validationWarning)}
          />
        </label>
        <div className="products-status-dropdown">
          <SharedSearchableDropdown
            value={statusInput}
            options={INVENTORY_STATUS_OPTIONS}
            placeholder="Tất cả trạng thái"
            onChange={(value) => {
              setStatusInput(String(value));
              setPage(1);
            }}
            ariaLabel="Lọc theo trạng thái tồn kho"
          />
        </div>
        <button type="submit">Tìm kiếm</button>
      </form>

      <AutoDismissMessage message={validationWarning} type="warning" className="products-validation-warning" />
      <AutoDismissMessage message={error} className="products-alert" />

      <div className="products-card">
        {loading ? (
          <Skeleton rows={6} columns={9} />
        ) : products.length === 0 ? (
          <div className="products-state">Không có sản phẩm phù hợp.</div>
        ) : (
          <div className="products-table-wrapper">
            <table className="products-table">
              <thead>
                <tr>
                  <th>Sản phẩm</th>
                  <th>Đơn vị</th>
                  <th className="products-money">Giá bán mặc định</th>
                  <th className="products-number">Đã nhập</th>
                  <th className="products-number">Đã bán</th>
                  <th className="products-number">Đã hư</th>
                  <th className="products-number">Đã cấp đi</th>
                  <th className="products-number">Tồn kho</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => {
                  const inventoryStatus = getInventoryStatus(
                    product.available_stock,
                    product.total_imported,
                  );
                  return (
                  <tr
                    key={product.id}
                    className="products-clickable-row"
                    onClick={() => openProductDetail(product)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") openProductDetail(product);
                    }}
                    tabIndex="0"
                    role="button"
                    aria-label={`Xem chi tiết ${product.name}`}
                  >
                    <td className="products-name">{product.name}</td>
                    <td>{product.unit}</td>
                    <td className="products-money">
                      {formatCurrency(product.default_sale_price)}
                    </td>
                    <td className="products-number">
                      {formatQuantity(product.total_imported)}
                    </td>
                    <td className="products-number">
                      {formatQuantity(product.total_sold)}
                    </td>
                    <td className="products-number">
                      {formatQuantity(product.total_damaged)}
                    </td>
                    <td className="products-number">
                      {formatQuantity(product.total_transferred)}
                    </td>
                    <td className="products-number products-stock">
                      {formatQuantity(product.available_stock)}
                    </td>
                    <td>
                      <span className={`products-stock-status is-${inventoryStatus.key}`}>
                        {inventoryStatus.label}
                      </span>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Pagination page={page} totalPages={pagination.totalPages} onPageChange={handlePageChange} disabled={loading} />
      {selectedProduct && !detailLoading && (
        <ProductDetail
          product={selectedProduct}
          canEdit={canCreateProducts}
          onClose={() => setSelectedProduct(null)}
          onEdit={() => {
            setProductEditor({ product: selectedProduct });
            setSelectedProduct(null);
          }}
        />
      )}
      {productEditor && (
        <ProductEditor
          request={productEditor === "new" ? null : productEditor.product ? null : productEditor}
          product={productEditor.product || null}
          onClose={() => {
            setProductEditor(null);
            if (productRequestId) navigate("/products", { replace: true });
          }}
          onSaved={() => {
            setProductEditor(null);
            setError("");
            fetchProducts();
            if (productRequestId) navigate("/products", { replace: true });
          }}
        />
      )}
    </div>
  );
}

export default Products;
