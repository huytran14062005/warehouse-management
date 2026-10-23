import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { authApis, endpoints } from "../configs/Apis";
import { getApiError } from "../utils/apiError";
import useNotificationState from "../utils/useNotificationState";
import AutoDismissMessage from "../components/AutoDismissMessage";
import Pagination from "../components/Pagination";
import Skeleton from "../components/Skeleton";
import "../css/ManagerSalesAnalytics.css";

const today = () => new Date().toISOString().slice(0, 10);
const thirtyDaysAgo = () => {
  const value = new Date();
  value.setDate(value.getDate() - 30);
  return value.toISOString().slice(0, 10);
};
const money = (value) => `${Number(value || 0).toLocaleString("vi-VN")} đ`;
const quantity = (value) => Number(value || 0).toLocaleString("vi-VN");

function ManagerSalesAnalytics() {
  const navigate = useNavigate();
  const [fromDate, setFromDate] = useState(thirtyDaysAgo);
  const [toDate, setToDate] = useState(today);
  const [page, setPage] = useState(1);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useNotificationState();

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
        const response = await authApis().get(endpoints.managerSalesReport, {
          params: {
            from_date: fromDate || undefined,
            to_date: toDate || undefined,
            page,
            per_page: 10,
          },
        });
        setReport(response.data || null);
      } catch (requestError) {
        setError(getApiError(requestError));
      } finally {
        setLoading(false);
      }
    },
    [fromDate, page, setError, toDate],
  );

  useEffect(() => {
    if (!localStorage.getItem("token")) {
      navigate("/login", {
        replace: true,
        state: { message: "Vui lòng đăng nhập để xem báo cáo quản lý." },
      });
      return;
    }
    loadReport();
  }, [loadReport, navigate]);

  const summary = report?.debt_summary || {};
  const debtPagination = report?.debt_pagination || { total_pages: 1 };
  return (
    <div className="manager-analytics-page">
      <div className="manager-analytics-header">
        <div>
          <h1>Thống kê công nợ &amp; doanh thu</h1>
          <p> </p>
        </div>
      </div>
      <form className="manager-analytics-filter" onSubmit={loadReport}>
        <label>
          <span>Từ ngày</span>
          <input
            type="date"
            value={fromDate}
            onChange={(event) => {
              setFromDate(event.target.value);
              setPage(1);
            }}
          />
        </label>
        <label>
          <span>Đến ngày</span>
          <input
            type="date"
            value={toDate}
            onChange={(event) => {
              setToDate(event.target.value);
              setPage(1);
            }}
          />
        </label>
        <button type="submit">Xem thống kê</button>
      </form>
      <AutoDismissMessage message={error} className="manager-analytics-error" />
      {loading ? (
        <div className="manager-analytics-card manager-analytics-state">
          <Skeleton variant="cards" columns={3} />
          <Skeleton rows={5} columns={5} />
        </div>
      ) : (
        report && (
          <>
            <div className="manager-analytics-summary">
              <SummaryCard
                label="Tổng công nợ hiện tại"
                value={money(summary.current_debt_total)}
              />
              <SummaryCard
                label="Doanh số"
                value={money(summary.period_sales_total)}
              />
              <SummaryCard
                label="Đã thu"
                value={money(summary.period_paid_total)}
              />
              <SummaryCard
                label="Biến động công nợ"
                value={money(summary.net_debt_change)}
                tone={
                  Number(summary.net_debt_change) > 0 ? "warning" : "positive"
                }
              />
            </div>
            <section className="manager-analytics-card">
              <div className="manager-analytics-card-heading">
                <h2>Công nợ theo khách hàng</h2>
                <span>{summary.customer_count || 0} khách hàng</span>
              </div>
              <div className="manager-analytics-table-wrap">
                <table className="manager-analytics-table">
                  <thead>
                    <tr>
                      <th>Khách hàng</th>
                      <th>Khu vực</th>
                      <th>Doanh số</th>
                      <th>Đã thu</th>
                      <th>Biến động</th>
                      <th>Công nợ hiện tại</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(report.debts || []).map((row) => (
                      <tr key={row.customer_id}>
                        <td>
                          <strong>{row.customer_name}</strong>
                          <small>{row.phone}</small>
                        </td>
                        <td>{row.area}</td>
                        <td>{money(row.period_sales)}</td>
                        <td>{money(row.period_paid)}</td>
                        <td
                          className={
                            Number(row.net_debt_change) > 0
                              ? "is-warning"
                              : "is-positive"
                          }
                        >
                          {money(row.net_debt_change)}
                        </td>
                        <td>
                          <strong>{money(row.current_debt)}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!report.debts?.length && (
                  <div className="manager-analytics-empty">
                    Không có dữ liệu công nợ.
                  </div>
                )}
              </div>
              {Number(debtPagination.total_pages || 1) > 1 && (
                <Pagination
                  currentPage={Number(debtPagination.page || page)}
                  totalPages={Number(debtPagination.total_pages)}
                  onPageChange={setPage}
                />
              )}
            </section>
            <section className="manager-analytics-card">
              <div className="manager-analytics-card-heading">
                <h2>Doanh thu theo khu vực</h2>
                <span>{(report.revenue_by_area || []).length} khu vực</span>
              </div>
              <div className="manager-analytics-table-wrap">
                <table className="manager-analytics-table">
                  <thead>
                    <tr>
                      <th>Khu vực</th>
                      <th>Số đơn hoàn thành</th>
                      <th>Số lượng hàng</th>
                      <th>Doanh thu</th>
                      <th>Sản phẩm bán nhiều nhất</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(report.revenue_by_area || []).map((row) => (
                      <tr key={row.area}>
                        <td>
                          <strong>{row.area}</strong>
                        </td>
                        <td>{quantity(row.orders)}</td>
                        <td>{quantity(row.quantity)}</td>
                        <td>
                          <strong>{money(row.revenue)}</strong>
                        </td>
                        <td>
                          {row.top_product
                            ? `${row.top_product.name} (${quantity(row.top_product.quantity)})`
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!report.revenue_by_area?.length && (
                  <div className="manager-analytics-empty">
                  Không có doanh thu.
                  </div>
                )}
              </div>
            </section>
          </>
        )
      )}
    </div>
  );
}

function SummaryCard({ label, value, tone = "" }) {
  return (
    <div className={`manager-summary-card ${tone ? `is-${tone}` : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default ManagerSalesAnalytics;
