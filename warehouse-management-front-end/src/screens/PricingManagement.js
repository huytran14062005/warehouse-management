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
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function monthStart() {
  return `${businessDate().slice(0, 7)}-01`;
}

function PricingRow({ row, onSave, onApply, busy }) {
  const [markup, setMarkup] = useState(String(row.markup_percent));
  useEffect(() => {
    setMarkup(String(row.markup_percent));
  }, [row.markup_percent]);
  const changed = Number(markup) !== row.markup_percent;
  return (
    <tr>
      <th scope="row">
        <strong>{row.name}</strong>
        <small>/{row.unit}</small>
      </th>
      <td>
        {row.estimated_unit_cost == null ? (
          <span className="pricing-warning">Chưa có giá nhập</span>
        ) : (
          formatCurrency(row.estimated_unit_cost)
        )}
      </td>
      <td>
        {row.expense_per_unit == null ? (
          <span className="pricing-warning">Chưa tính được</span>
        ) : (
          formatCurrency(row.expense_per_unit)
        )}
      </td>
      <td>
        <input
          type="number"
          min="0"
          max="90"
          step="0.01"
          aria-label={`Lãi trên giá nhập ${row.name}`}
          value={markup}
          onChange={(event) => setMarkup(event.target.value)}
        />
      </td>
      <td>
        <strong>
          {row.suggested_price == null
            ? "—"
            : formatCurrency(row.suggested_price)}
        </strong>
      </td>
      <td>
        <div className="pricing-row-actions">
          <button
            type="button"
            disabled={busy || !changed || markup === ""}
            onClick={() => onSave(row.product_id, markup)}
          >
            Lưu % lãi
          </button>
          <button
            type="button"
            className="pricing-primary"
            disabled={
              busy ||
              changed ||
              row.suggested_price == null ||
              row.suggested_price === row.current_price
            }
            onClick={() => onApply(row)}
          >
            Áp dụng giá
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function PricingManagement() {
  const user = (() => {
    try {
      return JSON.parse(localStorage.getItem("user")) || {};
    } catch {
      return {};
    }
  })();
  const isManager = user.role === "quản lý";
  const [fromDate, setFromDate] = useState(monthStart);
  const [toDate, setToDate] = useState(businessDate);
  const [period, setPeriod] = useState({
    from_date: monthStart(),
    to_date: businessDate(),
  });
  const [category, setCategory] = useState("fuel");
  const [categories, setCategories] = useState(() =>
    Object.entries(CATEGORIES).map(([value, label]) => ({ value, label })),
  );
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [addingCategory, setAddingCategory] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [expenseError, setExpenseError] = useState("");
  const [expenseMessage, setExpenseMessage] = useState("");
  const [amount, setAmount] = useState("");
  const [occurredOn, setOccurredOn] = useState(businessDate);
  const [invoiceId, setInvoiceId] = useState("");
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [invoiceResults, setInvoiceResults] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceSearchError, setInvoiceSearchError] = useState("");
  const [description, setDescription] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [expensePage, setExpensePage] = useState(1);
  const [catalogPage, setCatalogPage] = useState(1);
  const [keywordDraft, setKeywordDraft] = useState("");
  const [keyword, setKeyword] = useState("");
  const [expenses, setExpenses] = useState({
    expenses: [],
    pagination: { total_pages: 1 },
  });
  const [catalog, setCatalog] = useState({
    products: [],
    pagination: { total_pages: 1 },
    pricing_operating_expenses: 0,
    pricing_shipping: 0,
    pricing_units_sold: null,
    pricing_expense_per_unit: null,
  });
  const [applyRow, setApplyRow] = useState(null);
  const [voidRow, setVoidRow] = useState(null);
  const [voidReason, setVoidReason] = useState("");
  const [payRow, setPayRow] = useState(null);
  const [payMethod, setPayMethod] = useState("cash");
  const [busy, setBusy] = useState(false);
  const [loadingExpenses, setLoadingExpenses] = useState(true);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadExpenses = useCallback(async () => {
    const response = await authApis().get(endpoints.pricingExpenses, {
      params: { ...period, page: expensePage },
    });
    setExpenses(response.data);
  }, [period, expensePage]);

  const loadCategories = useCallback(async () => {
    const response = await authApis().get(endpoints.pricingExpenseCategories);
    setCategories(response.data.categories);
  }, []);

  const loadCatalog = useCallback(async () => {
    const response = await authApis().get(endpoints.pricingCatalog, {
      params: { page: catalogPage, keyword },
    });
    setCatalog(response.data);
  }, [catalogPage, keyword]);

  useEffect(() => {
    if (!isManager) return;
    loadCategories().catch((requestError) =>
      setError(getApiError(requestError)),
    );
  }, [isManager, loadCategories]);

  useEffect(() => {
    if (!isManager) return;
    setLoadingExpenses(true);
    loadExpenses()
      .catch((requestError) => setError(getApiError(requestError)))
      .finally(() => setLoadingExpenses(false));
  }, [isManager, loadExpenses]);

  useEffect(() => {
    if (!isManager) return;
    setLoadingCatalog(true);
    loadCatalog()
      .catch((requestError) => setError(getApiError(requestError)))
      .finally(() => setLoadingCatalog(false));
  }, [isManager, loadCatalog]);

  useEffect(() => {
    const nextKeyword = keywordDraft.trim();
    if (nextKeyword === keyword) return undefined;
    const timer = setTimeout(() => {
      setCatalogPage(1);
      setKeyword(nextKeyword);
    }, 500);
    return () => clearTimeout(timer);
  }, [keywordDraft, keyword]);

  useEffect(() => {
    if (!expenseModalOpen) return undefined;
    let active = true;
    setInvoiceLoading(true);
    setInvoiceSearchError("");
    const timer = setTimeout(async () => {
      try {
        const response = await authApis().get(endpoints.salesInvoices, {
          params: { page: 1, per_page: 20, keyword: invoiceSearch.trim() || undefined },
        });
        if (active) setInvoiceResults(response.data.invoices || []);
      } catch (requestError) {
        if (active) {
          setInvoiceResults([]);
          setInvoiceSearchError(getApiError(requestError));
        }
      } finally {
        if (active) setInvoiceLoading(false);
      }
    }, invoiceSearch.trim() ? 250 : 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [expenseModalOpen, invoiceSearch]);

  const invoiceOptions = [
    { value: "", label: "Không gắn đơn (chi phí chung)" },
    ...(!invoiceSearch.trim() && selectedInvoice ? [selectedInvoice] : []),
    ...invoiceResults
      .filter((invoice) => invoice.id !== selectedInvoice?.value || invoiceSearch.trim())
      .map((invoice) => ({
        value: invoice.id,
        label: `${invoice.note?.trim() || `Đơn #${invoice.id}`} - ${invoice.customer?.full_name || "Khách hàng"}`,
      })),
  ];

  const submitExpense = async () => {
    if (invoiceSearch.trim()) {
      setExpenseError("Chọn một đơn trong danh sách hoặc chọn chi phí chung.");
      return;
    }
    if (!category || !amount || !occurredOn || !description.trim()) {
      setExpenseError(
        "Nhập đầy đủ loại, số tiền, ngày và nội dung chi phí.",
      );
      return;
    }
    setBusy(true);
    setExpenseError("");
    setSuccess("");
    try {
      await authApis().post(endpoints.pricingExpenses, {
        category,
        amount: Number(amount),
        occurred_on: occurredOn,
        invoice_id: invoiceId || null,
        description: description.trim(),
        payment_method: paymentMethod || null,
      });
      setAmount("");
      setDescription("");
      setInvoiceId("");
      setSelectedInvoice(null);
      setInvoiceSearch("");
      setPaymentMethod("");
      setExpenseModalOpen(false);
      setAddingCategory(false);
      setExpenseMessage("");
      setSuccess("Đã ghi nhận chi phí.");
      try {
        await Promise.all([loadExpenses(), loadCatalog()]);
      } catch (refreshError) {
        setError(getApiError(refreshError));
      }
    } catch (requestError) {
      setExpenseError(getApiError(requestError));
    } finally {
      setBusy(false);
    }
  };

  const addCategory = async () => {
    const name = categoryName.trim();
    if (!name) return setExpenseError("Nhập tên loại chi phí mới.");
    setBusy(true);
    setExpenseError("");
    setExpenseMessage("");
    try {
      const response = await authApis().post(
        endpoints.pricingExpenseCategories,
        { name },
      );
      const added = response.data.category;
      setCategories((current) => [...current, added]);
      setCategory(added.value);
      setCategoryName("");
      setAddingCategory(false);
      setExpenseMessage(`Đã thêm loại chi phí “${added.label}”.`);
    } catch (requestError) {
      setExpenseError(getApiError(requestError));
    } finally {
      setBusy(false);
    }
  };

  const savePolicy = async (productId, markupPercent) => {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await authApis().put(endpoints.pricingPolicy(productId), {
        markup_percent: Number(markupPercent),
      });
      setSuccess("Đã lưu tỷ lệ lãi. Giá đề xuất đã tính lại.");
      await loadCatalog();
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setBusy(false);
    }
  };

  const applyPrice = async () => {
    if (!applyRow) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await authApis().post(endpoints.pricingApply(applyRow.product_id), {
        expected_price: applyRow.current_price,
        expected_suggested_price: applyRow.suggested_price,
      });
      setSuccess(`Đã cập nhật giá bán mặc định của ${applyRow.name}.`);
      setApplyRow(null);
      await loadCatalog();
    } catch (requestError) {
      setError(getApiError(requestError));
      setApplyRow(null);
    } finally {
      setBusy(false);
    }
  };

  const voidExpense = async () => {
    if (!voidRow || !voidReason.trim()) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await authApis().post(endpoints.pricingExpenseVoid(voidRow.id), {
        reason: voidReason.trim(),
      });
      setVoidRow(null);
      setVoidReason("");
      setSuccess(
        "Đã hủy khoản chi. Nếu đã chi tiền, số dư quỹ đã được hoàn lại.",
      );
      await Promise.all([loadExpenses(), loadCatalog()]);
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setBusy(false);
    }
  };

  const payExpense = async () => {
    if (!payRow) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await authApis().post(endpoints.pricingExpensePay(payRow.id), {
        payment_method: payMethod,
      });
      setPayRow(null);
      setSuccess("Đã ghi khoản chi vào sổ quỹ.");
      await loadExpenses();
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setBusy(false);
    }
  };

  if (!isManager)
    return (
      <div className="pricing-page">
        Chỉ quản lý được xem chi phí và giá bán.
      </div>
    );

  return (
    <div className="pricing-page">
      <header className="pricing-heading">
        <h1>Chi phí &amp; giá bán</h1>
      </header>
      <AutoDismissMessage message={error} className="pricing-error" />
      <AutoDismissMessage message={success} className="pricing-success" />

      <section
        className="pricing-panel"
        aria-labelledby="pricing-expense-heading"
      >
        <div className="pricing-section-head">
          <div>
            <h2 id="pricing-expense-heading">Chi phí phát sinh</h2>
            <p>
              Gắn mã đơn nếu chi phí chỉ thuộc đơn đó. Để trống nếu đây là chi
              phí chung trong kỳ.
            </p>
          </div>
          <button
            type="button"
            className="pricing-primary"
            onClick={() => {
              setExpenseError("");
              setExpenseMessage("");
              setExpenseModalOpen(true);
            }}
          >
            + Ghi chi phí
          </button>
        </div>
        <p className="pricing-hint">
          Phí giao bên thứ ba đã có trên đơn bán được tính tự động. Không nhập
          lại tại đây. Khoản chi ghi quỹ sẽ làm giảm số dư quỹ ngay khi lưu.
        </p>
        <form
          className="pricing-period"
          onSubmit={(event) => {
            event.preventDefault();
            setExpensePage(1);
            setPeriod({ from_date: fromDate, to_date: toDate });
          }}
        >
          <label>
            Từ ngày
            <input
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
              required
            />
          </label>
          <label>
            Đến ngày
            <input
              type="date"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
              required
            />
          </label>
          <button type="submit">Lọc chi phí</button>
        </form>
        <div className="pricing-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Ngày</th>
                <th>Loại</th>
                <th>Nội dung chi phí</th>
                <th>Đơn</th>
                <th>Ghi quỹ</th>
                <th>Số tiền</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {expenses.expenses.map((row) => (
                <tr
                  key={row.id}
                  className={row.voided_at ? "pricing-voided-row" : ""}
                >
                  <td>{row.occurred_on}</td>
                  <td>{row.category_label}</td>
                  <td>{row.description}</td>
                  <td>
                    {row.invoice_id ? `#${row.invoice_id}` : "Chi phí chung"}
                  </td>
                  <td>
                    {row.payment_method === "cash"
                      ? "Tiền mặt"
                      : row.payment_method === "bank_transfer"
                        ? "Chuyển khoản"
                        : "Chưa chi"}
                  </td>
                  <td>{formatCurrency(row.amount)}</td>
                  <td>
                    {row.voided_at ? (
                      <span title={row.void_reason || ""}>Đã hủy</span>
                    ) : (
                      <div className="pricing-row-actions">
                        {!row.payment_method && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              setPayRow(row);
                              setPayMethod("cash");
                            }}
                          >
                            Ghi đã chi
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setVoidRow(row);
                            setVoidReason("");
                          }}
                        >
                          Hủy khoản chi
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {!expenses.expenses.length && (
                <tr>
                  <td colSpan="7">
                    {loadingExpenses
                      ? "Đang tải chi phí..."
                      : "Chưa có chi phí trong kỳ này."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          page={expensePage}
          totalPages={expenses.pagination?.total_pages || 1}
          onPageChange={setExpensePage}
          disabled={busy}
        />
      </section>

      <section
        className="pricing-panel"
        aria-labelledby="pricing-catalog-heading"
      >
        <div className="pricing-section-head">
          <div>
            <h2 id="pricing-catalog-heading">Giá bán đề xuất</h2>
            <p>
              Giá đề xuất = Giá nhập + (Giá nhập × Tỷ lệ lãi) + Chi phí / đơn vị;
              làm tròn lên 1.000 đ.
            </p>
          </div>
          <form
            className="pricing-search"
            onSubmit={(event) => {
              event.preventDefault();
              setCatalogPage(1);
              setKeyword(keywordDraft.trim());
            }}
          >
            <input
              value={keywordDraft}
              onChange={(event) => setKeywordDraft(event.target.value)}
              placeholder="Tìm sản phẩm"
              aria-label="Tìm sản phẩm"
            />
            <button type="submit">Tìm</button>
          </form>
        </div>
        <p className="pricing-hint">
          Chi phí / đơn vị = (Tổng chi phí phát sinh + Tổng phí giao ngoài) ÷
          Tổng số lượng đã bán trong 30 ngày.
        </p>
        <div className="pricing-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Sản phẩm</th>
                <th title="Lấy từ phiếu nhập; nếu có nhiều lần nhập với giá khác nhau, hệ thống tính theo số lượng nhập.">Giá nhập</th>
                <th>Chi phí / đơn vị</th>
                <th>Lãi trên giá nhập %</th>
                <th>Giá đề xuất</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {catalog.products.map((row) => (
                <PricingRow
                  key={row.product_id}
                  row={row}
                  onSave={savePolicy}
                  onApply={setApplyRow}
                  busy={busy}
                />
              ))}
              {!catalog.products.length && (
                <tr>
                  <td colSpan="6">
                    {loadingCatalog
                      ? "Đang tải giá đề xuất..."
                      : "Chưa có sản phẩm phù hợp."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          page={catalogPage}
          totalPages={catalog.pagination?.total_pages || 1}
          onPageChange={setCatalogPage}
          disabled={busy}
        />
        <p className="pricing-hint">
          Giá này là gợi ý quản trị. Khi áp dụng, giá bán mặc định thay đổi và
          giới hạn ±10% của đơn bán sẽ dùng giá mới.
        </p>
      </section>
      <ConfirmDialog
        open={expenseModalOpen}
        className="pricing-expense-dialog"
        title="Ghi chi phí phát sinh"
        confirmLabel="Ghi nhận chi phí"
        onConfirm={submitExpense}
        onCancel={() => {
          setExpenseModalOpen(false);
          setAddingCategory(false);
          setCategoryName("");
        }}
        loading={busy}
      >
        <div className="pricing-expense-form">
          <div className="pricing-category-field">
            <label>
              Loại chi phí
              <SearchableDropdown
                value={category}
                onChange={setCategory}
                options={categories}
                placeholder="Chọn loại chi phí"
                ariaLabel="Loại chi phí"
              />
            </label>
            <button
              type="button"
              onClick={() => {
                setAddingCategory((current) => !current);
                setExpenseError("");
              }}
              disabled={busy}
            >
              + Thêm loại chi phí
            </button>
          </div>
          {addingCategory && (
            <div className="pricing-new-category">
              <label>
                Tên loại chi phí mới
                <input
                  value={categoryName}
                  onChange={(event) => setCategoryName(event.target.value)}
                  maxLength={120}
                  placeholder="Ví dụ: Tiền điện kho"
                />
              </label>
              <button
                type="button"
                onClick={addCategory}
                disabled={busy || !categoryName.trim()}
              >
                Lưu loại
              </button>
            </div>
          )}
          <label>
            Số tiền
            <MoneyInput
              value={amount}
              onChange={setAmount}
              label="Số tiền chi phí"
              required
            />
          </label>
          <label>
            Ngày phát sinh
            <input
              type="date"
              value={occurredOn}
              onChange={(event) => setOccurredOn(event.target.value)}
              required
            />
          </label>
          <label>
            Đơn liên quan (nếu có)
            <SearchableDropdown
              value={invoiceId}
              onChange={(value, label) => {
                setInvoiceId(value);
                setSelectedInvoice(value ? { value, label } : null);
                setInvoiceSearch("");
              }}
              options={invoiceOptions}
              searchValue={invoiceSearch}
              onSearchChange={setInvoiceSearch}
              searching={invoiceLoading}
              emptyLabel={invoiceSearchError || "Không tìm thấy đơn hàng."}
              placeholder="Tìm tên đơn, tên khách hoặc số đơn"
              ariaLabel="Tìm đơn liên quan"
            />
          </label>
          <label>
            Ghi quỹ
            <SearchableDropdown
              value={paymentMethod}
              onChange={setPaymentMethod}
              options={PAYMENT_METHOD_OPTIONS}
              placeholder="Chọn trạng thái ghi quỹ"
              ariaLabel="Ghi quỹ"
            />
          </label>
          <label className="pricing-description">
            Nội dung chi phí
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Ví dụ: Xăng chuyến giao đơn 23"
              required
            />
          </label>
          {expenseError && (
            <p className="pricing-form-error" role="alert">
              {expenseError}
            </p>
          )}
          {expenseMessage && (
            <p className="pricing-form-success" role="status">
              {expenseMessage}
            </p>
          )}
        </div>
      </ConfirmDialog>
      <ConfirmDialog
        open={Boolean(applyRow)}
        title="Áp dụng giá bán đề xuất?"
        message={
          applyRow
            ? `Đổi giá mặc định của ${applyRow.name} từ ${formatCurrency(applyRow.current_price)} sang ${formatCurrency(applyRow.suggested_price)}?`
            : ""
        }
        confirmLabel="Áp dụng giá"
        onConfirm={applyPrice}
        onCancel={() => setApplyRow(null)}
        loading={busy}
      />
      <ConfirmDialog
        open={Boolean(voidRow)}
        title="Hủy khoản chi?"
        message={
          voidRow
            ? `${voidRow.category_label}: ${formatCurrency(voidRow.amount)}. Khoản đã chi sẽ được hoàn vào quỹ.`
            : ""
        }
        confirmLabel="Hủy khoản chi"
        onConfirm={voidExpense}
        onCancel={() => setVoidRow(null)}
        loading={busy}
        confirmDisabled={!voidReason.trim()}
        danger
      >
        <div className="pricing-void-dialog">
          <label>
            Lý do hủy
            <input
              value={voidReason}
              onChange={(event) => setVoidReason(event.target.value)}
              maxLength={500}
              placeholder="Nhập lý do để lưu lịch sử"
            />
          </label>
        </div>
      </ConfirmDialog>
      <ConfirmDialog
        open={Boolean(payRow)}
        title="Ghi đã chi tiền?"
        message={
          payRow
            ? `${payRow.category_label}: ${formatCurrency(payRow.amount)}. Số dư quỹ đã chọn sẽ giảm ngay.`
            : ""
        }
        confirmLabel="Ghi đã chi"
        onConfirm={payExpense}
        onCancel={() => setPayRow(null)}
        loading={busy}
      >
        <div className="pricing-void-dialog">
          <label>
            Chi từ quỹ
            <SearchableDropdown
              value={payMethod}
              onChange={setPayMethod}
              options={PAID_FROM_OPTIONS}
              placeholder="Chọn quỹ"
              ariaLabel="Chi từ quỹ"
            />
          </label>
        </div>
      </ConfirmDialog>
    </div>
  );
}
