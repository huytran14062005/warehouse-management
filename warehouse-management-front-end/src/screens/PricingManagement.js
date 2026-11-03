import React, { useCallback, useEffect, useState } from "react";
import { authApis, endpoints } from "../configs/Apis";
import AutoDismissMessage from "../components/AutoDismissMessage";
import ConfirmDialog from "../components/ConfirmDialog";
import MoneyInput from "../components/MoneyInput";
import Pagination from "../components/Pagination";
import SearchableDropdown from "../components/SearchableDropdown";
import { getApiError } from "../utils/apiError";
import { formatCurrency } from "../utils/money";
import "../css/PricingManagement.css";

const CATEGORIES = {
  fuel: "Xăng xe",
  vehicle_repair: "Sửa xe",
  lodging: "Nhà nghỉ",
  sales_salary: "Lương nhân viên bán hàng",
  other: "Chi phí bán hàng khác",
};

const PAYMENT_METHOD_OPTIONS = [
  { value: "", label: "Chưa chi tiền / chưa ghi quỹ" },
  { value: "cash", label: "Đã chi tiền mặt" },
  { value: "bank_transfer", label: "Đã chi chuyển khoản" },
];

const PAID_FROM_OPTIONS = [
  { value: "cash", label: "Tiền mặt" },
  { value: "bank_transfer", label: "Chuyển khoản" },
];

function businessDate() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function monthStart() {
  return `${businessDate().slice(0, 7)}-01`;
}

function PricingRow({ row, onSave, onApply, busy }) {
  const [quantity, setQuantity] = useState(String(row.planned_quantity));
  const [margin, setMargin] = useState(String(row.target_margin));
  useEffect(() => {
    setQuantity(String(row.planned_quantity));
    setMargin(String(row.target_margin));
  }, [row.planned_quantity, row.target_margin]);
  const changed = Number(quantity) !== row.planned_quantity || Number(margin) !== row.target_margin;
  return (
    <tr>
      <th scope="row"><strong>{row.name}</strong><small>/{row.unit}</small></th>
      <td>{formatCurrency(row.current_price)}</td>
      <td>{row.estimated_unit_cost == null ? <span className="pricing-warning">Chưa có giá nhập</span> : formatCurrency(row.estimated_unit_cost)}</td>
      <td>{formatCurrency(row.overhead_per_unit)}</td>
      <td><input type="number" min="1" max="10000000" step="1" aria-label={`Sản lượng dự kiến ${row.name}`} value={quantity} onChange={(event) => setQuantity(event.target.value)} /></td>
      <td><input type="number" min="0" max="90" step="0.01" aria-label={`Biên lợi nhuận ${row.name}`} value={margin} onChange={(event) => setMargin(event.target.value)} /></td>
      <td><strong>{row.suggested_price == null ? "—" : formatCurrency(row.suggested_price)}</strong></td>
      <td><div className="pricing-row-actions">
        <button type="button" disabled={busy || !changed || !quantity || !margin} onClick={() => onSave(row.product_id, quantity, margin)}>Lưu mục tiêu</button>
        <button type="button" className="pricing-primary" disabled={busy || changed || row.suggested_price == null || row.suggested_price === row.current_price} onClick={() => onApply(row)}>Áp dụng giá</button>
      </div></td>
    </tr>
  );
}

