import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { authApis, endpoints } from "../configs/Apis";
import { getApiError } from "../utils/apiError";
import useNotificationState from "../utils/useNotificationState";
import { getInventoryStatus } from "../utils/inventoryStatus";
import { INVENTORY_CHANGED_EVENT } from "../utils/inventoryEvents";
import AutoDismissMessage from "../components/AutoDismissMessage";
import Pagination from "../components/Pagination";
import Skeleton from "../components/Skeleton";
import "../css/WarehouseOperations.css";

function getDateBefore(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function WarehouseReports() {
  const navigate = useNavigate();
  const [fromDate, setFromDate] = useState(getDateBefore(30));
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10));
  const [report, setReport] = useState(null);
  const [inventoryProducts, setInventoryProducts] = useState([]);
  const [lowStockPercentage, setLowStockPercentage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useNotificationState();
  const [productKeyword, setProductKeyword] = useState("");
  const [productPage, setProductPage] = useState(1);
  const [productPagination, setProductPagination] = useState({ total: 0, total_pages: 1 });

  const loadReport = useCallback(
    async (event) => {
      event?.preventDefault();
      if (fromDate && toDate && fromDate > toDate) {
        setError("Từ ngày không được lớn hơn đến ngày.");
        return;
      }
      try {
        setLoading(true);
        setError("");
        const [movementsResponse, inventoryResponse] = await Promise.all([
          authApis().get(endpoints.reportsMovements, {
            params: {
              source: "central",
              from_date: fromDate || undefined,
              to_date: toDate || undefined,
              page: productPage,
              per_page: 10,
              keyword: productKeyword.trim() || undefined,
            },
          }),
          authApis().get(endpoints.reportsInventory, {
            params: { source: "central" },
          }),
        ]);
        setReport(movementsResponse.data || {});
        setProductPagination(movementsResponse.data?.pagination || { total: 0, total_pages: 1 });
        setInventoryProducts(inventoryResponse.data?.products || []);
        setLowStockPercentage(inventoryResponse.data?.low_stock_percentage ?? null);
      } catch (requestError) {
        setError(getApiError(requestError));
      } finally {
        setLoading(false);
      }
    },
    [fromDate, productKeyword, productPage, setError, toDate],
  );

  useEffect(() => {
    if (!localStorage.getItem("token")) {
      navigate("/login", {
        replace: true,
        state: { message: "Vui lòng đăng nhập để xem báo cáo kho." },
      });
      return undefined;
    }
    loadReport();
    return undefined;
  }, [loadReport, navigate]);

  useEffect(() => {
    const refreshReport = () => loadReport();
    window.addEventListener(INVENTORY_CHANGED_EVENT, refreshReport);
    return () =>
      window.removeEventListener(INVENTORY_CHANGED_EVENT, refreshReport);
  }, [loadReport]);

  const summary = report?.summary || {};
  const productRows = report?.by_product || [];
  const inventoryByProductId = new Map(
    inventoryProducts.map((product) => [String(product.id), product]),
  );
  const productRowsWithInventory = productRows.map((product) => ({
    ...product,
    total_imported:
      inventoryByProductId.get(String(product.product_id))?.total_imported ??
      product.total_imported,
    current_stock:
      inventoryByProductId.get(String(product.product_id))?.available_stock ??
      product.current_stock,
  }));
  const productTotalPages = Number(productPagination.total_pages || 1);
  const safeProductPage = Math.min(productPage, productTotalPages);
  const visibleProducts = productRowsWithInventory;
  const currentStockQuantity = inventoryProducts.reduce(
    (total, product) => total + Number(product.available_stock || 0),
    0,
  );
  const outOfStockCount = inventoryProducts.filter(
    (product) => Number(product.available_stock || 0) <= 0,
  ).length;
  const lowStockCount = inventoryProducts.filter(
    (product) =>
      getInventoryStatus(product.available_stock, product.total_imported, lowStockPercentage)
        .key === "low",
  ).length;
  return (
    <div className="warehouse-page">
      <div className="warehouse-page-header">
        <div>
          <h1>Báo cáo nhập – xuất kho</h1>
        </div>
      </div>
      <form className="warehouse-report-filter" onSubmit={loadReport}>
        <label>
          <span>Từ ngày</span>
          <input
            type="date"
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
          />
        </label>
        <label>
          <span>Đến ngày</span>
          <input
            type="date"
            value={toDate}
            onChange={(event) => setToDate(event.target.value)}
          />
        </label>
        <button type="submit" className="warehouse-primary-button">
          Xem báo cáo
        </button>
      </form>
      <AutoDismissMessage message={error} className="warehouse-error" />
      {loading ? (
        <div className="warehouse-card">
          <Skeleton variant="cards" columns={3} />
          <Skeleton rows={5} columns={6} />
        </div>
      ) : (
        report && (
          <>
            <div className="warehouse-summary-grid">
              <div>
                <span>Tồn hiện tại</span>
                <strong>{currentStockQuantity}</strong>
              </div>
              <div>
                <span>Nhập trong kỳ</span>
                <strong>{summary.total_imported || 0}</strong>
              </div>
              <div>
                <span>Xuất bán trong kỳ</span>
                <strong>{summary.total_exported || 0}</strong>
              </div>
              <div>
                <span>Điều chuyển trong kỳ</span>
                <strong>{summary.total_transferred_quantity || 0}</strong>
              </div>
              <div>
                <span>Hư hỏng trong kỳ</span>
                <strong>{summary.total_damage_quantity || 0}</strong>
              </div>
              <div>
                <span>Sản phẩm hết hàng</span>
                <strong>{outOfStockCount}</strong>
              </div>
              <div>
                <span>Sản phẩm sắp hết{lowStockPercentage != null ? ` (≤ ${lowStockPercentage}%)` : ""}</span>
                <strong>{lowStockCount}</strong>
              </div>
            </div>
            <section className="warehouse-report-card warehouse-product-summary">
              <div className="warehouse-product-summary-header">
                <h2>Tồn kho theo sản phẩm</h2>
                <input
                  type="search"
                  value={productKeyword}
                  placeholder="Tìm sản phẩm..."
                  aria-label="Tìm sản phẩm trong báo cáo tồn kho"
                  onChange={(event) => {
                    setProductKeyword(event.target.value);
                    setProductPage(1);
                  }}
                />
              </div>
              <ProductTable
                products={visibleProducts}
                lowStockPercentage={lowStockPercentage}
                page={safeProductPage}
                totalPages={productTotalPages}
                onPageChange={setProductPage}
              />
            </section>
          </>
        )
      )}
    </div>
  );
}

