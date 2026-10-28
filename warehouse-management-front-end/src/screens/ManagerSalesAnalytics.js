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
const twelveMonthsAgo = () => {
  const value = new Date();
  value.setMonth(value.getMonth() - 11);
  return value.toISOString().slice(0, 10);
};
const money = (value) => `${Number(value || 0).toLocaleString("vi-VN")} đ`;
const quantity = (value) => Number(value || 0).toLocaleString("vi-VN");
const chartMoney = (value) => `${Number(value || 0).toLocaleString("vi-VN")} đ`;
const CHART_COLORS = [
  "#557A95", // Muted blue
  "#6B8E7B", // Sage green
  "#B9786A", // Dusty terracotta
  "#8176A5", // Muted purple
  "#B89A55", // Soft ochre
  "#4F8884", // Deep pastel teal
  "#9A7488", // Dusty mauve
  "#718096", // Slate
  "#A47C5B", // Warm tan
  "#78864D", // Olive sage
  "#6D7FA3", // Periwinkle
  "#9A6E76", // Dusty rose
];
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

function normalizeQuantityRows(rows) {
  return (rows || [])
    .map((row) => ({
      product_id: row.product_id,
      product_name: row.product_name || "Chưa xác định",
      unit: row.unit || "",
      quantity: Number(row.quantity || 0),
    }))
    .filter((row) => row.quantity > 0)
    .sort((a, b) => b.quantity - a.quantity || a.product_name.localeCompare(b.product_name));
}

function compactQuantityRows(rows) {
  const sorted = normalizeQuantityRows(rows);
  const top = sorted.slice(0, 8);
  const otherQuantity = sorted.slice(8).reduce((sum, row) => sum + row.quantity, 0);
  if (otherQuantity > 0) {
    top.push({ product_id: "other", product_name: "Sản phẩm khác", unit: "", quantity: otherQuantity });
  }
  return top;
}

const percentage = (value, total) => (total ? `${((value / total) * 100).toFixed(1)}%` : "0%");
const formatMonthLabel = (value) => {
  const [year, month] = String(value || "").split("-");
  return year && month ? `T${Number(month)}/${year}` : value || "—";
};

