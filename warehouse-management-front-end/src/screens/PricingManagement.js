import React, { useCallback, useEffect, useState } from "react";
import { authApis, endpoints } from "../configs/Apis";
import AutoDismissMessage from "../components/AutoDismissMessage";
import ConfirmDialog from "../components/ConfirmDialog";
import MoneyInput from "../components/MoneyInput";
import Pagination from "../components/Pagination";
import SearchableDropdown from "../components/SearchableDropdown";
import { getApiError } from "../utils/apiError";
import { formatCurrency, formatQuantity } from "../utils/money";
import "../css/PricingManagement.css";

const CATEGORIES = {
  fuel: "Xăng xe",
  utilities: "Điện nước",
  vehicle_repair: "Sửa xe",
  maintenance: "Bảo trì",
  shrinkage: "Hao hụt",
  lodging: "Nhà nghỉ",
  sales_salary: "Lương nhân viên",
  overtime: "Tiền tăng ca",
  depreciation: "Khấu hao xe, thiết bị",
  other: "Chi phí bán hàng khác",
};
const unitCostFormatter = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 });
const formatUnitCost = (value) => {
  const amount = Number(value);
  return `${unitCostFormatter.format(Math.sign(amount) * Math.ceil(Math.abs(amount)))} đ`;
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

function formatExpenseDate(value) {
  const [year, month, day] = String(value || "").split("-");
  return year && month && day ? `${day}-${month}-${year}` : "—";
}

function formatExpenseMonth(value) {
  const [year, month] = String(value || "").split("-");
  return year && month ? `${month}/${year}` : "—";
}

export function PricingRow({ row, onSave, onApply, busy, costMode }) {
  const [profit, setProfit] = useState(String(row.markup_percent ?? "20"));
  const [plannedQuantity, setPlannedQuantity] = useState(
    String(row.planned_quantity),
  );
  const [editingQuantity, setEditingQuantity] = useState(false);
  const [referencePrice, setReferencePrice] = useState(String(row.reference_price ?? ""));
  const [roundingStep, setRoundingStep] = useState(String(row.rounding_step || 1000));
  const [details, setDetails] = useState(null);
  const [detailsError, setDetailsError] = useState("");
  const [detailsLoading, setDetailsLoading] = useState(false);
  useEffect(() => {
    setProfit(String(row.markup_percent ?? "20"));
    setPlannedQuantity(String(row.planned_quantity));
    setReferencePrice(String(row.reference_price ?? ""));
    setRoundingStep(String(row.rounding_step || 1000));
    setDetails(null);
  }, [row.markup_percent, row.planned_quantity, row.reference_price, row.rounding_step]);
  const changed =
    row.legacy_fixed_profit ||
    !row.reference_confirmed ||
    Number(profit) !== row.markup_percent ||
    Number(plannedQuantity) !== Number(row.planned_quantity) ||
    Number(referencePrice) !== row.reference_price ||
    Number(roundingStep) !== row.rounding_step;
  const valid =
    /^\d+(?:\.\d{1,2})?$/.test(profit) &&
    Number(profit) < 100 &&
    Number(referencePrice) > 0 &&
    Number.isFinite(Number(referencePrice)) &&
    /^\d{1,15}(?:\.\d{1,3})?$/.test(plannedQuantity) &&
    Number(plannedQuantity) > 0;
  const showDetails = async () => {
    if (detailsLoading) return;
    if (details) { setDetails(null); return; }
    setDetailsLoading(true);
    setDetailsError("");
    try {
      const response = await authApis().get(endpoints.pricingBreakdown(row.product_id), { params: { cost_mode: costMode } });
      setDetails(response.data);
    } catch (error) {
      setDetailsError(getApiError(error));
    } finally {
      setDetailsLoading(false);
    }
  };
  return (
    <>
    <tr
      className={`pricing-product-row${details ? " is-expanded" : ""}`}
      tabIndex={0}
      aria-label={`${row.name}: nhấn Enter để xem chi phí chung và chi phí đơn/chuyến`}
      onClick={(event) => {
        if (!event.target.closest?.("input, select, button, a, textarea, label")) {
          showDetails();
        }
      }}
      onKeyDown={(event) => {
        if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          showDetails();
        }
      }}
    >
      <th scope="row">
        <strong><span className="pricing-row-indicator" aria-hidden="true">▸</span>{row.name}</strong>
        <small>/{row.unit}</small>
      </th>
      <td>
        {row.estimated_unit_cost == null ? (
          <span className="pricing-warning">Chưa có giá nhập</span>
        ) : (
          formatUnitCost(row.estimated_unit_cost)
        )}
      </td>
      <td>
        {row.shared_expense_per_unit == null ? (
          <span className="pricing-warning">Chưa tính được</span>
        ) : (
          <span className="pricing-cost-value">{formatUnitCost(row.shared_expense_per_unit)}</span>
        )}
      </td>
      <td><span className="pricing-cost-value">{formatUnitCost(row.direct_expense_per_unit || 0)}</span></td>
      <td>
        {row.full_cost_per_unit == null
          ? "—"
          : formatUnitCost(row.full_cost_per_unit)}
      </td>
      <td>
        <input
          className="pricing-plan-input"
          type="text"
          inputMode="decimal"
          aria-label={`Sản lượng dự kiến ${row.name}`}
          value={editingQuantity || !/^\d+(?:\.\d{0,3})?$/.test(plannedQuantity)
            ? plannedQuantity
            : formatQuantity(plannedQuantity)}
          onFocus={() => {
            if (plannedQuantity && Number.isFinite(Number(plannedQuantity))) {
              setPlannedQuantity(String(Number(plannedQuantity)));
            }
            setEditingQuantity(true);
          }}
          onBlur={() => setEditingQuantity(false)}
          onChange={(event) =>
            setPlannedQuantity(event.target.value.replace(",", "."))
          }
          title="Ví dụ: 1.000 là một nghìn; 0,5 là nửa đơn vị. Khi sửa, nhập 1000 hoặc 0,5."
        />
      </td>
      <td>{row.planned_revenue == null ? "—" : formatCurrency(row.planned_revenue)}</td>
      <td><input type="number" min="0.01" step="0.01" value={referencePrice} aria-label={`Giá bán tham chiếu ${row.name}`} onChange={(event) => setReferencePrice(event.target.value)} /></td>
      <td>
        <input
          type="number"
          min="0"
          max="99.99"
          step="0.01"
          aria-label={`Phần trăm lãi trên COST của ${row.name}`}
          value={profit}
          onChange={(event) => setProfit(event.target.value)}
        />
        {row.legacy_fixed_profit && (
          <small className="pricing-legacy-note">
            Kế hoạch tiền lời cũ: lưu % trước khi áp dụng giá.
          </small>
        )}
      </td>
      <td><select value={roundingStep} aria-label={`Bước làm tròn ${row.name}`} onChange={(event) => setRoundingStep(event.target.value)}>
        {[1, 10, 100, 1000, 10000].map((step) => <option key={step} value={step}>{new Intl.NumberFormat("vi-VN").format(step)} đ</option>)}
      </select></td>
      <td
        title={
          row.actual_markup_percent == null
            ? undefined
            : `Lãi thực sau làm tròn: ${row.actual_markup_percent}% trên COST`
        }
      >
        {row.actual_profit_per_unit == null
          ? "—"
          : formatUnitCost(row.actual_profit_per_unit)}
      </td>
      <td>
        <strong>
          {row.suggested_price == null
            ? "—"
            : formatCurrency(row.suggested_price)}
        </strong>
      </td>
      <td className="pricing-current-price">
        <strong>{formatCurrency(row.current_price)}</strong>
        {row.profit_at_current_price_per_unit < 0 && (
          <small className="pricing-cost-loss">
            Giá đang áp dụng thấp hơn COST{" "}
            {formatUnitCost(-row.profit_at_current_price_per_unit)}/đơn vị
          </small>
        )}
      </td>
      <td>{row.profit_at_current_price_per_unit == null ? "—" : <>{formatUnitCost(row.profit_at_current_price_per_unit)}<small>{row.markup_at_current_price_percent}% trên COST</small></>}</td>
      <td>
        <div className="pricing-row-actions">
          <button
            type="button"
            disabled={busy || !changed || !valid}
            onClick={() =>
              onSave(row.product_id, {
                planned_quantity: plannedQuantity,
                markup_percent: Number(profit),
                reference_price: Number(referencePrice),
                rounding_step: Number(roundingStep),
              })
            }
          >
            Lưu kế hoạch
          </button>
          <button
            type="button"
            className="pricing-primary"
            disabled={
              busy ||
              changed ||
              row.legacy_fixed_profit ||
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
    {(details || detailsError || detailsLoading) && <tr className="pricing-detail-row"><td colSpan="15">
      {detailsLoading && <span>Đang tải chi tiết chi phí…</span>}
      {detailsError && <span className="pricing-warning">{detailsError}</span>}
      {details && <div className="pricing-breakdown">
        <strong>Chi phí chung</strong>
        {details.shared.length ? details.shared.map((entry) => <div key={`s-${entry.id}`}>{entry.occurred_on} · {CATEGORIES[entry.category] || entry.category}: {entry.description} · {formatUnitCost(entry.per_unit)}/{row.unit}</div>) : <p>Không có khoản chi chung.</p>}
        <strong>Chi phí đơn/chuyến</strong>
        <p>Mức trong bảng là bình quân theo số lượng của các đơn/chuyến có chi phí. Mỗi dòng dưới đây là chi phí trên một đơn vị của đơn/chuyến đó.</p>
        {details.direct.length ? details.direct.map((entry, index) => <div key={`d-${entry.id || "ship"}-${index}`}>{entry.trip_invoice_ids?.length ? `Chuyến ${entry.trip_invoice_ids.map((id) => `#${id}`).join(", ")}` : `Đơn #${entry.invoice_id}`} · {CATEGORIES[entry.category] || entry.category}: {entry.description} · {formatUnitCost(entry.per_unit)}/{row.unit}</div>) : <p>Không có khoản chi gắn đơn/chuyến.</p>}
      </div>}
    </td></tr>}
    </>
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
  const [expenseType, setExpenseType] = useState("incidental");
  const [category, setCategory] = useState("fuel");
  const [categories, setCategories] = useState(() =>
    Object.entries(CATEGORIES).map(([value, label]) => ({ value, label })),
  );
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [editReason, setEditReason] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [expenseError, setExpenseError] = useState("");
  const [expenseMessage, setExpenseMessage] = useState("");
  const [amount, setAmount] = useState("");
  const [occurredOn, setOccurredOn] = useState(businessDate);
  const [invoiceId, setInvoiceId] = useState("");
  const [tripInvoiceIds, setTripInvoiceIds] = useState([]);
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [invoiceResults, setInvoiceResults] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceSearchError, setInvoiceSearchError] = useState("");
  const [description, setDescription] = useState("");
  const [isAbnormal, setIsAbnormal] = useState(false);
  const [allocationBasis, setAllocationBasis] = useState("revenue");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [expensePage, setExpensePage] = useState(1);
  const [catalogPage, setCatalogPage] = useState(1);
  const [costMode, setCostMode] = useState("actual");
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
    pricing_shared_expenses: 0,
    pricing_allocated_expenses: 0,
    pricing_actual_shared_expenses: 0,
    pricing_direct_expenses: 0,
    pricing_abnormal_expenses: 0,
    pricing_salary_expenses: 0,
    pricing_incidental_expenses: 0,
    pricing_shipping: 0,
    pricing_period_start: "",
    pricing_period_end: "",
    pricing_planned_salary_amount: null,
    pricing_planned_revenue_amount: null,
    pricing_estimated_salary: 0,
    pricing_salary_confirmed: false,
    pricing_average_3m_expenses: 0,
    pricing_average_3m_available: false,
    pricing_cost_warnings: [],
    pricing_planned_value: 0,
  });
  const [monthlyProfit, setMonthlyProfit] = useState(null);
  const [plannedSalaryDraft, setPlannedSalaryDraft] = useState("");
  const [plannedRevenueDraft, setPlannedRevenueDraft] = useState("");
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
  const formIsSalary =
    (editingExpense?.expense_type || expenseType) === "fixed_salary";
  const incidentCategories = categories.filter(
    (item) => item.value !== "sales_salary",
  );
  const paidAmountChanged = Boolean(
    editingExpense?.payment_method &&
    Number(amount) !== Number(editingExpense.amount),
  );

  const loadExpenses = useCallback(async () => {
    const response = await authApis().get(endpoints.pricingExpenses, {
      params: { ...period, page: expensePage, expense_type: expenseType },
    });
    setExpenses(response.data);
  }, [period, expensePage, expenseType]);

  const loadCategories = useCallback(async () => {
    const response = await authApis().get(endpoints.pricingExpenseCategories);
    setCategories(response.data.categories);
  }, []);

  const loadCatalog = useCallback(async () => {
    const response = await authApis().get(endpoints.pricingCatalog, {
      params: { page: catalogPage, keyword, cost_mode: costMode },
    });
    setCatalog(response.data);
  }, [catalogPage, keyword, costMode]);

  useEffect(() => {
    setPlannedSalaryDraft(
      catalog.pricing_planned_salary_amount == null
        ? ""
        : String(catalog.pricing_planned_salary_amount),
    );
  }, [catalog.pricing_planned_salary_amount]);
  useEffect(() => {
    setPlannedRevenueDraft(catalog.pricing_planned_revenue_amount == null ? "" : String(catalog.pricing_planned_revenue_amount));
  }, [catalog.pricing_planned_revenue_amount]);

  const loadMonthlyProfit = useCallback(async () => {
    const response = await authApis().get(endpoints.pricingProfitability, {
      params: { from_date: monthStart(), to_date: businessDate(), page: 1 },
    });
    setMonthlyProfit(response.data);
  }, []);

  useEffect(() => {
    if (!isManager) return;
    loadCategories().catch((requestError) =>
      setError(getApiError(requestError)),
    );
  }, [isManager, loadCategories]);

  useEffect(() => {
    if (!isManager) return;
    setLoadingExpenses(true);
    setExpenses({ expenses: [], pagination: { total_pages: 1 } });
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
    if (!isManager) return;
    loadMonthlyProfit().catch((requestError) =>
      setError(getApiError(requestError)),
    );
  }, [isManager, loadMonthlyProfit]);

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
    if (!expenseModalOpen || formIsSalary) return undefined;
    let active = true;
    setInvoiceLoading(true);
    setInvoiceSearchError("");
    const timer = setTimeout(
      async () => {
        try {
          const response = await authApis().get(endpoints.salesInvoices, {
            params: {
              page: 1,
              per_page: 20,
              keyword: invoiceSearch.trim() || undefined,
            },
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
      },
      invoiceSearch.trim() ? 250 : 0,
    );
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [expenseModalOpen, formIsSalary, invoiceSearch]);

  const invoiceOptions = [
    { value: "", label: "Không gắn đơn (chi phí chung)" },
    ...(!invoiceSearch.trim() && selectedInvoice ? [selectedInvoice] : []),
    ...invoiceResults
      .filter(
        (invoice) =>
          invoice.id !== selectedInvoice?.value || invoiceSearch.trim(),
      )
      .map((invoice) => ({
        value: invoice.id,
        label: `${invoice.note?.trim() || `Đơn #${invoice.id}`} - ${invoice.customer?.full_name || "Khách hàng"}`,
      })),
  ];

  const openExpenseModal = (row = null) => {
    setEditingExpense(row);
    setCategory(
      row?.category ||
        (expenseType === "fixed_salary" ? "sales_salary" : "fuel"),
    );
    setAmount(row ? String(row.amount) : "");
    if (
      !row &&
      expenseType === "fixed_salary" &&
      catalog.pricing_planned_salary_amount != null
    ) {
      setAmount(String(catalog.pricing_planned_salary_amount));
    }
    setOccurredOn(row?.occurred_on || businessDate());
    setDescription(row?.description || "");
    setIsAbnormal(Boolean(row?.is_abnormal));
    setAllocationBasis(row?.allocation_basis || "revenue");
    setInvoiceId(row?.invoice_id ? String(row.invoice_id) : "");
    setTripInvoiceIds((row?.trip_invoice_ids || []).map(String));
    setSelectedInvoice(
      row?.invoice_id
        ? { value: row.invoice_id, label: `Đơn #${row.invoice_id}` }
        : null,
    );
    setInvoiceSearch("");
    setPaymentMethod(row?.payment_method || "");
    setEditReason("");
    setExpenseError("");
    setExpenseMessage("");
    setAddingCategory(false);
    setExpenseModalOpen(true);
  };

  const closeExpenseModal = () => {
    setExpenseModalOpen(false);
    setEditingExpense(null);
    setAddingCategory(false);
    setCategoryName("");
  };

  const submitExpense = async () => {
    if (!formIsSalary && invoiceSearch.trim()) {
      setExpenseError("Chọn một đơn trong danh sách hoặc chọn chi phí chung.");
      return;
    }
    if (
      (!formIsSalary && !category) ||
      !amount ||
      !occurredOn ||
      !description.trim()
    ) {
      setExpenseError("Nhập đầy đủ loại, số tiền, ngày và nội dung chi phí.");
      return;
    }
    if (paidAmountChanged && !editReason.trim()) {
      setExpenseError("Nhập lý do sửa số tiền đã chi để lưu vào sổ quỹ.");
      return;
    }
    setBusy(true);
    setExpenseError("");
    setSuccess("");
    try {
      const payload = {
        category: formIsSalary ? "sales_salary" : category,
        amount: Number(amount),
        occurred_on: occurredOn,
        invoice_id: formIsSalary
          ? editingExpense?.invoice_id || null
          : tripInvoiceIds.length ? null : invoiceId || null,
        trip_invoice_ids: formIsSalary ? null : tripInvoiceIds.length
          ? [...new Set([...tripInvoiceIds, ...(invoiceId ? [String(invoiceId)] : [])])].map(Number)
          : null,
        description: description.trim(),
        is_abnormal: formIsSalary ? false : isAbnormal,
        allocation_basis: formIsSalary ? "revenue" : allocationBasis,
      };
      if (editingExpense) {
        await authApis().put(endpoints.pricingExpense(editingExpense.id), {
          ...payload,
          reason: paidAmountChanged ? editReason.trim() : undefined,
        });
      } else {
        await authApis().post(endpoints.pricingExpenses, {
          ...payload,
          payment_method: paymentMethod || null,
        });
      }
      closeExpenseModal();
      setSuccess("Đã ghi nhận chi phí theo ngày phát sinh và tính lại COST dự kiến.");
      try {
        await Promise.all([loadExpenses(), loadCatalog(), loadMonthlyProfit()]);
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

  const savePolicy = async (productId, policy) => {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await authApis().put(endpoints.pricingPolicy(productId), policy);
      setSuccess(
        "Đã lưu sản lượng dự kiến và % lãi trên COST. Giá đề xuất đã tính lại.",
      );
      await loadCatalog();
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setBusy(false);
    }
  };

  const saveSalaryPlan = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await authApis().put(endpoints.pricingCycle, {
        planned_salary_amount:
          plannedSalaryDraft === "" ? null : plannedSalaryDraft,
        planned_revenue_amount:
          plannedRevenueDraft === "" ? null : plannedRevenueDraft,
      });
      setSuccess(
        "Đã lưu kế hoạch tháng. COST dùng chi phí theo ngày phát sinh, kể cả khoản chưa thanh toán.",
      );
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
        cost_mode: applyRow.cost_mode,
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
      await Promise.all([loadExpenses(), loadCatalog(), loadMonthlyProfit()]);
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
      setSuccess("Đã ghi thanh toán vào sổ quỹ; COST theo ngày phát sinh giữ nguyên.");
      await Promise.all([loadExpenses(), loadCatalog()]);
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
      <AutoDismissMessage
        message={success}
        type="success"
        role="status"
        className="pricing-success"
      />

      <section
        className="pricing-panel"
        aria-labelledby="pricing-expense-heading"
      >
        <div className="pricing-section-head">
          <div>
            <h2 id="pricing-expense-heading">Chi phí kinh doanh</h2>
            <p>
              Lương và chi phí phát sinh chỉ được tính vào giá đề xuất sau khi
              đã thanh toán. Khoản bất thường vẫn vào báo cáo nhưng không tính giá.
            </p>
          </div>
          <button
            type="button"
            className="pricing-primary"
            onClick={() => openExpenseModal()}
          >
            {expenseType === "fixed_salary" ? "+ Ghi lương" : "+ Ghi chi phí"}
          </button>
        </div>
        <div
          className="pricing-expense-tabs"
          role="group"
          aria-label="Nhóm chi phí"
        >
          <button
            type="button"
            className={expenseType === "incidental" ? "is-active" : ""}
            aria-pressed={expenseType === "incidental"}
            onClick={() => {
              setExpensePage(1);
              setExpenseType("incidental");
            }}
          >
            Chi phí phát sinh
          </button>
          <button
            type="button"
            className={expenseType === "fixed_salary" ? "is-active" : ""}
            aria-pressed={expenseType === "fixed_salary"}
            onClick={() => {
              setExpensePage(1);
              setExpenseType("fixed_salary");
            }}
          >
            Lương nhân viên (thực tế)
          </button>
        </div>

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
                <th>Loại chi phí</th>
                <th>Nội dung chi phí</th>
                <th>Đơn</th>
                <th>Thanh toán / tính giá</th>
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
                  <td>{formatExpenseDate(row.occurred_on)}</td>
                  <td>
                    {row.category_label}
                    {row.is_abnormal && (
                      <small className="pricing-abnormal-note">
                        Bất thường
                      </small>
                    )}
                  </td>
                  <td>{row.description}</td>
                  <td>
                    {row.trip_invoice_ids?.length ? `Chuyến: ${row.trip_invoice_ids.map((id) => `#${id}`).join(", ")}` : row.invoice_id ? `#${row.invoice_id}` : "Chi phí chung"}
                  </td>
                  <td>
                    <span className="pricing-payment-method">
                      {row.payment_method === "cash"
                        ? "Tiền mặt"
                        : row.payment_method === "bank_transfer"
                          ? "Chuyển khoản"
                          : "Chưa thanh toán"}
                    </span>
                    <small
                      className={`pricing-price-status ${
                        row.voided_at
                          ? "is-voided"
                          : row.is_abnormal
                            ? "is-excluded"
                            : "is-included"
                      }`}
                      title="Giá đề xuất dùng chi phí theo tháng phát sinh; thanh toán chỉ ảnh hưởng sổ quỹ."
                    >
                      {row.voided_at
                        ? "Đã hủy · không tính giá"
                        : row.is_abnormal
                          ? "Bất thường · không tính giá"
                          : row.payment_method
                            ? "Đã chi · tính giá"
                            : "Chưa chi · tính giá"}
                    </small>
                  </td>
                  <td>{formatCurrency(row.amount)}</td>
                  <td>
                    {row.voided_at ? (
                      <span title={row.void_reason || ""}>Đã hủy</span>
                    ) : (
                      <div className="pricing-row-actions">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => openExpenseModal(row)}
                        >
                          Sửa
                        </button>
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
                      : expenseType === "fixed_salary"
                        ? "Chưa có lương nhân viên trong khoảng ngày này."
                        : "Chưa có chi phí phát sinh trong khoảng ngày này."}
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
              COST đầy đủ = Giá nhập về kho + chi phí chung + chi phí gắn đơn/chuyến.
              Chi phí chung phân bổ theo doanh thu kế hoạch đã xác nhận. Giá tham chiếu cố định,
              giá đề xuất chưa VAT và chỉ thành giá bán khi quản lý áp dụng.
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
        <form className="pricing-cycle-form" onSubmit={saveSalaryPlan}>
          <div className="pricing-cycle-heading">
            <div>
              <h3>Kế hoạch tính giá tháng {formatExpenseMonth(catalog.pricing_period_start)}</h3>
              <p>Nhập số đã được quản lý xác nhận để phân bổ chi phí chung cho từng sản phẩm.</p>
            </div>
          </div>
          <div className="pricing-controls">
            <label className="pricing-control" htmlFor="pricing-cost-mode">
              Nguồn chi phí tính giá
              <select
                id="pricing-cost-mode"
                value={costMode}
                onChange={(event) => setCostMode(event.target.value)}
              >
                <option value="actual">Chi phí tháng này</option>
                <option
                  value="average_3m"
                  disabled={!catalog.pricing_average_3m_available}
                >
                  Bình quân 3 tháng trước
                </option>
              </select>
              <small>Chọn chi phí thực tế tháng này hoặc bình quân 3 tháng.</small>
            </label>
            <label className="pricing-control" htmlFor="pricing-revenue-plan">
              Doanh thu kế hoạch toàn công ty (đ/tháng)
              <span className="pricing-money-input">
                <input id="pricing-revenue-plan" type="number" min="0.01" step="0.01" value={plannedRevenueDraft}
                  onChange={(event) => setPlannedRevenueDraft(event.target.value)}
                  placeholder="Nhập doanh thu đã xác nhận" />
                <span>đ</span>
              </span>
              <small>{plannedRevenueDraft && Number(plannedRevenueDraft) > 0
                ? `Đã nhập: ${formatCurrency(Number(plannedRevenueDraft))}`
                : "Dùng để chia chi phí chung theo doanh thu dự kiến."}</small>
            </label>
            <div className="pricing-control pricing-salary-control">
              <label
                htmlFor="pricing-salary-plan"
                title="Dùng cho COST dự kiến khi chưa ghi lương thực tế; báo cáo lãi/lỗ chỉ tính lương đã ghi nhận"
              >
                Lương kế hoạch (đ/tháng)
              </label>
              <span className="pricing-money-input">
                <input
                  id="pricing-salary-plan"
                  type="number"
                  min="0"
                  step="0.01"
                  value={plannedSalaryDraft}
                  onChange={(event) =>
                    setPlannedSalaryDraft(event.target.value)
                  }
                  placeholder="Chưa thiết lập"
                />
                <span>đ</span>
              </span>
              <small>{plannedSalaryDraft !== "" && Number(plannedSalaryDraft) >= 0
                ? `Đã nhập: ${formatCurrency(Number(plannedSalaryDraft))}`
                : "Có thể để trống; chỉ dùng khi chưa ghi lương thực tế."}</small>
            </div>
          </div>
          <div className="pricing-cycle-actions">
            <span>Nút này lưu doanh thu và lương kế hoạch của cả tháng. Kế hoạch từng sản phẩm lưu ở bảng bên dưới.</span>
            <button
              type="submit"
              className="pricing-primary"
              disabled={
                busy ||
                (plannedSalaryDraft !== "" &&
                  (!Number.isFinite(Number(plannedSalaryDraft)) ||
                    Number(plannedSalaryDraft) < 0)) ||
                (plannedRevenueDraft !== "" && (!Number.isFinite(Number(plannedRevenueDraft)) || Number(plannedRevenueDraft) <= 0)) ||
                (plannedSalaryDraft ===
                  (catalog.pricing_planned_salary_amount == null
                    ? ""
                    : String(catalog.pricing_planned_salary_amount)) &&
                 plannedRevenueDraft === (catalog.pricing_planned_revenue_amount == null ? "" : String(catalog.pricing_planned_revenue_amount)))
              }
            >
              Lưu kế hoạch tháng
            </button>
          </div>
          <div className="pricing-snapshot">
            <div className="pricing-metric">
              <span title="Chi phí chung theo kỳ phát sinh; dùng lương kế hoạch nếu chưa ghi lương thực tế. Chi phí gắn đơn và bất thường theo dõi riêng.">
                Chi phí chung tính giá
              </span>
              <strong>
                {formatCurrency(catalog.pricing_allocated_expenses || 0)}
              </strong>
            </div>
            {monthlyProfit && (
              <div className="pricing-metric">
                <span title="Báo cáo lãi/lỗ gồm chi phí đã ghi, kể cả khoản chưa thanh toán; không cộng lương kế hoạch">
                  Lãi/lỗ tháng này{monthlyProfit.cogs_status === "recorded" ? "" : " (ước tính)"}
                </span>
                <strong>
                  {monthlyProfit.estimated_operating_profit == null
                    ? "Chưa đủ giá vốn"
                    : formatCurrency(monthlyProfit.operating_profit ?? monthlyProfit.estimated_operating_profit)}
                </strong>
              </div>
            )}
          </div>
        </form>
        {(catalog.pricing_cost_warnings || []).map((warning) => (
          <p className="pricing-cost-warning" key={warning} role="status">
            {warning}
          </p>
        ))}
        <p className="pricing-number-hint">Dấu chấm tách hàng nghìn (1.000 = một nghìn); dấu phẩy chỉ sản lượng lẻ (0,5 = nửa đơn vị). Tiền/đơn vị hiển thị làm tròn lên đồng nguyên.</p>
        <div className="pricing-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Sản phẩm</th>
                <th title="Bình quân từ phiếu nhập, gồm phí đưa hàng về kho được chia theo giá trị từng dòng.">
                  Giá nhập về kho
                </th>
                 <th>Chi phí chung / đơn vị</th>
                 <th>Chi phí riêng / đơn vị</th>
                <th>COST đầy đủ</th>
                <th>Sản lượng dự kiến</th>
                 <th>Doanh thu dự kiến</th>
                 <th>Giá tham chiếu</th>
                <th>% lãi trên COST</th>
                 <th>Làm tròn lên</th>
                <th>Lãi dự kiến / đơn vị</th>
                <th>Giá đề xuất</th>
                <th title="Giá bán mặc định hiện tại của sản phẩm">Giá bán đang áp dụng</th>
                 <th>Lãi tại giá đang bán</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {catalog.products.map((row) => (
                <PricingRow
                  key={row.product_id}
                  row={row}
                  onSave={savePolicy}
                  onApply={(rowToApply) =>
                    setApplyRow({ ...rowToApply, cost_mode: costMode })
                  }
                  busy={busy}
                  costMode={costMode}
                />
              ))}
              {!catalog.products.length && (
                <tr>
                   <td colSpan="15">
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
        title={`${editingExpense ? "Sửa" : "Ghi"} ${formIsSalary ? "lương nhân viên" : "chi phí phát sinh"}`}
        confirmLabel={editingExpense ? "Lưu thay đổi" : "Ghi nhận chi phí"}
        onConfirm={submitExpense}
        onCancel={closeExpenseModal}
        loading={busy}
      >
        <div className="pricing-expense-form">
          {formIsSalary ? (
            <p className="pricing-form-note">
              {editingExpense?.invoice_id
                ? `Khoản lương cũ đang gắn đơn #${editingExpense.invoice_id}; thông tin này được giữ nguyên khi sửa.`
                : "Ghi tổng lương thực tế của tháng. Mức kế hoạch chỉ là gợi ý, không tự ghi chi phí hoặc ghi quỹ."}
            </p>
          ) : (
            <div className="pricing-category-field">
              <label>
                Loại chi phí
                <SearchableDropdown
                  value={category}
                  onChange={setCategory}
                  options={incidentCategories}
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
          )}
          {!formIsSalary && addingCategory && (
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
          {!formIsSalary && (
            <div>
              <label>
              Đơn liên quan (nếu có)
              <SearchableDropdown
                value={invoiceId}
                onChange={(value, label) => {
                  setInvoiceId(value);
                  if (!value && !tripInvoiceIds.length) setAllocationBasis("revenue");
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
              <button type="button" disabled={!invoiceId || tripInvoiceIds.includes(String(invoiceId))}
                onClick={() => { setTripInvoiceIds((ids) => [...ids, String(invoiceId)]); setInvoiceId(""); setSelectedInvoice(null); setInvoiceSearch(""); }}>
                + Thêm đơn vào chuyến
              </button>
              {tripInvoiceIds.map((id) => <span key={id} className="pricing-trip-chip">
                Đơn #{id} <button type="button" onClick={() => setTripInvoiceIds((ids) => ids.filter((value) => value !== id))}>×</button>
              </span>)}
            </div>
          )}
          {!formIsSalary && (invoiceId || tripInvoiceIds.length > 0) && <label>
            Phân bổ chi phí đơn/chuyến theo
            <select value={allocationBasis} onChange={(event) => setAllocationBasis(event.target.value)}>
              <option value="revenue">Doanh thu từng sản phẩm</option>
              <option value="weight">Trọng lượng từng sản phẩm</option>
              <option value="volume">Thể tích từng sản phẩm</option>
            </select>
          </label>}
          {!editingExpense && (
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
          )}
          {!formIsSalary && (
            <label className="pricing-abnormal-checkbox">
              <input
                type="checkbox"
                checked={isAbnormal}
                onChange={(event) => setIsAbnormal(event.target.checked)}
              />
              Khoản bất thường: vẫn ghi chi phí thực tế nhưng không phân bổ vào
              giá đề xuất
            </label>
          )}
          <label className="pricing-description">
            Nội dung chi phí
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={500}
              rows={3}
              placeholder={
                formIsSalary
                  ? "Ví dụ: Tổng lương nhân viên tháng này"
                  : "Ví dụ: Xăng chuyến giao đơn 23"
              }
              required
            />
          </label>
          {editingExpense && (
            <p className="pricing-form-note">
              {editingExpense.payment_method
                ? "Khoản đã ghi quỹ. Nếu sửa số tiền, quỹ sẽ tự điều chỉnh phần chênh lệch."
                : "Khoản chưa ghi quỹ. Dùng nút Ghi đã chi trong danh sách khi thanh toán."}
            </p>
          )}
          {paidAmountChanged && (
            <label className="pricing-description">
              Lý do sửa số tiền đã chi
              <textarea
                value={editReason}
                onChange={(event) => setEditReason(event.target.value)}
                maxLength={500}
                rows={2}
                required
              />
            </label>
          )}
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
        className="pricing-void-confirm"
        title="Hủy khoản chi?"
        message={
          voidRow
            ? `${voidRow.category_label}: ${formatCurrency(voidRow.amount)}. Khoản đã chi sẽ được hoàn vào quỹ.`
            : ""
        }
        confirmLabel="Hủy khoản chi"
        cancelLabel="Quay lại"
        onConfirm={voidExpense}
        onCancel={() => setVoidRow(null)}
        loading={busy}
        confirmDisabled={!voidReason.trim()}
        danger
      >
        <div className="pricing-void-dialog">
          <label>
            Lý do hủy
            <textarea
              rows={4}
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
        className="pricing-void-confirm pricing-pay-confirm"
        title="Ghi đã chi tiền?"
        message={
          payRow
            ? `${payRow.category_label}: ${formatCurrency(payRow.amount)}. Số dư quỹ đã chọn sẽ giảm ngay.`
            : ""
        }
        confirmLabel="Ghi đã chi"
        confirmDisabled={!payMethod}
        onConfirm={payExpense}
        onCancel={() => setPayRow(null)}
        loading={busy}
      >
        <div className="pricing-void-dialog">
          <label>
            Chi từ quỹ
            <select
              value={payMethod}
              onChange={(event) => setPayMethod(event.target.value)}
              disabled={busy}
            >
              {PAID_FROM_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </ConfirmDialog>
    </div>
  );
}
