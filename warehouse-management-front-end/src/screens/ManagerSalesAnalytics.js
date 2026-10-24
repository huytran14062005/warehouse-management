import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  Legend,
  LinearScale,
  PieController,
  Tooltip,
} from "chart.js";
import { authApis, endpoints } from "../configs/Apis";
import { getApiError } from "../utils/apiError";
import useNotificationState from "../utils/useNotificationState";
import AutoDismissMessage from "../components/AutoDismissMessage";
import Pagination from "../components/Pagination";
import Skeleton from "../components/Skeleton";
import "../css/ManagerSalesAnalytics.css";

Chart.register(
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Legend,
  LinearScale,
  PieController,
  Tooltip,
);

const today = () => new Date().toISOString().slice(0, 10);
const thirtyDaysAgo = () => {
  const value = new Date();
  value.setDate(value.getDate() - 30);
  return value.toISOString().slice(0, 10);
};
const money = (value) => `${Number(value || 0).toLocaleString("vi-VN")} đ`;
const quantity = (value) => Number(value || 0).toLocaleString("vi-VN");
const chartMoney = (value) => `${Number(value || 0).toLocaleString("vi-VN")} đ`;
const CHART_COLORS = ["#0d3863", "#2f73b7", "#53a2d8", "#f0a43c", "#68b684", "#9b8bd4"];
const shortChartLabel = (value, maxLength = 16) => {
  const label = String(value || "");
  return label.length > maxLength ? `${label.slice(0, maxLength - 1)}…` : label;
};

function compactRevenueRows(rows) {
  const sorted = (rows || [])
    .map((row) => ({ area: row.area || "Chưa xác định", revenue: Number(row.revenue || 0) }))
    .filter((row) => row.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue);
  const top = sorted.slice(0, 5);
  const otherRevenue = sorted.slice(5).reduce((sum, row) => sum + row.revenue, 0);
  if (otherRevenue > 0) top.push({ area: "Khu vực khác", revenue: otherRevenue });
  return top;
}

function ManagerAnalyticsCharts({ report }) {
  const debtCanvasRef = useRef(null);
  const revenueCanvasRef = useRef(null);
  const debtChartRef = useRef(null);
  const revenueChartRef = useRef(null);
  const debtRows = useMemo(
    () => report?.debt_chart || [],
    [report?.debt_chart],
  );
  const revenueRows = useMemo(
    () => compactRevenueRows(report?.revenue_by_area),
    [report?.revenue_by_area],
  );

  useEffect(() => {
    if (!debtCanvasRef.current || debtRows.length === 0) return undefined;
    debtChartRef.current?.destroy();
    debtChartRef.current = new Chart(debtCanvasRef.current, {
      type: "bar",
      data: {
        labels: debtRows.map((row) => row.customer_name),
        datasets: [{
          label: "Công nợ hiện tại",
          data: debtRows.map((row) => row.current_debt),
          backgroundColor: "#2f73b7",
          borderRadius: 5,
          borderSkipped: false,
          barThickness: 22,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              autoSkip: false,
              maxRotation: 45,
              minRotation: 0,
              callback: (value) => shortChartLabel(debtRows[value]?.customer_name),
            },
          },
          y: {
            beginAtZero: true,
            grid: { color: "#e8eef5" },
            ticks: { callback: (value) => chartMoney(value), maxTicksLimit: 5 },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => debtRows[items[0]?.dataIndex]?.customer_name || "",
              label: (context) => ` ${chartMoney(context.parsed.y)}`,
            },
          },
        },
      },
    });
    return () => {
      debtChartRef.current?.destroy();
      debtChartRef.current = null;
    };
  }, [debtRows]);

  useEffect(() => {
    if (!revenueCanvasRef.current || revenueRows.length === 0) return undefined;
    revenueChartRef.current?.destroy();
    const totalRevenue = revenueRows.reduce((sum, row) => sum + row.revenue, 0);
    revenueChartRef.current = new Chart(revenueCanvasRef.current, {
      type: "pie",
      data: {
        labels: revenueRows.map((row) => row.area),
        datasets: [{
          data: revenueRows.map((row) => row.revenue),
          backgroundColor: revenueRows.map((_, index) => CHART_COLORS[index % CHART_COLORS.length]),
          borderColor: "#ffffff",
          borderWidth: 2,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => {
                const value = Number(context.parsed || 0);
                const percent = totalRevenue ? ((value / totalRevenue) * 100).toFixed(1) : 0;
                return ` ${chartMoney(value)} (${percent}%)`;
              },
            },
          },
        },
      },
    });
    return () => {
      revenueChartRef.current?.destroy();
      revenueChartRef.current = null;
    };
  }, [revenueRows]);

  return (
    <div className="manager-analytics-chart-grid">
      <section className="manager-analytics-chart-card">
        <div className="manager-analytics-card-heading">
          <div>
            <h2>Công nợ hiện tại</h2>
            <small>Top khách hàng theo số dư công nợ</small>
          </div>
          <span>{debtRows.length ? "Đơn vị: VND" : "Chưa có dữ liệu"}</span>
        </div>
        {debtRows.length ? (
          <div className="manager-chart-box manager-debt-chart-box"><canvas ref={debtCanvasRef} /></div>
        ) : (
          <div className="manager-chart-empty">Chưa có khách hàng phát sinh công nợ.</div>
        )}
      </section>

      <section className="manager-analytics-chart-card">
        <div className="manager-analytics-card-heading">
          <div>
            <h2>Cơ cấu doanh thu</h2>
            <small>Doanh thu theo khu vực trong kỳ</small>
          </div>
          <span>{revenueRows.length ? "Đơn vị: VND" : "Chưa có dữ liệu"}</span>
        </div>
        {revenueRows.length ? (
          <>
            <div className="manager-chart-box manager-revenue-chart-box"><canvas ref={revenueCanvasRef} /></div>
            <div className="manager-chart-legend">
              {revenueRows.map((row, index) => (
                <div className="manager-chart-legend-row" key={row.area}>
                  <span className="manager-chart-legend-dot" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} />
                  <span className="manager-chart-legend-name" title={row.area}>{row.area}</span>
                  <strong>{chartMoney(row.revenue)}</strong>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="manager-chart-empty">Chưa có doanh thu trong kỳ đã chọn.</div>
        )}
      </section>
    </div>
  );
}

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
            <ManagerAnalyticsCharts report={report} />
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
