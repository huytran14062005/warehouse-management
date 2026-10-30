import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { authApis, endpoints } from "../configs/Apis";
import AutoDismissMessage from "../components/AutoDismissMessage";
import ConfirmDialog from "../components/ConfirmDialog";
import MoneyInput from "../components/MoneyInput";
import Pagination from "../components/Pagination";
import SharedSearchableDropdown from "../components/SearchableDropdown";
import { getApiError } from "../utils/apiError";
import "../css/CompanyFunds.css";

const METHOD_LABELS = { cash: "Tiền mặt", bank_transfer: "Ngân hàng" };
const ENTRY_TYPE_LABELS = {
  opening: "Số dư ban đầu",
  customer_receipt: "Thu tiền khách hàng",
  supplier_payment: "Trả tiền nhà cung cấp",
  balance_adjustment: "Điều chỉnh số dư",
};

function money(value) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency", currency: "VND", maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function dateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("vi-VN", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export default function CompanyFunds() {
  const [funds, setFunds] = useState([]);
  const [totalBalance, setTotalBalance] = useState(0);
  const [totalOpeningBalance, setTotalOpeningBalance] = useState(0);
  const [initialized, setInitialized] = useState(false);
  const [entries, setEntries] = useState([]);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const entryTriggerRef = useRef(null);
  const [method, setMethod] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total_pages: 1 });
  const [cash, setCash] = useState("");
  const [bank, setBank] = useState("");
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustMethod, setAdjustMethod] = useState("cash");
  const [adjustBalance, setAdjustBalance] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjustConfirmOpen, setAdjustConfirmOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const openingTotal = Number(cash || 0) + Number(bank || 0);
  const selectedFund = funds.find((fund) => fund.method === adjustMethod);
  const adjustedTotal = totalBalance - Number(selectedFund?.balance || 0) + Number(adjustBalance || 0);
  const user = (() => {
    try { return JSON.parse(localStorage.getItem("user")) || {}; } catch { return {}; }
  })();
  const isManager = user.role === "quản lý";
  const canView = isManager || user.role === "kế toán";

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const [fundResponse, entryResponse] = await Promise.all([
        authApis().get(endpoints.companyFunds, { timeout: 15000 }),
        authApis().get(endpoints.companyFundEntries, { params: { method: method || undefined, page }, timeout: 15000 }),
      ]);
      setInitialized(Boolean(fundResponse.data?.initialized));
      setFunds(fundResponse.data?.funds || []);
      setTotalBalance(Number(fundResponse.data?.total_balance || 0));
      setTotalOpeningBalance(Number(fundResponse.data?.total_opening_balance || 0));
      setEntries(entryResponse.data?.entries || []);
      setPagination(entryResponse.data?.pagination || { total_pages: 1 });
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setLoading(false);
    }
  }, [method, page]);

  useEffect(() => { if (canView) load(); }, [canView, load]);

  useEffect(() => {
    if (!selectedEntry) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event) => {
      if (event.key === "Escape") setSelectedEntry(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      entryTriggerRef.current?.focus();
    };
  }, [selectedEntry]);

  const openEntry = (entry, trigger) => {
    entryTriggerRef.current = trigger;
    setSelectedEntry(entry);
  };

  const validateOpening = (event) => {
    event.preventDefault();
    if (!cash || !bank) return setError("Vui lòng nhập cả số dư tiền mặt và số dư ngân hàng; nhập 0 nếu không có tiền.");
    setError("");
    setConfirmOpen(true);
  };

  const saveOpening = async () => {
    try {
      setSaving(true);
      setError("");
      await authApis().post(endpoints.companyFundsOpening, {
        cash_balance: Number(cash), bank_balance: Number(bank),
      }, { timeout: 20000 });
      setConfirmOpen(false);
      setSuccess("Đã bắt đầu theo dõi sổ quỹ. Các khoản thanh toán mới sẽ được ghi vào đây.");
      await load();
    } catch (requestError) {
      setConfirmOpen(false);
      setError(["ECONNABORTED", "ETIMEDOUT"].includes(requestError.code)
        ? "Máy chủ phản hồi quá lâu. Hãy tải lại trang kiểm tra số dư trước khi thử lại."
        : getApiError(requestError));
    } finally {
      setSaving(false);
    }
  };

  const startAdjustment = () => {
    setAdjustMethod("cash");
    setAdjustBalance("");
    setAdjustReason("");
    setError("");
    setAdjustOpen(true);
  };

  const changeAdjustmentMethod = (nextMethod) => {
    setAdjustMethod(nextMethod);
    setAdjustBalance("");
  };

  const confirmAdjustment = (event) => {
    event.preventDefault();
    if (!selectedFund || adjustBalance === "") return setError("Vui lòng chọn quỹ và nhập số dư mới.");
    if (Number(adjustBalance) === Number(selectedFund.balance)) return setError("Số dư mới phải khác số dư hiện tại.");
    if (!adjustReason.trim()) return setError("Vui lòng nhập lý do điều chỉnh số dư.");
    setError("");
    setAdjustConfirmOpen(true);
  };

  const saveAdjustment = async () => {
    try {
      setSaving(true);
      await authApis().post(endpoints.companyFundsAdjustment, {
        method: adjustMethod,
        new_balance: Number(adjustBalance),
        expected_balance: Number(selectedFund.balance),
        reason: adjustReason.trim(),
      }, { timeout: 20000 });
      setAdjustConfirmOpen(false);
      setAdjustOpen(false);
      setSuccess("Đã điều chỉnh số dư. Thay đổi và lý do đã được ghi vào lịch sử thu chi.");
      await load();
    } catch (requestError) {
      setAdjustConfirmOpen(false);
      const message = ["ECONNABORTED", "ETIMEDOUT"].includes(requestError.code)
        ? "Máy chủ phản hồi quá lâu. Hãy tải lại trang kiểm tra số dư trước khi thử lại."
        : getApiError(requestError);
      if (requestError.response?.status === 409) await load();
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  if (!canView) return <div className="warehouse-page">Bạn không có quyền xem sổ quỹ công ty.</div>;

  return (
    <div className="warehouse-page company-funds-page">
      <div className="warehouse-page-header company-funds-page-header"><div>
        <h1>Sổ quỹ công ty</h1>
        <p>Số dư tiền mặt, ngân hàng và các khoản thu chi đã ghi nhận.</p>
      </div>
      {isManager && initialized && <button type="button" className="company-funds-adjust-button" onClick={startAdjustment}>Điều chỉnh số dư</button>}
      </div>
      <AutoDismissMessage message={error} className="warehouse-error" />
      {success && <p className="company-funds-success" role="status">{success}</p>}
      {loading ? <div className="warehouse-state">Đang tải sổ quỹ...</div> : initialized ? (
        <>
          <div className="company-funds-balances">
            <div className="company-funds-balance company-funds-balance-total">
              <span>Tổng số dư công ty</span>
              <strong>{money(totalBalance)}</strong>
              <small>Tổng số dư ban đầu: {money(totalOpeningBalance)}</small>
            </div>
            {funds.map((fund) => <div className="company-funds-balance" key={fund.method}>
              <span>Số dư {METHOD_LABELS[fund.method]?.toLowerCase()}</span>
              <strong>{money(fund.balance)}</strong>
              <small>Số dư ban đầu: {money(fund.opening_balance)}</small>
            </div>)}
          </div>
          {isManager && adjustOpen && <div className="company-funds-modal-overlay">
            <form className="company-funds-adjust company-funds-modal" role="dialog" aria-modal="true" aria-labelledby="company-funds-adjust-title" onSubmit={confirmAdjustment}>
              <div className="company-funds-modal-header">
                <h2 id="company-funds-adjust-title">Điều chỉnh số dư quỹ</h2>
                <button type="button" className="company-funds-modal-close" aria-label="Đóng" onClick={() => setAdjustOpen(false)}>×</button>
              </div>
              <p>Nhập số dư thực tế sau khi đối chiếu. Hệ thống sẽ ghi phần chênh lệch vào lịch sử.</p>
              <div className="company-funds-adjust-fields">
                <label>Quỹ cần điều chỉnh
                  <SharedSearchableDropdown
                    value={adjustMethod}
                    onChange={changeAdjustmentMethod}
                    options={[{ value: "cash", label: "Tiền mặt" }, { value: "bank_transfer", label: "Ngân hàng" }]}
                    ariaLabel="Chọn quỹ cần điều chỉnh"
                  />
                </label>
                <label>Số dư mới
                  <MoneyInput value={adjustBalance} onChange={setAdjustBalance} label="Số dư mới" minAmount={0} allowZero placeholder="0" />
                </label>
              </div>
              <div className="company-funds-adjust-preview">
                <span>Số dư hiện tại: <strong>{money(selectedFund?.balance)}</strong></span>
                <span>Tổng số dư công ty sau điều chỉnh: <strong>{adjustBalance === "" ? "—" : money(adjustedTotal)}</strong></span>
              </div>
              <label className="company-funds-adjust-reason">Lý do điều chỉnh
                <textarea value={adjustReason} onChange={(event) => setAdjustReason(event.target.value)} maxLength={500} rows={5} placeholder="Ví dụ: Điều chỉnh sau khi kiểm kê tiền mặt" />
              </label>
              <div className="company-funds-adjust-actions">
                <button type="button" onClick={() => setAdjustOpen(false)}>Hủy</button>
                <button className="warehouse-primary-button" type="submit">Kiểm tra và lưu</button>
              </div>
            </form>
          </div>}
          <p className="company-funds-cutover">Bắt đầu theo dõi từ {dateTime(funds[0]?.opened_at)}. Các khoản thu chi trước thời điểm này đã nằm trong số dư ban đầu.</p>
          <p className="company-funds-cutover">Sổ quỹ chỉ ghi nhận giao dịch trong hệ thống; chuyển khoản ngân hàng cần thực hiện và đối chiếu ngoài ứng dụng.</p>
          <div className="company-funds-list-head">
            <h2>Lịch sử thu chi</h2>
            <div className="company-funds-method-filter">
              <span>Quỹ:</span>
              <SharedSearchableDropdown
                value={method}
                options={[
                  { value: "", label: "Tất cả" },
                  { value: "cash", label: "Tiền mặt" },
                  { value: "bank_transfer", label: "Ngân hàng" },
                ]}
                placeholder="Tất cả"
                onChange={(value) => { setMethod(value); setPage(1); }}
                ariaLabel="Lọc lịch sử thu chi theo quỹ"
              />
            </div>
          </div>
          <div className="warehouse-card warehouse-table-wrap">
            {entries.length ? <table className="warehouse-table company-funds-table">
              <thead><tr><th>Thời gian</th><th>Nội dung</th><th>Quỹ</th><th>Thu</th><th>Chi</th><th>Số dư sau giao dịch</th><th>Người ghi nhận</th></tr></thead>
              <tbody>{entries.map((entry) => <tr
                key={entry.id}
                className="company-funds-entry-row"
                tabIndex={0}
                aria-label={`Xem chi tiết giao dịch: ${entry.description}`}
                onClick={(event) => openEntry(entry, event.currentTarget)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openEntry(entry, event.currentTarget);
                  }
                }}
              >
                <td>{dateTime(entry.occurred_at)}</td>
                <td><strong>{entry.description}</strong></td>
                <td>{METHOD_LABELS[entry.method]}</td>
                <td>{entry.direction === "in" ? money(entry.amount) : "—"}</td>
                <td>{entry.direction === "out" ? money(entry.amount) : "—"}</td>
                <td>{money(entry.balance_after)}</td>
                <td>{entry.employee_name || "—"}</td>
              </tr>)}</tbody>
            </table> : <div className="warehouse-state">Chưa có giao dịch nào trong quỹ này.</div>}
          </div>
          <Pagination page={page} totalPages={Number(pagination.total_pages || 1)} onPageChange={setPage} disabled={loading} />
        </>
      ) : isManager ? (
        <form className="company-funds-setup warehouse-card" onSubmit={validateOpening}>
          <h2>Thiết lập số dư ban đầu</h2>
          <p>Nhập số tiền công ty đang có tại thời điểm bắt đầu theo dõi. Các khoản đã thu hoặc trả trước đó phải được tính trong số này.</p>
          <p className="company-funds-setup-hint">Nếu nhập sai sau khi lưu, quản lý có thể điều chỉnh số dư; hệ thống sẽ lưu lại lý do và người thực hiện.</p>
          <div className="company-funds-setup-fields">
            <label>Số dư tiền mặt
              <MoneyInput value={cash} onChange={setCash} label="Số dư tiền mặt" minAmount={0} allowZero placeholder="0" />
            </label>
            <label>Số dư ngân hàng
              <MoneyInput value={bank} onChange={setBank} label="Số dư ngân hàng" minAmount={0} allowZero placeholder="0" />
            </label>
          </div>
          <div className="company-funds-setup-total">
            <span>Tổng số dư ban đầu của công ty</span>
            <strong>{money(openingTotal)}</strong>
          </div>
          <button className="warehouse-primary-button" type="submit">Bắt đầu theo dõi</button>
        </form>
      ) : <div className="company-funds-notice warehouse-card">Quản lý cần thiết lập số dư ban đầu trước khi kế toán ghi nhận thanh toán.</div>}
      {selectedEntry && createPortal(
        <div className="company-funds-modal-overlay" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setSelectedEntry(null);
        }}>
          <div className="company-funds-modal company-funds-entry-modal" role="dialog" aria-modal="true" aria-labelledby="company-funds-entry-title">
            <div className="company-funds-modal-header">
              <h2 id="company-funds-entry-title">Chi tiết giao dịch</h2>
              <button type="button" className="company-funds-modal-close" aria-label="Đóng chi tiết giao dịch" onClick={() => setSelectedEntry(null)} autoFocus>×</button>
            </div>
            <div className="company-funds-entry-details">
              <div><span>Thời gian:</span><strong>{dateTime(selectedEntry.occurred_at)}</strong></div>
              <div><span>Nội dung:</span><strong>{selectedEntry.description}</strong></div>
              <div><span>Loại giao dịch:</span><strong>{ENTRY_TYPE_LABELS[selectedEntry.entry_type] || "—"}</strong></div>
              <div><span>Quỹ:</span><strong>{METHOD_LABELS[selectedEntry.method] || "—"}</strong></div>
              <div><span>{selectedEntry.direction === "in" ? "Số tiền thu:" : "Số tiền chi:"}</span><strong>{money(selectedEntry.amount)}</strong></div>
              <div><span>Số dư trước giao dịch:</span><strong>{money(Number(selectedEntry.balance_after || 0) + (selectedEntry.direction === "in" ? -1 : 1) * Number(selectedEntry.amount || 0))}</strong></div>
              <div><span>Số dư sau giao dịch:</span><strong>{money(selectedEntry.balance_after)}</strong></div>
              <div><span>Người ghi nhận:</span><strong>{selectedEntry.employee_name || "—"}</strong></div>
            </div>
            {(selectedEntry.entry_type === "balance_adjustment" || selectedEntry.note) && <div className="company-funds-entry-note">
              <h3>{selectedEntry.entry_type === "balance_adjustment" ? "Lý do điều chỉnh" : "Ghi chú"}</h3>
              <p>{selectedEntry.note || "—"}</p>
            </div>}
            <div className="company-funds-entry-actions">
              <button type="button" onClick={() => setSelectedEntry(null)}>Đóng</button>
            </div>
          </div>
        </div>, document.body
      )}
      <ConfirmDialog
        open={confirmOpen} title="Xác nhận số dư ban đầu"
        message={`Tiền mặt: ${money(cash)}. Ngân hàng: ${money(bank)}. Số dư ban đầu chỉ được đặt một lần; hãy kiểm tra với số tiền thực tế trước khi lưu.`}
        confirmLabel="Xác nhận và bắt đầu" onConfirm={saveOpening}
        onCancel={() => setConfirmOpen(false)} loading={saving}
      >
        <p className="company-funds-confirm-total">Tổng số dư công ty: <strong>{money(openingTotal)}</strong></p>
      </ConfirmDialog>
      <ConfirmDialog
        open={adjustConfirmOpen} title="Xác nhận điều chỉnh số dư"
        message={`${METHOD_LABELS[adjustMethod]}: ${money(selectedFund?.balance)} → ${money(adjustBalance)}. Tổng số dư công ty sau điều chỉnh: ${money(adjustedTotal)}. Thao tác này sẽ được ghi vào lịch sử thu chi.`}
        confirmLabel="Lưu điều chỉnh" onConfirm={saveAdjustment}
        onCancel={() => setAdjustConfirmOpen(false)} loading={saving}
      >
        <p className="company-funds-confirm-total">Lý do: {adjustReason}</p>
      </ConfirmDialog>
    </div>
  );
}
