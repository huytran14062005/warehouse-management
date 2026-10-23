import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { authApis, endpoints } from "../configs/Apis";
import AutoDismissMessage from "../components/AutoDismissMessage";
import Pagination from "../components/Pagination";
import SharedSearchableDropdown from "../components/SearchableDropdown";
import Skeleton from "../components/Skeleton";
import { getApiError } from "../utils/apiError";
import { INVENTORY_CHANGED_EVENT } from "../utils/inventoryEvents";
import useNotificationState from "../utils/useNotificationState";
import "../css/EmployeeStock.css";

function formatCurrency(value) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function EmployeeStock() {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [employeeId, setEmployeeId] = useState("");
  const [stock, setStock] = useState(null);
  const [employeesLoading, setEmployeesLoading] = useState(true);
  const [stockLoading, setStockLoading] = useState(false);
  const [stockRefreshKey, setStockRefreshKey] = useState(0);
  const [page, setPage] = useState(1);
  const [error, setError] = useNotificationState();

  useEffect(() => {
    let cancelled = false;

    const loadEmployees = async () => {
      if (!localStorage.getItem("token")) {
        navigate("/login", {
          replace: true,
          state: { message: "Vui lòng đăng nhập để xem tồn kho nhân viên." },
        });
        return;
      }

      try {
        setEmployeesLoading(true);
        setError("");
        const response = await authApis().get(endpoints.salesEmployees);
        if (!cancelled) setEmployees(response.data?.employees || []);
      } catch (requestError) {
        if (!cancelled) setError(getApiError(requestError));
      } finally {
        if (!cancelled) setEmployeesLoading(false);
      }
    };

    loadEmployees();
    return () => {
      cancelled = true;
    };
  }, [navigate, setError]);

  useEffect(() => {
    if (!employeeId) {
      setStock(null);
      setStockLoading(false);
      return undefined;
    }

    let cancelled = false;
    const loadStock = async () => {
      try {
        setStockLoading(true);
        setError("");
        const response = await authApis().get(
          endpoints.employeeStockById(employeeId),
          { params: { page, per_page: 10 } },
        );
        if (!cancelled) setStock(response.data || null);
      } catch (requestError) {
        if (!cancelled) {
          setStock(null);
          setError(getApiError(requestError));
        }
      } finally {
        if (!cancelled) setStockLoading(false);
      }
    };

    loadStock();
    return () => {
      cancelled = true;
    };
  }, [employeeId, page, setError, stockRefreshKey]);

  useEffect(() => {
    const reloadSelectedStock = () => {
      if (!employeeId) return;
      setStockRefreshKey((current) => current + 1);
    };
    window.addEventListener(INVENTORY_CHANGED_EVENT, reloadSelectedStock);
    return () =>
      window.removeEventListener(INVENTORY_CHANGED_EVENT, reloadSelectedStock);
  }, [employeeId]);

  const totalQuantity = useMemo(
    () => Number(stock?.total_quantity ?? (stock?.products || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0)),
    [stock],
  );

  return (
    <div className="employee-stock-page">
      <div className="employee-stock-header">
        <div>
          <h1>Tồn kho nhân viên</h1>
        </div>
      </div>

      <AutoDismissMessage message={error} className="employee-stock-alert" />

      <section className="employee-stock-card employee-stock-filter-card">
        <label className="employee-stock-field">
          <span>Nhân viên bán hàng</span>
          <SharedSearchableDropdown
            value={employeeId}
            placeholder={
              employeesLoading
                ? "Đang tải nhân viên..."
                : "Chọn nhân viên bán hàng"
            }
            ariaLabel="Chọn nhân viên bán hàng để xem tồn kho"
            options={[
              { value: "", label: "Chọn nhân viên bán hàng" },
              ...employees.map((employee) => ({
                value: employee.id,
                label: `${employee.full_name} - ${employee.phone}`,
              })),
            ]}
            onChange={(value) => {
              setPage(1);
              setEmployeeId(String(value || ""));
            }}
          />
        </label>
      </section>

      {!employeeId ? (
        <section className="employee-stock-card employee-stock-state">
          Chọn một nhân viên để xem số hàng đang được cấp.
        </section>
      ) : stockLoading ? (
        <section className="employee-stock-card employee-stock-state">
          <Skeleton variant="cards" columns={3} />
          <Skeleton rows={5} columns={4} />
        </section>
      ) : stock ? (
        <section className="employee-stock-card">
          <div className="employee-stock-summary">
            <div>
              <span>Nhân viên</span>
              <strong>{stock.employee?.full_name || "—"}</strong>
              <small>{stock.employee?.phone || "—"}</small>
            </div>
            <div>
              <span>Số mặt hàng</span>
              <strong>{stock.products?.length || 0}</strong>
            </div>
            <div>
              <span>Tổng số lượng</span>
              <strong>{totalQuantity}</strong>
            </div>
          </div>

          {stock.products?.length ? (
            <div className="employee-stock-table-wrap">
              <table className="employee-stock-table">
                <thead>
                  <tr>
                    <th>Sản phẩm</th>
                    <th>Đơn vị</th>
                    <th>Số lượng đang giữ</th>
                    <th>Giá bán mặc định</th>
                  </tr>
                </thead>
                <tbody>
                  {stock.products.map((product) => (
                    <tr key={product.id}>
                      <td>
                        <strong>{product.name}</strong>
                      </td>
                      <td>{product.unit}</td>
                      <td className="employee-stock-quantity">
                        {product.quantity}
                      </td>
                      <td>{formatCurrency(product.default_sale_price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="employee-stock-state employee-stock-empty">
              Nhân viên này chưa được cấp sản phẩm nào.
            </div>
          )}
        </section>
      ) : null}
      {stock && (
        <Pagination
          page={Number(stock.pagination?.page || page)}
          totalPages={Number(stock.pagination?.total_pages || 1)}
          onPageChange={setPage}
          disabled={stockLoading}
        />
      )}
    </div>
  );
}

export default EmployeeStock;