export default function PricingManagement() {
  const user = (() => { try { return JSON.parse(localStorage.getItem("user")) || {}; } catch { return {}; } })();
  const isManager = user.role === "quản lý";
  const [fromDate, setFromDate] = useState(monthStart);
  const [toDate, setToDate] = useState(businessDate);
  const [period, setPeriod] = useState({ from_date: monthStart(), to_date: businessDate() });
  const [category, setCategory] = useState("fuel");
  const [amount, setAmount] = useState("");
  const [occurredOn, setOccurredOn] = useState(businessDate);
  const [invoiceId, setInvoiceId] = useState("");
  const [description, setDescription] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [expensePage, setExpensePage] = useState(1);
  const [reportPage, setReportPage] = useState(1);
  const [catalogPage, setCatalogPage] = useState(1);
  const [keywordDraft, setKeywordDraft] = useState("");
  const [keyword, setKeyword] = useState("");
  const [expenses, setExpenses] = useState({ expenses: [], pagination: { total_pages: 1 } });
  const [catalog, setCatalog] = useState({ products: [], pagination: { total_pages: 1 } });
  const [report, setReport] = useState(null);
  const [applyRow, setApplyRow] = useState(null);
  const [voidRow, setVoidRow] = useState(null);
  const [voidReason, setVoidReason] = useState("");
  const [payRow, setPayRow] = useState(null);
  const [payMethod, setPayMethod] = useState("cash");
  const [busy, setBusy] = useState(false);
  const [loadingExpenses, setLoadingExpenses] = useState(true);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [loadingReport, setLoadingReport] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadExpenses = useCallback(async () => {
    const response = await authApis().get(endpoints.pricingExpenses, { params: { ...period, page: expensePage } });
    setExpenses(response.data);
  }, [period, expensePage]);

  const loadCatalog = useCallback(async () => {
    const response = await authApis().get(endpoints.pricingCatalog, { params: { page: catalogPage, keyword } });
    setCatalog(response.data);
  }, [catalogPage, keyword]);

  const loadReport = useCallback(async () => {
    const response = await authApis().get(endpoints.pricingProfitability, { params: { ...period, page: reportPage } });
    setReport(response.data);
  }, [period, reportPage]);

  useEffect(() => {
    if (!isManager) return;
    setLoadingExpenses(true);
    loadExpenses().catch((requestError) => setError(getApiError(requestError))).finally(() => setLoadingExpenses(false));
  }, [isManager, loadExpenses]);

  useEffect(() => {
    if (!isManager) return;
    setLoadingCatalog(true);
    loadCatalog().catch((requestError) => setError(getApiError(requestError))).finally(() => setLoadingCatalog(false));
  }, [isManager, loadCatalog]);

  useEffect(() => {
    if (!isManager) return;
    setLoadingReport(true);
    loadReport().catch((requestError) => setError(getApiError(requestError))).finally(() => setLoadingReport(false));
  }, [isManager, loadReport]);

  const submitExpense = async (event) => {
    event.preventDefault();
    if (!amount || !description.trim()) return setError("Nhập số tiền và diễn giải khoản chi.");
    setBusy(true); setError(""); setSuccess("");
    try {
      await authApis().post(endpoints.pricingExpenses, {
        category, amount: Number(amount), occurred_on: occurredOn,
        invoice_id: invoiceId || null, description: description.trim(),
        payment_method: paymentMethod || null,
      });
      setAmount(""); setDescription(""); setInvoiceId(""); setPaymentMethod("");
      setSuccess("Đã ghi nhận chi phí. Báo cáo và giá đề xuất đã được cập nhật.");
      await Promise.all([loadExpenses(), loadCatalog(), loadReport()]);
    } catch (requestError) { setError(getApiError(requestError)); }
    finally { setBusy(false); }
  };

  const savePolicy = async (productId, plannedQuantity, targetMargin) => {
    setBusy(true); setError(""); setSuccess("");
    try {
      await authApis().put(endpoints.pricingPolicy(productId), {
        planned_quantity: Number(plannedQuantity), target_margin: Number(targetMargin),
      });
      setSuccess("Đã lưu mục tiêu. Giá đề xuất đã tính lại.");
      await loadCatalog();
    } catch (requestError) { setError(getApiError(requestError)); }
    finally { setBusy(false); }
  };

  const applyPrice = async () => {
    if (!applyRow) return;
    setBusy(true); setError(""); setSuccess("");
    try {
      await authApis().post(endpoints.pricingApply(applyRow.product_id), { expected_price: applyRow.current_price, expected_suggested_price: applyRow.suggested_price });
      setSuccess(`Đã cập nhật giá bán mặc định của ${applyRow.name}.`);
      setApplyRow(null);
      await loadCatalog();
    } catch (requestError) { setError(getApiError(requestError)); setApplyRow(null); }
    finally { setBusy(false); }
  };

  const voidExpense = async () => {
    if (!voidRow || !voidReason.trim()) return;
    setBusy(true); setError(""); setSuccess("");
    try {
      await authApis().post(endpoints.pricingExpenseVoid(voidRow.id), { reason: voidReason.trim() });
      setVoidRow(null); setVoidReason("");
      setSuccess("Đã hủy khoản chi. Nếu đã chi tiền, số dư quỹ đã được hoàn lại.");
      await Promise.all([loadExpenses(), loadCatalog(), loadReport()]);
    } catch (requestError) { setError(getApiError(requestError)); }
    finally { setBusy(false); }
  };

  const payExpense = async () => {
    if (!payRow) return;
    setBusy(true); setError(""); setSuccess("");
    try {
      await authApis().post(endpoints.pricingExpensePay(payRow.id), { payment_method: payMethod });
      setPayRow(null);
      setSuccess("Đã ghi khoản chi vào sổ quỹ.");
      await loadExpenses();
    } catch (requestError) { setError(getApiError(requestError)); }
    finally { setBusy(false); }
  };

  if (!isManager) return <div className="pricing-page">Chỉ quản lý được xem chi phí và giá bán.</div>;

  return (
    <div className="pricing-page">
      <header className="pricing-heading"><h1>Chi phí &amp; giá bán</h1><p>Ghi chi phí thực tế, theo dõi lãi theo kỳ và tính giá cho những đơn bán tiếp theo.</p></header>
      <AutoDismissMessage message={error} className="pricing-error" />
      <AutoDismissMessage message={success} className="pricing-success" />

      <section className="pricing-panel" aria-labelledby="pricing-report-heading">
        <div className="pricing-section-head"><div><h2 id="pricing-report-heading">Kết quả kinh doanh</h2><p>Doanh thu của đơn đã hoàn thành theo ngày lập đơn; chi phí theo ngày phát sinh.</p></div>
          <form className="pricing-period" onSubmit={(event) => { event.preventDefault(); setExpensePage(1); setReportPage(1); setPeriod({ from_date: fromDate, to_date: toDate }); }}>
            <label>Từ ngày<input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} required /></label>
            <label>Đến ngày<input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} required /></label>
            <button type="submit">Xem báo cáo</button>
          </form>
        </div>
        {loadingReport && <p className="pricing-loading" role="status">Đang tải báo cáo...</p>}
        {report && <>
          <div className="pricing-cards">
            <div><span>Doanh thu thuần</span><strong>{formatCurrency(report.revenue)}</strong></div>
            <div><span>Giá vốn ước tính</span><strong>{formatCurrency(report.estimated_cogs)}</strong></div>
            <div><span>Phí giao ngoài</span><strong>{formatCurrency(report.external_shipping)}</strong></div>
            <div><span>Chi phí quản lý nhập</span><strong>{formatCurrency(report.expenses)}</strong></div>
            <div className={`pricing-profit${report.estimated_operating_profit != null && report.estimated_operating_profit < 0 ? " is-negative" : ""}`}><span>Lãi sau chi phí ước tính</span><strong>{report.estimated_operating_profit == null ? "Chưa đủ giá vốn" : formatCurrency(report.estimated_operating_profit)}</strong></div>
          </div>
          {report.missing_cost_products > 0 && <p className="pricing-warning">Có {report.missing_cost_products} sản phẩm chưa có giá nhập. Tổng lãi chưa thể tính đầy đủ.</p>}
          {report.unallocated_expenses > 0 && <p className="pricing-warning">Chưa có doanh thu trong kỳ để phân bổ {formatCurrency(report.unallocated_expenses)} chi phí chung; tổng lãi vẫn trừ khoản này.</p>}
          <details className="pricing-details"><summary>Xem lãi theo sản phẩm ({report.product_pagination?.total || 0})</summary>
            <div className="pricing-table-wrap"><table><thead><tr><th>Sản phẩm</th><th>SL bán</th><th>Doanh thu</th><th>Giá vốn ước tính</th><th>Phí giao ngoài</th><th>Chi phí phân bổ</th><th>Lãi ước tính</th></tr></thead><tbody>
              {report.products.map((row) => <tr key={row.product_id}><th scope="row">{row.name}</th><td>{row.quantity}</td><td>{formatCurrency(row.net_revenue)}</td><td>{row.estimated_cogs == null ? "Chưa có" : formatCurrency(row.estimated_cogs)}</td><td>{formatCurrency(row.shipping_cost)}</td><td>{formatCurrency(row.operating_expenses)}</td><td>{row.estimated_operating_profit == null ? "—" : formatCurrency(row.estimated_operating_profit)}</td></tr>)}
            </tbody></table></div>
            <Pagination page={reportPage} totalPages={report.product_pagination?.total_pages || 1} onPageChange={setReportPage} />
          </details>
        </>}
      </section>

      <section className="pricing-panel" aria-labelledby="pricing-expense-heading">
        <div className="pricing-section-head"><div><h2 id="pricing-expense-heading">Ghi chi phí phát sinh</h2><p>Gắn mã đơn nếu chi phí chỉ thuộc đơn đó. Để trống nếu đây là chi phí chung trong kỳ.</p></div></div>
        <form className="pricing-expense-form" onSubmit={submitExpense}>
          <label>Loại chi phí<SearchableDropdown value={category} onChange={setCategory} options={Object.entries(CATEGORIES).map(([value, label]) => ({ value, label }))} placeholder="Chọn loại chi phí" ariaLabel="Loại chi phí" /></label>
          <label>Số tiền<MoneyInput value={amount} onChange={setAmount} label="Số tiền chi phí" required /></label>
          <label>Ngày phát sinh<input type="date" value={occurredOn} onChange={(event) => setOccurredOn(event.target.value)} required /></label>
          <label>Mã đơn liên quan (nếu có)<input type="number" min="1" step="1" value={invoiceId} onChange={(event) => setInvoiceId(event.target.value)} placeholder="Ví dụ: 23" /></label>
          <label>Ghi quỹ<SearchableDropdown value={paymentMethod} onChange={setPaymentMethod} options={PAYMENT_METHOD_OPTIONS} placeholder="Chọn trạng thái ghi quỹ" ariaLabel="Ghi quỹ" /></label>
          <label className="pricing-description">Diễn giải<input value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} placeholder="Ví dụ: Xăng chuyến giao đơn 23" required /></label>
          <button type="submit" className="pricing-primary" disabled={busy}>Ghi nhận chi phí</button>
        </form>
        <p className="pricing-hint">Phí giao bên thứ ba đã có trên đơn bán được tính tự động. Không nhập lại tại đây. Khoản chi ghi quỹ sẽ làm giảm số dư quỹ ngay khi lưu.</p>
        <div className="pricing-table-wrap"><table><thead><tr><th>Ngày</th><th>Loại</th><th>Diễn giải</th><th>Đơn</th><th>Ghi quỹ</th><th>Số tiền</th><th>Trạng thái</th></tr></thead><tbody>
          {expenses.expenses.map((row) => <tr key={row.id} className={row.voided_at ? "pricing-voided-row" : ""}><td>{row.occurred_on}</td><td>{row.category_label}</td><td>{row.description}</td><td>{row.invoice_id ? `#${row.invoice_id}` : "Chi phí chung"}</td><td>{row.payment_method === "cash" ? "Tiền mặt" : row.payment_method === "bank_transfer" ? "Chuyển khoản" : "Chưa chi"}</td><td>{formatCurrency(row.amount)}</td><td>{row.voided_at ? <span title={row.void_reason || ""}>Đã hủy</span> : <div className="pricing-row-actions">{!row.payment_method && <button type="button" disabled={busy} onClick={() => { setPayRow(row); setPayMethod("cash"); }}>Ghi đã chi</button>}<button type="button" disabled={busy} onClick={() => { setVoidRow(row); setVoidReason(""); }}>Hủy khoản chi</button></div>}</td></tr>)}
          {!expenses.expenses.length && <tr><td colSpan="7">{loadingExpenses ? "Đang tải chi phí..." : "Chưa có chi phí trong kỳ này."}</td></tr>}
        </tbody></table></div>
        <Pagination page={expensePage} totalPages={expenses.pagination?.total_pages || 1} onPageChange={setExpensePage} disabled={busy} />
      </section>

      <section className="pricing-panel" aria-labelledby="pricing-catalog-heading">
        <div className="pricing-section-head"><div><h2 id="pricing-catalog-heading">Giá bán đề xuất</h2><p>Giá nhập bình quân 90 ngày gần đây, cộng chi phí bán hàng dự kiến, rồi chia cho (1 − biên lợi nhuận mục tiêu).</p></div>
          <form className="pricing-search" onSubmit={(event) => { event.preventDefault(); setCatalogPage(1); setKeyword(keywordDraft.trim()); }}><input value={keywordDraft} onChange={(event) => setKeywordDraft(event.target.value)} placeholder="Tìm sản phẩm" aria-label="Tìm sản phẩm" /><button type="submit">Tìm</button></form>
        </div>
        <p className="pricing-hint">Chi phí dự kiến mỗi tháng: {formatCurrency(catalog.monthly_expense_pool)}. Gồm phí giao ngoài 30 ngày {formatCurrency(catalog.monthly_external_shipping)} và mức dự phòng sửa xe bình quân 12 tháng {formatCurrency(catalog.monthly_repair_allowance)}. Hệ thống phân bổ theo tỷ trọng doanh thu dự kiến.</p>
        <div className="pricing-table-wrap"><table><thead><tr><th>Sản phẩm</th><th>Giá hiện tại</th><th>Giá nhập ước tính</th><th>Chi phí / đơn vị</th><th>SL dự kiến / tháng</th><th>Biên lãi mục tiêu %</th><th>Giá đề xuất</th><th>Thao tác</th></tr></thead><tbody>
          {catalog.products.map((row) => <PricingRow key={row.product_id} row={row} onSave={savePolicy} onApply={setApplyRow} busy={busy} />)}
          {!catalog.products.length && <tr><td colSpan="8">{loadingCatalog ? "Đang tải giá đề xuất..." : "Chưa có sản phẩm phù hợp."}</td></tr>}
        </tbody></table></div>
        <Pagination page={catalogPage} totalPages={catalog.pagination?.total_pages || 1} onPageChange={setCatalogPage} disabled={busy} />
        <p className="pricing-hint">Giá này là gợi ý quản trị. Khi áp dụng, giá bán mặc định thay đổi và giới hạn ±10% của đơn bán sẽ dùng giá mới. Nếu một chuyến phục vụ nhiều đơn, nhập chi phí chuyến đó như chi phí chung để hệ thống phân bổ theo doanh thu trong kỳ.</p>
      </section>
      <ConfirmDialog open={Boolean(applyRow)} title="Áp dụng giá bán đề xuất?" message={applyRow ? `Đổi giá mặc định của ${applyRow.name} từ ${formatCurrency(applyRow.current_price)} sang ${formatCurrency(applyRow.suggested_price)}?` : ""} confirmLabel="Áp dụng giá" onConfirm={applyPrice} onCancel={() => setApplyRow(null)} loading={busy} />
      <ConfirmDialog open={Boolean(voidRow)} title="Hủy khoản chi?" message={voidRow ? `${voidRow.category_label}: ${formatCurrency(voidRow.amount)}. Khoản đã chi sẽ được hoàn vào quỹ.` : ""} confirmLabel="Hủy khoản chi" onConfirm={voidExpense} onCancel={() => setVoidRow(null)} loading={busy} confirmDisabled={!voidReason.trim()} danger>
        <div className="pricing-void-dialog"><label>Lý do hủy<input value={voidReason} onChange={(event) => setVoidReason(event.target.value)} maxLength={500} placeholder="Nhập lý do để lưu lịch sử" /></label></div>
      </ConfirmDialog>
      <ConfirmDialog open={Boolean(payRow)} title="Ghi đã chi tiền?" message={payRow ? `${payRow.category_label}: ${formatCurrency(payRow.amount)}. Số dư quỹ đã chọn sẽ giảm ngay.` : ""} confirmLabel="Ghi đã chi" onConfirm={payExpense} onCancel={() => setPayRow(null)} loading={busy}>
        <div className="pricing-void-dialog"><label>Chi từ quỹ<SearchableDropdown value={payMethod} onChange={setPayMethod} options={PAID_FROM_OPTIONS} placeholder="Chọn quỹ" ariaLabel="Chi từ quỹ" /></label></div>
      </ConfirmDialog>
    </div>
  );
}
