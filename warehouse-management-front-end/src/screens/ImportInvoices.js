import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { authApis, endpoints } from "../configs/Apis";
import { getApiError } from "../utils/apiError";
import useNotificationState from "../utils/useNotificationState";
import { notifyInventoryChanged } from "../utils/inventoryEvents";
import AutoDismissMessage from "../components/AutoDismissMessage";
import MoneyInput from "../components/MoneyInput";
import Pagination from "../components/Pagination";
import ConfirmDialog from "../components/ConfirmDialog";
import SharedSearchableDropdown from "../components/SearchableDropdown";
import Skeleton from "../components/Skeleton";
import "../css/WarehouseOperations.css";

const PER_PAGE = 10;

function toDateInputValue(value) {
  if (value) return String(value).slice(0, 10);
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
}

function ImportDetail({ invoice, onClose, onEdit, onDelete, canEdit, canDelete }) {
  return createPortal(
    <div className="warehouse-modal-overlay">
      <div
        className="warehouse-modal"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="warehouse-modal-header">
          <h2>Chi tiết phiếu nhập #{invoice.id}</h2>
          <button
            type="button"
            className="warehouse-modal-close"
            onClick={onClose}
            aria-label="Đóng"
          >
            ×
          </button>
        </div>
        <div className="warehouse-modal-body">
          <div className="warehouse-info-grid">
            <div>
              <span>Ngày nhập</span>
              <strong>{formatDate(invoice.imported_at)}</strong>
            </div>
            <div>
              <span>Nhà cung cấp</span>
              <strong>{invoice.supplier?.name || "—"}</strong>
            </div>
            <div>
              <span>Người lập</span>
              <strong>{invoice.employee?.full_name || "—"}</strong>
            </div>
            <div>
              <span>Tổng tiền</span>
              <strong>{formatCurrency(invoice.total_amount)}</strong>
            </div>
          </div>
          <h3 className="warehouse-section-title">Sản phẩm nhập</h3>
          <div className="warehouse-table-wrap">
            <table className="warehouse-table">
              <thead>
                <tr>
                  <th>Sản phẩm</th>
                  <th>Đơn vị</th>
                  <th>Số lượng</th>
                  <th>Đơn giá</th>
                  <th>Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                {(invoice.items || []).map((item) => (
                  <tr key={item.id || item.product_id}>
                    <td>{item.product_name}</td>
                    <td>{item.unit}</td>
                    <td>{item.quantity}</td>
                    <td>{formatCurrency(item.unit_price)}</td>
                    <td>{formatCurrency(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {invoice.note && (
            <div className="warehouse-note">
              <span>Ghi chú</span>
              <p>{invoice.note}</p>
            </div>
          )}
          {(canEdit || canDelete) && (
            <div className="warehouse-modal-actions">
              {canEdit && (
                <button type="button" onClick={() => onEdit(invoice)}>
                  Chỉnh sửa phiếu
                </button>
              )}
              {canDelete && (
                <button
                  type="button"
                  className="warehouse-danger-button"
                  onClick={() => onDelete(invoice)}
                >
                  Xóa phiếu
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ImportEditor({ invoice, onClose, onSaved, allowNewSupplier = true }) {
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [supplierId, setSupplierId] = useState(
    String(invoice?.supplier?.id || ""),
  );
  const [supplierMode, setSupplierMode] = useState("existing");
  const [supplierSearchInput, setSupplierSearchInput] = useState(
    invoice?.supplier?.name || "",
  );
  const [supplierSearchLoading, setSupplierSearchLoading] = useState(false);
  const [newSupplier, setNewSupplier] = useState({ name: "", address: "" });
  const [importedAt, setImportedAt] = useState(
    toDateInputValue(invoice?.imported_at),
  );
  const [items, setItems] = useState(
    (invoice?.items || []).map((item) => ({
      product_id: String(item.product_id),
      quantity: String(item.quantity),
      unit_price: String(item.unit_price),
    })),
  );
  const [note, setNote] = useState(invoice?.note || "");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useNotificationState();
  const supplierSearchTimerRef = useRef(null);
  const supplierSearchTouchedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      authApis().get(endpoints.suppliers, { params: { page: 1, per_page: 1000 } }),
      authApis().get(endpoints.productsInventory, {
        params: { page: 1, per_page: 1000 },
      }),
    ])
      .then(([supplierResponse, productResponse]) => {
        if (cancelled) return;
        setSuppliers(supplierResponse.data?.suppliers || []);
        setProducts(productResponse.data?.products || []);
      })
      .catch((requestError) => {
        if (!cancelled) setError(getApiError(requestError));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!supplierSearchTouchedRef.current) return undefined;
    if (supplierSearchTimerRef.current)
      clearTimeout(supplierSearchTimerRef.current);
    let active = true;
    supplierSearchTimerRef.current = setTimeout(async () => {
      try {
        setSupplierSearchLoading(true);
        const response = await authApis().get(endpoints.suppliers, {
          params: { keyword: supplierSearchInput.trim() || undefined },
        });
        if (active) setSuppliers(response.data?.suppliers || []);
      } catch (requestError) {
        if (active) setError(getApiError(requestError));
      } finally {
        if (active) setSupplierSearchLoading(false);
      }
    }, 750);
    return () => {
      active = false;
      if (supplierSearchTimerRef.current)
        clearTimeout(supplierSearchTimerRef.current);
    };
  }, [supplierSearchInput]);

  const updateItem = (index, field, value) =>
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    );
  const addItem = () =>
    setItems((current) => [
      ...current,
      { product_id: "", quantity: "1", unit_price: "" },
    ]);
  const removeItem = (index) =>
    setItems((current) =>
      current.filter((_, itemIndex) => itemIndex !== index),
    );

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (supplierMode === "existing" && !supplierId)
      return setError("Vui lòng chọn nhà cung cấp.");
    if (
      supplierMode === "new" &&
      (!newSupplier.name.trim() || !newSupplier.address.trim())
    )
      return setError("Vui lòng nhập tên và địa chỉ nhà cung cấp mới.");
    if (!importedAt)
      return setError("Vui lòng chọn ngày nhập.");
    if (!items.length)
      return setError("Vui lòng thêm ít nhất một sản phẩm vào phiếu nhập.");
    const productIds = new Set();
    for (const item of items) {
      if (
        !item.product_id ||
        !Number.isInteger(Number(item.quantity)) ||
        Number(item.quantity) <= 0 ||
        !Number.isFinite(Number(item.unit_price)) ||
        Number(item.unit_price) <= 0
      )
        return setError(
          "Vui lòng nhập sản phẩm, số lượng nguyên dương và đơn giá lớn hơn 0.",
        );
      if (productIds.has(item.product_id))
        return setError(
          "Mỗi sản phẩm chỉ được xuất hiện một lần trong phiếu nhập.",
        );
      productIds.add(item.product_id);
    }
    try {
      setSaving(true);
      const payload = {
        supplier_id: supplierMode === "existing" ? Number(supplierId) : null,
        supplier_data:
          supplierMode === "new"
            ? {
                name: newSupplier.name.trim(),
                address: newSupplier.address.trim(),
              }
            : undefined,
        note: note.trim(),
        imported_at: importedAt,
        items: items.map((item) => ({
          product_id: Number(item.product_id),
          quantity: Number(item.quantity),
          unit_price: Number(item.unit_price),
        })),
      };
      const response = invoice?.id
        ? await authApis().put(
            endpoints.importInvoiceDetail(invoice.id),
            payload,
          )
        : await authApis().post(endpoints.importInvoices, payload);
      onSaved(response.data?.invoice);
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="warehouse-modal-overlay">
      <div
        className="warehouse-modal warehouse-editor-modal"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="warehouse-modal-header">
          <h2>
            {invoice
              ? `Chỉnh sửa phiếu nhập #${invoice.id}`
              : "Tạo phiếu nhập kho"}
          </h2>
          <button
            type="button"
            className="warehouse-modal-close"
            onClick={onClose}
            aria-label="Đóng"
          >
            ×
          </button>
        </div>
        <form className="warehouse-modal-body" onSubmit={submit}>
          <AutoDismissMessage message={error} className="warehouse-error" />
          {loading ? (
            <Skeleton variant="form" rows={5} />
          ) : (
            <>
              <div className="warehouse-field">
                <span>Nhà cung cấp</span>
                <div className="warehouse-supplier-mode">
                  <button
                    type="button"
                    className={supplierMode === "existing" ? "is-active" : ""}
                    onClick={() => setSupplierMode("existing")}
                  >
                    Nhà cung cấp đã lưu
                  </button>
                  {allowNewSupplier && (
                    <button
                      type="button"
                      className={supplierMode === "new" ? "is-active" : ""}
                      onClick={() => {
                        setSupplierMode("new");
                        setSupplierId("");
                      }}
                    >
                      Nhà cung cấp mới
                    </button>
                  )}
                </div>
                {supplierMode === "existing" && (
                  <SharedSearchableDropdown
                    value={supplierId}
                    searchValue={supplierSearchInput}
                    placeholder="Chọn nhà cung cấp"
                    ariaLabel="Chọn nhà cung cấp"
                    searching={supplierSearchLoading}
                    searchingLabel="Đang tìm nhà cung cấp..."
                    emptyLabel="Không tìm thấy nhà cung cấp."
                    onSearchChange={(value) => {
                      supplierSearchTouchedRef.current = true;
                      setSupplierSearchInput(value);
                      setSupplierId("");
                      setSuppliers([]);
                      setSupplierSearchLoading(true);
                    }}
                    onChange={(value, label) => {
                      supplierSearchTouchedRef.current = false;
                      setSupplierId(String(value));
                      setSupplierSearchInput(label);
                    }}
                    options={suppliers.map((supplier) => ({
                      value: supplier.id,
                      label: supplier.name,
                    }))}
                  />
                )}
              </div>
              {allowNewSupplier && supplierMode === "new" && (
                <div className="warehouse-new-supplier-fields">
                  <input
                    value={newSupplier.name}
                    onChange={(event) =>
                      setNewSupplier((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    placeholder="Tên nhà cung cấp"
                    aria-label="Tên nhà cung cấp mới"
                  />
                  <input
                    value={newSupplier.address}
                    onChange={(event) =>
                      setNewSupplier((current) => ({
                        ...current,
                        address: event.target.value,
                      }))
                    }
                    placeholder="Địa chỉ nhà cung cấp"
                    aria-label="Địa chỉ nhà cung cấp mới"
                  />
                </div>
              )}
              <label className="warehouse-field">
                <span>Ngày nhập</span>
                <input
                  type="date"
                  value={importedAt}
                  onChange={(event) => setImportedAt(event.target.value)}
                  aria-label="Ngày nhập kho"
                  required
                />
              </label>
              <div className="warehouse-section-heading">
                <h3>Sản phẩm nhập</h3>
                <button type="button" onClick={addItem}>
                  + Thêm sản phẩm
                </button>
              </div>
              <div className="warehouse-editor-items">
                {items.map((item, index) => {
                  const selectedProduct = products.find(
                    (product) => String(product.id) === String(item.product_id),
                  );
                  return (
                    <div
                      className="warehouse-editor-item"
                      key={`${item.product_id || "new"}-${index}`}
                    >
                      <div className="warehouse-product-field">
                        <SharedSearchableDropdown
                          value={item.product_id}
                          placeholder="Chọn sản phẩm"
                          ariaLabel="Chọn sản phẩm nhập"
                          onChange={(value) =>
                            updateItem(index, "product_id", String(value))
                          }
                          options={[
                            { value: "", label: "Chọn sản phẩm" },
                            ...products.map((product) => ({
                              value: product.id,
                              label: product.name,
                            })),
                          ]}
                        />
                        {selectedProduct && (
                          <small>Đơn vị: {selectedProduct.unit}</small>
                        )}
                      </div>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={item.quantity}
                        onChange={(event) =>
                          updateItem(index, "quantity", event.target.value)
                        }
                        placeholder="Số lượng"
                        aria-label="Số lượng nhập"
                      />
                      <MoneyInput
                        value={item.unit_price}
                        onChange={(value) => updateItem(index, "unit_price", value)}
                        label="Đơn giá"
                        placeholder="Đơn giá từ 500 đ"
                        aria-label="Đơn giá nhập"
                        required
                      />
                      <button
                        type="button"
                        className="warehouse-remove"
                        onClick={() => removeItem(index)}
                        aria-label="Xóa sản phẩm"
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
              <label className="warehouse-field">
                <span>Ghi chú</span>
                <textarea
                  rows="3"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Nhập ghi chú cho phiếu nhập"
                />
              </label>
              <div className="warehouse-modal-actions">
                <button type="button" onClick={onClose} disabled={saving}>
                  Hủy
                </button>
                <button
                  type="submit"
                  className="warehouse-primary-button"
                  disabled={saving}
                >
                  {saving ? "Đang lưu..." : "Lưu phiếu nhập"}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>,
    document.body,
  );
}

function ImportInvoices() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, total_pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useNotificationState();
  const [selected, setSelected] = useState(null);
  const [editor, setEditor] = useState(null);
  const [deletingInvoice, setDeletingInvoice] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const debounceRef = useRef(null);
  const currentUser = (() => {
    try {
      return JSON.parse(localStorage.getItem("user")) || {};
    } catch {
      return {};
    }
  })();
  const canCreateImports = ["thủ kho", "quản lý"].includes(currentUser.role);
  const canEditImports = ["thủ kho", "kế toán", "quản lý"].includes(currentUser.role);
  const canDeleteImports = currentUser.role === "quản lý";

  const fetchInvoices = useCallback(async () => {
    if (!localStorage.getItem("token"))
      return navigate("/login", {
        replace: true,
        state: { message: "Vui lòng đăng nhập để xem phiếu nhập kho." },
      });
    try {
      setLoading(true);
      setError("");
      const response = await authApis().get(endpoints.importInvoices, {
        params: { page, per_page: PER_PAGE, keyword: keyword || undefined },
      });
      setInvoices(response.data?.invoices || []);
      setPagination(response.data?.pagination || { total: 0, total_pages: 1 });
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setLoading(false);
    }
  }, [keyword, navigate, page]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const value = keywordInput.trim();
      if (value !== keyword) {
        setPage(1);
        setKeyword(value);
      }
    }, 500);
    return () => clearTimeout(debounceRef.current);
  }, [keyword, keywordInput]);

  const openDetail = async (invoiceId) => {
    try {
      setError("");
      const response = await authApis().get(
        endpoints.importInvoiceDetail(invoiceId),
      );
      setSelected(response.data);
    } catch (requestError) {
      setError(getApiError(requestError));
    }
  };
  const handleSaved = () => {
    setEditor(null);
    setSelected(null);
    notifyInventoryChanged();
    fetchInvoices();
  };
  const handleDeleteImport = async () => {
    if (!deletingInvoice) return;
    try {
      setDeleteLoading(true);
      setError("");
      setDeleteError("");
      await authApis().delete(endpoints.importInvoiceDelete(deletingInvoice.id));
      setDeletingInvoice(null);
      setSelected(null);
      notifyInventoryChanged();
      await fetchInvoices();
    } catch (requestError) {
      const message = getApiError(requestError);
      setDeleteError(message);
      setError("");
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="warehouse-page">
      <div className="warehouse-page-header">
        <div>
          <h1>Phiếu nhập kho</h1>
        </div>
        {canCreateImports && (
          <button
            type="button"
            className="warehouse-primary-button"
            onClick={() => setEditor("new")}
          >
            + Tạo phiếu nhập
          </button>
        )}
      </div>
      <div className="warehouse-toolbar">
        <input
          type="search"
          value={keywordInput}
          onChange={(event) => setKeywordInput(event.target.value)}
          placeholder="Tìm theo nhà cung cấp hoặc mã phiếu"
          aria-label="Tìm phiếu nhập"
        />
      </div>
      <AutoDismissMessage message={error} className="warehouse-error" />
      <div className="warehouse-card">
        {loading ? (
          <Skeleton rows={6} columns={5} />
        ) : invoices.length === 0 ? (
          <div className="warehouse-state">Chưa có phiếu nhập phù hợp.</div>
        ) : (
          <div className="warehouse-table-wrap">
            <table className="warehouse-table warehouse-clickable-table">
              <thead>
                <tr>
                  <th>Ngày nhập</th>
                  <th>Nhà cung cấp</th>
                  <th>Số sản phẩm</th>
                  <th>Tổng tiền</th>
                  <th>Người lập</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr
                    key={invoice.id}
                    tabIndex="0"
                    onClick={() => openDetail(invoice.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") openDetail(invoice.id);
                    }}
                  >
                    <td>{formatDate(invoice.imported_at)}</td>
                    <td>
                      <strong>{invoice.supplier?.name || "—"}</strong>
                    </td>
                    <td>{invoice.items_count}</td>
                    <td>{formatCurrency(invoice.total_amount)}</td>
                    <td>{invoice.employee?.full_name || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <Pagination
        page={page}
        totalPages={Number(pagination.total_pages || 1)}
        onPageChange={setPage}
        disabled={loading}
      />
      {selected && (
        <ImportDetail
          invoice={selected}
          canEdit={canEditImports}
          canDelete={canDeleteImports}
          onClose={() => setSelected(null)}
          onEdit={(invoice) => {
            setSelected(null);
            setEditor(invoice);
          }}
          onDelete={(invoice) => {
            setDeleteError("");
            setDeletingInvoice(invoice);
          }}
        />
      )}
      {editor && (
        <ImportEditor
          invoice={editor === "new" ? null : editor}
          allowNewSupplier={canCreateImports}
          onClose={() => setEditor(null)}
          onSaved={handleSaved}
        />
      )}
      <ConfirmDialog
        open={Boolean(deletingInvoice)}
        title="Xóa phiếu nhập kho?"
        message={
          deleteError ||
          (deletingInvoice
            ? `Phiếu nhập #${deletingInvoice.id} sẽ bị xóa cùng các dòng hàng và cập nhật lại tồn kho. Bạn có chắc muốn tiếp tục không?`
            : "")
        }
        confirmLabel="Xóa phiếu"
        cancelLabel="Hủy"
        danger
        loading={deleteLoading}
        onCancel={() => {
          if (!deleteLoading) {
            setDeleteError("");
            setDeletingInvoice(null);
          }
        }}
        onConfirm={handleDeleteImport}
      />
    </div>
  );
}

export default ImportInvoices;
