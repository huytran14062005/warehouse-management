import React, { useEffect, useState } from "react";
import { authApis, endpoints } from "../configs/Apis";
import { getApiError } from "../utils/apiError";
import useNotificationState from "../utils/useNotificationState";
import { notifyInventoryChanged } from "../utils/inventoryEvents";
import AutoDismissMessage from "../components/AutoDismissMessage";
import SharedSearchableDropdown from "../components/SearchableDropdown";
import ProductRequestModal from "../components/ProductRequestModal";
import Pagination from "../components/Pagination";
import Skeleton from "../components/Skeleton";
import "../css/StockTransfers.css";
import "../css/WarehouseOperations.css";

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
}

function formatTransferProducts(transfer) {
  return (transfer.items || [])
    .map((item) => `${item.product_name} (${item.quantity})`)
    .join(", ") || "—";
}

function StockTransfers() {
  const [employees, setEmployees] = useState([]);
  const [products, setProducts] = useState([]);
  const [employeeId, setEmployeeId] = useState("");
  const [items, setItems] = useState([]);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useNotificationState();
  const [success, setSuccess] = useNotificationState();
  const [transfers, setTransfers] = useState([]);
  const [transfersLoading, setTransfersLoading] = useState(true);
  const [transfersPage, setTransfersPage] = useState(1);
  const [transfersPagination, setTransfersPagination] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [productRequestName, setProductRequestName] = useState("");
  const [productRequestOpen, setProductRequestOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loadOptions = async () => {
      try {
        setLoading(true);
        const [employeesResponse, productsResponse] = await Promise.all([
          authApis().get(endpoints.salesEmployees),
          authApis().get(endpoints.productsInventory, {
            params: { page: 1, per_page: 1000 },
          }),
        ]);
        if (cancelled) return;
        setEmployees(employeesResponse.data?.employees || []);
        setProducts(productsResponse.data?.products || []);
      } catch (requestError) {
        if (!cancelled) setError(getApiError(requestError));
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    loadOptions();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadTransfers = async () => {
      try {
        setTransfersLoading(true);
        const response = await authApis().get(endpoints.stockTransfers, {
          params: { page: transfersPage, per_page: 10 },
        });
        if (cancelled) return;
        setTransfers(response.data?.transfers || []);
        setTransfersPagination(response.data?.pagination || null);
      } catch (requestError) {
        if (!cancelled) setError(getApiError(requestError));
      } finally {
        if (!cancelled) setTransfersLoading(false);
      }
    };
    loadTransfers();
    return () => {
      cancelled = true;
    };
  }, [transfersPage]);

  const updateItem = (index, field, value) => {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    );
  };

  const closeEditor = () => {
    if (saving) return;
    setEditorOpen(false);
    setEmployeeId("");
    setItems([]);
    setNote("");
    setError("");
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (!employeeId) {
      setError("Vui lòng chọn nhân viên nhận hàng.");
      return;
    }
    if (items.length === 0) {
      setError("Vui lòng thêm ít nhất một sản phẩm để điều chuyển.");
      return;
    }
    if (items.some((item) => !item.product_id || Number(item.quantity) <= 0)) {
      setError("Vui lòng chọn sản phẩm và nhập số lượng hợp lệ.");
      return;
    }
    const productIds = new Set(items.map((item) => item.product_id));
    if (productIds.size !== items.length) {
      setError("Mỗi sản phẩm chỉ được cấp một lần trong phiếu.");
      return;
    }

    try {
      setSaving(true);
      await authApis().post(endpoints.stockTransfers, {
        employee_id: Number(employeeId),
        items: items.map((item) => ({
          product_id: Number(item.product_id),
          quantity: Number(item.quantity),
        })),
        note: note.trim(),
      });
      notifyInventoryChanged();
      setSuccess("Đã cấp hàng cho nhân viên bán hàng.");
      setEmployeeId("");
      setItems([]);
      setNote("");
      setEditorOpen(false);
      const response = await authApis().get(endpoints.productsInventory, {
        params: { page: 1, per_page: 1000 },
      });
      setProducts(response.data?.products || []);
      const transfersResponse = await authApis().get(endpoints.stockTransfers, {
        params: { page: transfersPage, per_page: 10 },
      });
      setTransfers(transfersResponse.data?.transfers || []);
      setTransfersPagination(transfersResponse.data?.pagination || null);
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setSaving(false);
    }
  };

  const productOptions = [
    { value: "", label: "Chọn sản phẩm" },
    ...products.map((product) => ({
      value: product.id,
      label: product.name,
    })),
  ];

  return (
    <div className="stock-transfers-page">
      <div className="stock-transfers-header">
        <div>
          <h1>Điều chuyển hàng</h1>
        </div>
        <button
          type="button"
          className="warehouse-primary-button stock-transfers-create-button"
          disabled={loading}
          onClick={() => setEditorOpen(true)}
        >
          + Cấp hàng cho nhân viên
        </button>
      </div>

      <AutoDismissMessage message={error} className="stock-transfers-alert" />
      <AutoDismissMessage
        message={success}
        type="success"
        role="status"
        className="stock-transfers-success"
      />

      {loading ? <Skeleton variant="form" rows={4} className="stock-transfers-skeleton" /> : null}

      {editorOpen && (
        <div
          className="warehouse-modal-overlay"
          onClick={closeEditor}
        >
          <div
            className="warehouse-modal stock-transfers-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="warehouse-modal-header">
              <h2>Cấp hàng cho nhân viên</h2>
              <button
                type="button"
                className="warehouse-modal-close"
                onClick={closeEditor}
                aria-label="Đóng cửa sổ cấp hàng"
              >
                ×
              </button>
            </div>
            <form className="warehouse-modal-body stock-transfers-form" onSubmit={submit}>
          <label className="stock-transfers-field">
            <span>Nhân viên nhận hàng</span>
            <SharedSearchableDropdown
              value={employeeId}
              placeholder="Chọn nhân viên bán hàng"
              ariaLabel="Chọn nhân viên nhận hàng"
              onChange={(value) => setEmployeeId(String(value))}
              options={[
                { value: "", label: "Chọn nhân viên bán hàng" },
                ...employees.map((employee) => ({
                  value: employee.id,
                  label: `${employee.full_name} - ${employee.phone}`,
                })),
              ]}
            />
          </label>

          <div className="stock-transfers-section-heading">
            <h2>Sản phẩm cấp đi</h2>
            <button
              type="button"
              onClick={() =>
                setItems((current) => [
                  ...current,
                  { product_id: "", productSearch: "", quantity: "1" },
                ])
              }
            >
              + Thêm sản phẩm
            </button>
          </div>

          <div className="stock-transfers-items">
            {items.map((item, index) => (
              <div
                className="stock-transfers-item"
                key={`${item.product_id || "new"}-${index}`}
              >
                <div className="stock-transfers-product-field">
                  <SharedSearchableDropdown
                    value={item.product_id}
                    placeholder="Chọn sản phẩm"
                    ariaLabel="Chọn sản phẩm cấp đi"
                    searchValue={item.productSearch || ""}
                    onSearchChange={(value) =>
                      updateItem(index, "productSearch", value)
                    }
                    filterLocally
                    emptyLabel="Không tìm thấy sản phẩm."
                    emptyAction={
                      item.productSearch?.trim() ? (
                        <button
                          type="button"
                          className="searchable-dropdown-action"
                          onClick={() => {
                            setProductRequestName(item.productSearch.trim());
                            setProductRequestOpen(true);
                          }}
                        >
                          + Gửi yêu cầu thêm sản phẩm
                        </button>
                      ) : null
                    }
                    onChange={(value, label) => {
                      updateItem(index, "product_id", String(value));
                      updateItem(index, "productSearch", label || "");
                    }}
                    options={productOptions}
                  />
                  {item.product_id &&
                    (() => {
                      const selectedProduct = products.find(
                        (product) =>
                          String(product.id) === String(item.product_id),
                      );
                      if (!selectedProduct) return null;
                      return (
                        <div className="stock-transfers-stock-info">
                          Hàng trong kho còn: {selectedProduct.available_stock}{" "}
                          {selectedProduct.unit}
                        </div>
                      );
                    })()}
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
                  aria-label="Số lượng cấp đi"
                />
                <button
                  type="button"
                  className="stock-transfers-remove"
                  onClick={() =>
                    setItems((current) =>
                      current.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                  aria-label="Xóa sản phẩm"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <label className="stock-transfers-field">
            <span>Ghi chú</span>
            <textarea
              rows="3"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Ví dụ: Điều chuyển hàng cho chuyến bán hàng Đà Nẵng"
            />
          </label>

          <div className="stock-transfers-actions">
            <button type="submit" disabled={saving}>
              {saving ? "Đang lưu..." : "Xác nhận cấp hàng"}
            </button>
          </div>
            </form>
          </div>
        </div>
      )}

      {productRequestOpen && (
        <ProductRequestModal
          initialName={productRequestName}
          onClose={() => setProductRequestOpen(false)}
          onSaved={() => {
            setProductRequestOpen(false);
            setSuccess("Đã gửi yêu cầu thêm sản phẩm đến quản lý.");
          }}
        />
      )}

      <section className="stock-transfers-history">
        <div className="stock-transfers-section-heading">
          <h2>Lịch sử điều chuyển</h2>
          {transfersPagination?.total ? (
            <span className="stock-transfers-count">{transfersPagination.total} phiếu</span>
          ) : null}
        </div>
        {transfersLoading ? (
          <Skeleton rows={6} columns={5} />
        ) : transfers.length === 0 ? (
          <div className="stock-transfers-state">Chưa có phiếu điều chuyển.</div>
        ) : (
          <div className="stock-transfers-history-table-wrap">
            <table className="stock-transfers-history-table">
              <thead>
                <tr>
                  <th>Ngày</th>
                  <th>Mặt hàng</th>
                  <th>Nhân viên</th>
                  <th>Số lượng</th>
                  <th>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map((transfer) => (
                  <tr key={transfer.id}>
                    <td>{formatDate(transfer.transferred_at)}</td>
                    <td>{formatTransferProducts(transfer)}</td>
                    <td>{transfer.employee_name}</td>
                    <td>{transfer.total_quantity}</td>
                    <td>{transfer.note || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination
          page={transfersPage}
          totalPages={Number(transfersPagination?.total_pages || 1)}
          onPageChange={setTransfersPage}
          disabled={loading}
        />
      </section>
    </div>
  );
}

export default StockTransfers;
