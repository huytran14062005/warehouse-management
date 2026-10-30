import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import { authApis, endpoints } from "../configs/Apis";
import { getApiError } from "../utils/apiError";
import useNotificationState from "../utils/useNotificationState";
import { notifyInventoryChanged } from "../utils/inventoryEvents";
import AutoDismissMessage from "../components/AutoDismissMessage";
import MoneyInput from "../components/MoneyInput";
import PaymentMethodDropdown from "../components/PaymentMethodDropdown";
import { ProductEntryField, ProductEntryInfo } from "../components/ProductEntryFields";
import Pagination from "../components/Pagination";
import ConfirmDialog from "../components/ConfirmDialog";
import SharedSearchableDropdown from "../components/SearchableDropdown";
import Skeleton from "../components/Skeleton";
import "../css/WarehouseOperations.css";

const PER_PAGE = 10;
const PAYMENT_HISTORY_PAGE_SIZE = 5;

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

function formatAmount(value) {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function ImportDetail({ invoice, onClose, onEdit, onDelete, canEdit, canDelete, canPay, onPaymentSaved }) {
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [funds, setFunds] = useState(null);
  const [fundsError, setFundsError] = useState("");
  const [paymentHistoryPage, setPaymentHistoryPage] = useState(1);
  const paymentHistory = useMemo(() => [...(invoice.payments || [])].sort((a, b) =>
    (Date.parse(b.paid_at) || 0) - (Date.parse(a.paid_at) || 0) ||
    Number(b.id || 0) - Number(a.id || 0)
  ), [invoice.payments]);
  const paymentHistoryPages = Math.ceil(paymentHistory.length / PAYMENT_HISTORY_PAGE_SIZE);
  const currentHistoryPage = Math.min(paymentHistoryPage, paymentHistoryPages || 1);
  const firstHistoryItem = (currentHistoryPage - 1) * PAYMENT_HISTORY_PAGE_SIZE;
  useEffect(() => { setPaymentHistoryPage(1); }, [invoice.id, invoice.payments?.length]);
  useEffect(() => {
    if (!canPay) return undefined;
    let active = true;
    authApis().get(endpoints.companyFunds).then((response) => {
      if (active) setFunds(response.data);
    }).catch((error) => {
      if (active) setFundsError(getApiError(error));
    });
    return () => { active = false; };
  }, [canPay]);
  const selectedFund = funds?.funds?.find((fund) => fund.method === paymentMethod);
  const availableBalance = Number(selectedFund?.balance || 0);
  const projectedBalance = availableBalance - Number(paymentAmount || 0);
  const recordPayment = async (event) => {
    event.preventDefault();
    const amount = Number(paymentAmount || 0);
    if (!Number.isFinite(amount) || amount < 500) return setPaymentError("Số tiền thanh toán tối thiểu là 500 đ.");
    if (amount > Number(invoice.remaining_amount || 0)) return setPaymentError("Số tiền thanh toán không được vượt quá số còn nợ nhà cung cấp.");
    if (!paymentMethod) return setPaymentError("Vui lòng chọn phương thức thanh toán.");
    if (!funds?.initialized) return setPaymentError("Quản lý cần thiết lập số dư ban đầu trong Sổ quỹ công ty.");
    if (amount > availableBalance) return setPaymentError("Số dư quỹ đã chọn không đủ để trả nhà cung cấp.");
    try {
      setPaymentSaving(true);
      setPaymentError("");
      const response = await authApis().post(endpoints.importInvoicePayments(invoice.id), {
        amount,
        payment_method: paymentMethod,
        note: paymentNote.trim(),
      });
      setPaymentAmount("");
      setPaymentMethod("");
      setPaymentNote("");
      setFunds((current) => current && ({
        ...current,
        funds: current.funds.map((fund) => fund.method === paymentMethod
          ? { ...fund, balance: Number(fund.balance) - amount }
          : fund),
      }));
      onPaymentSaved(response.data?.invoice);
    } catch (requestError) {
      setPaymentError(getApiError(requestError));
    } finally {
      setPaymentSaving(false);
    }
  };
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
              <span>Kho nhập hàng</span>
              <strong>{invoice.warehouse?.name || "—"}</strong>
            </div>
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
          <div className="warehouse-payment-summary">
            <div><span>{"Đã trả nhà cung cấp"}</span><strong>{formatCurrency(invoice.paid_amount)}</strong></div>
            <div><span>{"Còn phải trả"}</span><strong>{formatCurrency(invoice.remaining_amount)}</strong></div>
            <div><span>{"Trạng thái thanh toán"}</span><strong>{invoice.payment_status === "paid" ? "Đã thanh toán" : invoice.payment_status === "partial" ? "Thanh toán một phần" : "Chưa thanh toán"}</strong></div>
          </div>
          {canPay && Number(invoice.remaining_amount || 0) > 0 && (
            <form className="warehouse-payment-form" onSubmit={recordPayment}>
              <h3>{"Ghi nhận trả tiền nhà cung cấp"}</h3>
              <p className="warehouse-payment-guidance">Chỉ ghi nhận sau khi đã trả tiền mặt hoặc chuyển khoản thực tế.</p>
              {fundsError && <p className="warehouse-error">{fundsError}</p>}
              {funds && !funds.initialized && <p className="warehouse-error">Quản lý cần thiết lập số dư ban đầu tại <Link to="/company-funds">Sổ quỹ công ty</Link> trước khi ghi nhận thanh toán.</p>}
              <AutoDismissMessage message={paymentError} className="warehouse-error" />
              <label className="warehouse-field"><span>Số tiền trả nhà cung cấp</span>
                <MoneyInput value={paymentAmount} onChange={setPaymentAmount} label="Số tiền trả nhà cung cấp" allowEmpty maxAmount={Math.min(Number(invoice.remaining_amount || 0), availableBalance || Infinity)} placeholder="Từ 500 đ" />
              </label>
              <label className="warehouse-field"><span>Phương thức thanh toán</span>
                <PaymentMethodDropdown value={paymentMethod} onChange={setPaymentMethod} />
              </label>
              {selectedFund && <div className="warehouse-payment-fund-info">
                <span>Số dư {paymentMethod === "cash" ? "tiền mặt" : "ngân hàng"}: <strong>{formatCurrency(availableBalance)}</strong></span>
                {Number(paymentAmount || 0) > 0 && projectedBalance >= 0 && <span>Sau khi trả: <strong>{formatCurrency(projectedBalance)}</strong></span>}
              </div>}
              {selectedFund && projectedBalance < 0 && <p className="warehouse-error">Số dư quỹ đã chọn không đủ để trả nhà cung cấp.</p>}
              <input value={paymentNote} onChange={(event) => setPaymentNote(event.target.value)} placeholder="Ghi chú (không bắt buộc)" />
              <button type="submit" className="warehouse-primary-button" disabled={paymentSaving || !funds?.initialized || projectedBalance < 0}>{paymentSaving ? "Đang lưu..." : "Ghi nhận đã trả"}</button>
            </form>
          )}
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
          {paymentHistory.length > 0 && (
            <section className="warehouse-payment-history" aria-label="Lịch sử thanh toán nhà cung cấp">
              <div className="warehouse-payment-history-heading">
                <h3>Lịch sử thanh toán nhà cung cấp</h3>
                <span>{paymentHistory.length} giao dịch</span>
              </div>
              {paymentHistory.slice(firstHistoryItem, firstHistoryItem + PAYMENT_HISTORY_PAGE_SIZE).map((payment) => (
                <div key={payment.id} className="warehouse-payment-history-item">
                  <div className="warehouse-payment-history-amount">{formatAmount(payment.amount)}({payment.payment_method === "cash" ? "Tiền mặt" : "Chuyển khoản"})</div>
                  <span>{formatDateTime(payment.paid_at)}</span>
                  {payment.note && <p>{payment.note}</p>}
                </div>
              ))}
              {paymentHistoryPages > 1 && (
                <div className="warehouse-payment-history-pagination">
                  <span>Trang {currentHistoryPage}/{paymentHistoryPages}</span>
                  <div>
                    <button type="button" onClick={() => setPaymentHistoryPage((page) => page - 1)} disabled={currentHistoryPage === 1}>Trước</button>
                    <button type="button" onClick={() => setPaymentHistoryPage((page) => page + 1)} disabled={currentHistoryPage === paymentHistoryPages}>Sau</button>
                  </div>
                </div>
              )}
            </section>
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

function ImportEditor({ invoice, onClose, onSaved, allowNewSupplier = false }) {
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [warehouseId, setWarehouseId] = useState(String(invoice?.warehouse?.id || ""));
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
      authApis().get(endpoints.warehouses),
    ])
      .then(([supplierResponse, productResponse, warehouseResponse]) => {
        if (cancelled) return;
        setSuppliers(supplierResponse.data?.suppliers || []);
        setProducts(productResponse.data?.products || []);
        setWarehouses(warehouseResponse.data?.warehouses || []);
        setWarehouseId((current) => current || String(warehouseResponse.data?.default_warehouse_id || ""));
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
    if (!warehouseId) return setError("Vui lòng chọn kho nhập hàng.");
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
        warehouse_id: Number(warehouseId),
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
              <label className="warehouse-field">
                <span>Kho nhập hàng</span>
                <select value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)} required>
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
                  ))}
                </select>
              </label>
              <div className="warehouse-field">
                <span>Nhà cung cấp</span>
                {allowNewSupplier && (
                  <div className="warehouse-supplier-mode">
                    <button
                      type="button"
                      className={supplierMode === "existing" ? "is-active" : ""}
                      onClick={() => setSupplierMode("existing")}
                    >
                      Nhà cung cấp đã lưu
                    </button>
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
                  </div>
                )}
                {supplierMode === "existing" && (
                  <SharedSearchableDropdown
                    value={supplierId}
                    searchValue={supplierSearchInput}
                    placeholder="Chọn nhà cung cấp"
                    ariaLabel="Chọn nhà cung cấp"
                    searching={supplierSearchLoading}
                    searchingLabel="Đang tìm nhà cung cấp..."
                    emptyLabel={allowNewSupplier
                      ? "Không tìm thấy nhà cung cấp."
                      : "Không có nhà cung cấp phù hợp. Liên hệ quản lý nếu cần thêm mới."}
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
                        <ProductEntryField label="Sản phẩm">
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
                        </ProductEntryField>
                        <ProductEntryInfo product={selectedProduct} showUnit />
                      </div>
                      <ProductEntryField label="Số lượng nhập">
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={item.quantity}
                          onChange={(event) =>
                            updateItem(index, "quantity", event.target.value)
                          }
                          placeholder="Nhập số lượng"
                          aria-label="Số lượng nhập"
                        />
                      </ProductEntryField>
                      <ProductEntryField label="Đơn giá nhập">
                        <MoneyInput
                          value={item.unit_price}
                          onChange={(value) => updateItem(index, "unit_price", value)}
                          label="Đơn giá nhập"
                          placeholder="Nhập đơn giá nhập"
                          aria-label="Đơn giá nhập"
                          required
                        />
                      </ProductEntryField>
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
  const canPayImports = currentUser.role === "kế toán";

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
          <Skeleton rows={6} columns={6} />
        ) : invoices.length === 0 ? (
          <div className="warehouse-state">Chưa có phiếu nhập phù hợp.</div>
        ) : (
          <div className="warehouse-table-wrap">
            <table className="warehouse-table warehouse-clickable-table">
              <thead>
                <tr>
                  <th>Ngày nhập</th>
                  <th>Kho nhập</th>
                  <th>Nhà cung cấp</th>
                  <th>Số sản phẩm</th>
                  <th>Tiền nhập</th>
                  <th>Còn phải trả</th>
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
                    <td>{invoice.warehouse?.name || "—"}</td>
                    <td>
                      <strong>{invoice.supplier?.name || "—"}</strong>
                    </td>
                    <td>{invoice.items_count}</td>
                    <td>{formatCurrency(invoice.total_amount)}</td>
                    <td>{formatCurrency(invoice.remaining_amount)}</td>
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
          canPay={canPayImports}
          onClose={() => setSelected(null)}
          onEdit={(invoice) => {
            setSelected(null);
            setEditor(invoice);
          }}
          onDelete={(invoice) => {
            setDeleteError("");
            setDeletingInvoice(invoice);
          }}
          onPaymentSaved={(invoice) => {
            setSelected(invoice);
            fetchInvoices();
          }}
        />
      )}
      {editor && (
        <ImportEditor
          invoice={editor === "new" ? null : editor}
          allowNewSupplier={currentUser.role === "quản lý"}
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