function QuantityPieChartCard({
  id,
  title,
  subtitle,
  rows,
  tableRows,
  tablePagination,
  onTablePageChange,
  tableLoading = false,
  emptyMessage,
  showChart = true,
}) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  const chartRows = useMemo(
    () => compactQuantityRows(rows),
    [rows],
  );
  const renderedTableRows = useMemo(
    () => normalizeQuantityRows(tableRows ?? rows),
    [rows, tableRows],
  );

  useEffect(() => {
    if (!showChart || !canvasRef.current || chartRows.length === 0) return undefined;
    chartRef.current?.destroy();
    const total = chartRows.reduce((sum, row) => sum + row.quantity, 0);
    chartRef.current = new Chart(canvasRef.current, {
      type: "pie",
      data: {
        labels: chartRows.map((row) => row.product_name),
        datasets: [{
          data: chartRows.map((row) => row.quantity),
          backgroundColor: chartRows.map((_, index) => CHART_COLORS[index % CHART_COLORS.length]),
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
                const row = chartRows[context.dataIndex];
                return ` ${quantity(row.quantity)} ${row.unit} (${percentage(row.quantity, total)})`;
              },
            },
          },
        },
      },
    });
    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [chartRows, showChart]);

  const total = chartRows.reduce((sum, row) => sum + row.quantity, 0);
  return (
    <section id={id} className="manager-analytics-chart-card manager-quantity-chart-card">
      <div className="manager-analytics-card-heading">
        <div>
          <h2>{title}</h2>
          <small>{subtitle}</small>
        </div>
        <span>{total ? `${quantity(total)} đơn vị hàng` : "Chưa có dữ liệu"}</span>
      </div>
      {chartRows.length ? (
        <div className={`manager-analytics-split ${showChart ? "" : "manager-analytics-single-column"}`}>
          {showChart && (
            <div className="manager-analytics-split-chart">
              <div className="manager-chart-box manager-quantity-chart-box"><canvas ref={canvasRef} /></div>
            </div>
          )}
          <div className="manager-analytics-split-table">
            <div className="manager-chart-table-wrap">
            <table className="manager-chart-table">
              <thead>
                <tr><th>Sản phẩm</th><th>Đơn vị</th><th>Số lượng</th><th>Tỷ trọng</th></tr>
              </thead>
              <tbody>
                {renderedTableRows.map((row) => (
                  <tr key={`${id}-${row.product_id}`}>
                    <td><strong>{row.product_name}</strong></td>
                    <td>{row.unit || "—"}</td>
                    <td>{quantity(row.quantity)}</td>
                    <td>{percentage(row.quantity, total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          {Number(tablePagination?.total_pages || 1) > 1 && (
            <div className="manager-chart-pagination">
              <Pagination
                page={Number(tablePagination?.page || 1)}
                totalPages={Number(tablePagination?.total_pages || 1)}
                onPageChange={onTablePageChange}
                disabled={tableLoading}
              />
            </div>
          )}
          </div>
        </div>
      ) : (
        <div className="manager-chart-empty">{emptyMessage}</div>
      )}
    </section>
  );
}

function ManagerAnalyticsCharts({ report, debtPagination, tablePages, onTablePageChange, tableLoading }) {
  const debtCanvasRef = useRef(null);
  const revenueCanvasRef = useRef(null);
  const debtChartRef = useRef(null);
  const revenueChartRef = useRef(null);
  const monthlyCanvasRef = useRef(null);
  const monthlyChartRef = useRef(null);
  const debtRows = useMemo(
    () => report?.debt_chart || [],
    [report?.debt_chart],
  );
  const revenueRows = useMemo(
    () => compactRevenueRows(report?.revenue_by_area),
    [report?.revenue_by_area],
  );
  const monthlyRows = useMemo(() => report?.monthly_trend || [], [report?.monthly_trend]);

  useEffect(() => {
    if (!monthlyCanvasRef.current || monthlyRows.length === 0) return undefined;
    monthlyChartRef.current?.destroy();
    monthlyChartRef.current = new Chart(monthlyCanvasRef.current, {
      type: "bar",
      data: {
        labels: monthlyRows.map((row) => formatMonthLabel(row.month)),
        datasets: [{
          label: "Doanh thu",
          data: monthlyRows.map((row) => row.revenue),
          backgroundColor: monthlyRows.map((_, index) => CHART_COLORS[index % CHART_COLORS.length]),
          borderRadius: 5,
          borderSkipped: false,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { grid: { display: false } },
          y: {
            beginAtZero: true,
            grid: { color: "#e8eef5" },
            ticks: { callback: (value) => chartMoney(value), maxTicksLimit: 6 },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => formatMonthLabel(monthlyRows[items[0]?.dataIndex]?.month),
              label: (context) => ` ${chartMoney(context.parsed.y)}`,
              afterLabel: (context) => {
                const row = monthlyRows[context.dataIndex];
                return ` ${quantity(row.orders)} đơn · ${quantity(row.sold_quantity)} sản phẩm`;
              },
            },
          },
        },
      },
    });
    return () => {
      monthlyChartRef.current?.destroy();
      monthlyChartRef.current = null;
    };
  }, [monthlyRows]);

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
          backgroundColor: debtRows.map((_, index) => CHART_COLORS[index % CHART_COLORS.length]),
          borderColor: debtRows.map((_, index) => CHART_COLORS[index % CHART_COLORS.length]),
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
      <section id="manager-monthly-chart" className="manager-analytics-chart-card">
        <div className="manager-analytics-card-heading">
          <div>
            <h2>Doanh thu theo tháng</h2>
            <small>So sánh doanh thu từng tháng để nhận diện giai đoạn cao điểm</small>
          </div>
          <span>
            {report?.monthly_peak
              ? `Cao nhất: ${formatMonthLabel(report.monthly_peak.month)}`
              : "Chưa có dữ liệu"}
          </span>
        </div>
        {monthlyRows.length ? (
          <div className="manager-analytics-split">
            <div className="manager-analytics-split-chart">
              <div className="manager-chart-box manager-monthly-chart-box"><canvas ref={monthlyCanvasRef} /></div>
            </div>
            <div className="manager-analytics-split-table">
            <div className="manager-chart-table-wrap">
              <table className="manager-chart-table">
                <thead>
                  <tr><th>Tháng</th><th>Số đơn</th><th>Số lượng bán</th><th>Doanh thu</th><th>Đã thu</th><th>Tiền mặt</th><th>Chuyển khoản</th></tr>
                </thead>
                <tbody>
                  {(report.monthly_table || monthlyRows).map((row) => (
                    <tr key={`monthly-${row.month}`}>
                      <td><strong>{formatMonthLabel(row.month)}</strong></td>
                      <td>{quantity(row.orders)}</td>
                      <td>{quantity(row.sold_quantity)}</td>
                      <td>{money(row.revenue)}</td>
                      <td>{money(row.paid)}</td>
                      <td>{money(row.cash_paid)}</td>
                      <td>{money(row.bank_paid)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {Number(report.monthly_pagination?.total_pages || 1) > 1 && (
              <Pagination
                page={Number(report.monthly_pagination?.page || tablePages.monthly)}
                totalPages={Number(report.monthly_pagination?.total_pages || 1)}
                onPageChange={(nextPage) => onTablePageChange("monthly", nextPage)}
                disabled={tableLoading.monthly}
              />
            )}
            </div>
          </div>
        ) : (
          <div className="manager-chart-empty">Chưa có dữ liệu doanh thu trong khoảng thời gian đã chọn.</div>
        )}
      </section>
      <section id="manager-debt-chart" className="manager-analytics-chart-card">
        <div className="manager-analytics-card-heading">
          <div>
            <h2>Công nợ theo khách hàng</h2>
            <small>Những khách hàng có số dư công nợ cao nhất</small>
          </div>
          <span>{debtRows.length ? "Đơn vị: VND" : "Chưa có dữ liệu"}</span>
        </div>
        {debtRows.length ? (
          <div className="manager-analytics-split">
            <div className="manager-analytics-split-chart">
              <div className="manager-chart-box manager-debt-chart-box"><canvas ref={debtCanvasRef} /></div>
            </div>
            <div className="manager-analytics-split-table">
            <div className="manager-chart-table-wrap">
              <table className="manager-chart-table">
                <thead>
                  <tr>
                    <th>Khách hàng</th>
                    <th>Khu vực</th>
                    <th>Doanh số</th>
                    <th>Đã thu</th>
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
                      <td>{money(row.current_debt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!report.debts?.length && <div className="manager-analytics-empty">Không có dữ liệu công nợ.</div>}
            </div>
            {Number(debtPagination.total_pages || 1) > 1 && (
              <Pagination
                page={Number(debtPagination.page || tablePages.debt)}
                totalPages={Number(debtPagination.total_pages)}
                onPageChange={(nextPage) => onTablePageChange("debt", nextPage)}
                disabled={tableLoading.debt}
              />
            )}
            </div>
          </div>
        ) : (
          <div className="manager-chart-empty">Chưa có khách hàng phát sinh công nợ.</div>
        )}
      </section>

      <section id="manager-revenue-chart" className="manager-analytics-chart-card">
        <div className="manager-analytics-card-heading">
          <div>
            <h2>Doanh thu theo khu vực</h2>
            <small>Phân bổ doanh thu trong khoảng thời gian đã chọn</small>
          </div>
          <span>{revenueRows.length ? "Đơn vị: VND" : "Chưa có dữ liệu"}</span>
        </div>
        {revenueRows.length ? (
          <div className="manager-analytics-split">
            <div className="manager-analytics-split-chart">
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
            </div>
            <div className="manager-analytics-split-table">
            <div className="manager-chart-table-wrap">
              <table className="manager-chart-table">
                <thead><tr><th>Khu vực</th><th>Số đơn</th><th>Số lượng</th><th>Doanh thu</th></tr></thead>
                <tbody>
                  {(report.revenue_table || report.revenue_by_area || []).map((row) => (
                    <tr key={`revenue-${row.area}`}>
                      <td><strong>{row.area}</strong></td>
                      <td>{quantity(row.orders)}</td>
                      <td>{quantity(row.quantity)}</td>
                      <td>{money(row.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {Number(report.revenue_pagination?.total_pages || 1) > 1 && (
              <Pagination
                page={Number(report.revenue_pagination?.page || tablePages.revenue)}
                totalPages={Number(report.revenue_pagination?.total_pages || 1)}
                onPageChange={(nextPage) => onTablePageChange("revenue", nextPage)}
                disabled={tableLoading.revenue}
              />
            )}
            </div>
          </div>
        ) : (
          <div className="manager-chart-empty">Chưa có doanh thu trong kỳ đã chọn.</div>
        )}
      </section>
      <QuantityPieChartCard
        id="manager-inventory-chart"
        title="Tồn kho theo sản phẩm"
        subtitle="Số lượng hàng còn lại trong kho hiện tại"
        rows={report?.inventory_chart}
        tableRows={report?.inventory_table}
        tablePagination={report?.inventory_pagination}
        onTablePageChange={(nextPage) => onTablePageChange("inventory", nextPage)}
        tableLoading={tableLoading.inventory}
        emptyMessage="Chưa có sản phẩm còn tồn kho."
        showChart={false}
      />
      <QuantityPieChartCard
        id="manager-sold-chart"
        title="Số lượng bán theo sản phẩm"
        subtitle="Số lượng hàng đã bán trong khoảng thời gian đã chọn"
        rows={report?.sold_chart}
        tableRows={report?.sold_table}
        tablePagination={report?.sold_pagination}
        onTablePageChange={(nextPage) => onTablePageChange("sold", nextPage)}
        tableLoading={tableLoading.sold}
        emptyMessage="Chưa có sản phẩm được bán trong kỳ đã chọn."
      />
    </div>
  );
}

function ManagerSalesAnalytics() {
  const navigate = useNavigate();
  const [fromDate, setFromDate] = useState(twelveMonthsAgo);
  const [toDate, setToDate] = useState(today);
  const [tablePages, setTablePages] = useState({ debt: 1, revenue: 1, inventory: 1, sold: 1, monthly: 1 });
  const [tableLoading, setTableLoading] = useState({ debt: false, revenue: false, inventory: false, sold: false, monthly: false });
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
            page: 1,
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
    [fromDate, setError, toDate],
  );

  const loadTablePage = useCallback(async (table, nextPage) => {
    try {
      setTableLoading((current) => ({ ...current, [table]: true }));
      const response = await authApis().get(endpoints.managerSalesReport, {
        params: {
          from_date: fromDate || undefined,
          to_date: toDate || undefined,
          table,
          table_page: nextPage,
          table_per_page: 10,
        },
      });
      setReport((current) => ({ ...(current || {}), ...(response.data || {}) }));
      setTablePages((current) => ({ ...current, [table]: nextPage }));
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setTableLoading((current) => ({ ...current, [table]: false }));
    }
  }, [fromDate, setError, toDate]);

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
          <p>Doanh thu và tiền thu/chi theo khoảng ngày; công nợ và tiền còn lại là số hiện tại theo dữ liệu đã ghi nhận.</p>
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
              setTablePages({ debt: 1, revenue: 1, inventory: 1, sold: 1, monthly: 1 });
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
              setTablePages({ debt: 1, revenue: 1, inventory: 1, sold: 1, monthly: 1 });
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
                onClick={() => scrollToSection("manager-debt-chart")}
              />
              <SummaryCard
                label="Doanh số"
                value={money(summary.period_sales_total)}
                onClick={() => scrollToSection("manager-revenue-chart")}
              />
              <SummaryCard
                label="Đã thu"
                value={money(summary.period_paid_total)}
                onClick={() => scrollToSection("manager-revenue-chart")}
              />
              <SummaryCard
                label="Thu tiền mặt"
                value={money(summary.customer_cash_paid_total)}
                onClick={() => scrollToSection("manager-monthly-chart")}
              />
              <SummaryCard
                label="Thu chuyển khoản"
                value={money(summary.customer_bank_paid_total)}
                onClick={() => scrollToSection("manager-monthly-chart")}
              />
              <SummaryCard
                label="Đã trả nhà cung cấp trong kỳ"
                value={money(summary.supplier_paid_total)}
                onClick={() => scrollToSection("manager-monthly-chart")}
              />
              <SummaryCard
                label="Công nợ nhà cung cấp hiện tại"
                value={money(summary.supplier_debt_total)}
                onClick={() => scrollToSection("manager-monthly-chart")}
                tone={Number(summary.supplier_debt_total) > 0 ? "warning" : "positive"}
              />
              <SummaryCard
                label="Tiền còn lại trong kỳ"
                value={money(summary.company_balance_total)}
                onClick={() => scrollToSection("manager-monthly-chart")}
                tone={Number(summary.company_balance_total) >= 0 ? "positive" : "warning"}
              />
              <SummaryCard
                label="Biến động công nợ"
                value={money(summary.net_debt_change)}
                onClick={() => scrollToSection("manager-debt-chart")}
                tone={
                  Number(summary.net_debt_change) > 0 ? "warning" : "positive"
                }
              />
              <SummaryCard
                label="Tồn kho hiện tại"
                value={quantity(summary.current_stock_total)}
                suffix="đơn vị hàng"
                onClick={() => scrollToSection("manager-inventory-chart")}
              />
              <SummaryCard
                label="Đã bán trong kỳ"
                value={quantity(summary.period_sold_quantity)}
                suffix="đơn vị hàng"
                onClick={() => scrollToSection("manager-sold-chart")}
              />
              <SummaryCard
                label="Tháng doanh thu cao nhất"
                value={report.monthly_peak ? formatMonthLabel(report.monthly_peak.month) : "—"}
                suffix={report.monthly_peak ? money(report.monthly_peak.revenue) : "Chưa có dữ liệu"}
                onClick={() => scrollToSection("manager-monthly-chart")}
              />
            </div>
            <ManagerAnalyticsCharts
              report={report}
              debtPagination={debtPagination}
              tablePages={tablePages}
              onTablePageChange={loadTablePage}
              tableLoading={tableLoading}
            />
          </>
        )
      )}
    </div>
  );
}

function scrollToSection(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function SummaryCard({ label, value, suffix = "", tone = "", onClick }) {
  return (
    <button
      type="button"
      className={`manager-summary-card ${tone ? `is-${tone}` : ""} ${onClick ? "is-clickable" : ""}`}
      onClick={onClick}
    >
      <span>{label}</span>
      <strong>{value}</strong>
      {suffix && <small>{suffix}</small>}
    </button>
  );
}

export default ManagerSalesAnalytics;