function ProductTable({ products, lowStockPercentage, page, totalPages, onPageChange }) {
  if (products.length === 0) {
    return <p className="warehouse-report-empty">Không có sản phẩm phù hợp.</p>;
  }

  const formatQuantity = (value) => Number(value || 0).toLocaleString("vi-VN");

  return (
    <>
      <div className="warehouse-table-wrap">
        <table className="warehouse-table warehouse-product-table">
          <thead>
            <tr>
              <th>Sản phẩm</th>
              <th>Đơn vị</th>
              <th>Nhập trong kỳ</th>
              <th>Xuất bán</th>
              <th>Điều chuyển</th>
              <th>Hư hỏng</th>
              <th>Tồn hiện tại</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => {
              const currentStock = Number(product.current_stock || 0);
              const inventoryStatus = getInventoryStatus(
                currentStock,
                product.total_imported,
                lowStockPercentage,
              );
              return (
                <tr key={product.product_id}>
                  <td>{product.product_name}</td>
                  <td>{product.unit || "—"}</td>
                  <td>{formatQuantity(product.imported)}</td>
                  <td>{formatQuantity(product.exported)}</td>
                  <td>{formatQuantity(product.transferred)}</td>
                  <td>{formatQuantity(product.damaged)}</td>
                  <td>
                    <strong>{formatQuantity(currentStock)}</strong>
                  </td>
                  <td>
                    <span
                      className={`warehouse-stock-status is-${inventoryStatus.key}`}
                    >
                      {inventoryStatus.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
      )}
    </>
  );
}

export default WarehouseReports;
