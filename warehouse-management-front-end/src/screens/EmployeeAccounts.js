import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { authApis, endpoints } from "../configs/Apis";
import { getApiError } from "../utils/apiError";
import useNotificationState from "../utils/useNotificationState";
import AutoDismissMessage from "../components/AutoDismissMessage";
import ConfirmDialog from "../components/ConfirmDialog";
import Pagination from "../components/Pagination";
import Skeleton from "../components/Skeleton";
import "../css/EmployeeAccounts.css";

const PER_PAGE = 10;
const roleLabels = {
  "kế toán": "Kế toán",
  "nhân viên bán hàng": "Nhân viên bán hàng",
  "thủ kho": "Thủ kho",
};

function EmployeeAccounts() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [employees, setEmployees] = useState([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState(() => searchParams.get("status") || "");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, total_pages: 1 });
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState(null);
  const [confirmState, setConfirmState] = useState(null);
  const [error, setError] = useNotificationState();
  const [success, setSuccess] = useNotificationState();

  const fetchEmployees = useCallback(async () => {
    if (!localStorage.getItem("token")) {
      navigate("/login", { replace: true });
      return;
    }
    try {
      setLoading(true);
      setError("");
      const response = await authApis().get(endpoints.employeeAccounts, {
        params: {
          page,
          per_page: PER_PAGE,
          keyword: keyword || undefined,
          status: status || undefined,
        },
      });
      setEmployees(response.data?.employees || []);
      setPagination(response.data?.pagination || { total: 0, total_pages: 1 });
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setLoading(false);
    }
  }, [keyword, navigate, page, setError, status]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const search = (event) => {
    event?.preventDefault();
    setPage(1);
    setKeyword(keywordInput.trim());
  };

  const changeStatus = (event) => {
    setStatus(event.target.value);
    setPage(1);
  };

  const requestAccountUpdate = (employee) => {
    const approving = !employee.is_approved;
    const nextLocked = !employee.is_locked;
    setConfirmState({
      employee,
      approving,
      nextLocked,
      title: approving
        ? "Xác nhận duyệt tài khoản"
        : `Xác nhận ${nextLocked ? "khóa" : "mở khóa"} tài khoản`,
      confirmLabel: approving
        ? "Duyệt tài khoản"
        : nextLocked
          ? "Khóa tài khoản"
          : "Mở khóa tài khoản",
      message: approving
        ? `Bạn có chắc muốn duyệt tài khoản ${employee.username}? Email thông báo sẽ được gửi.`
        : `Bạn có chắc muốn ${nextLocked ? "khóa" : "mở khóa"} tài khoản ${employee.username}? Email thông báo sẽ được gửi.`,
    });
  };

  const updateAccount = async () => {
    if (!confirmState) return;
    const { employee, approving, nextLocked } = confirmState;

    setActionId(employee.id);
    setError("");
    setSuccess("");
    try {
      const response = approving
        ? await authApis().put(endpoints.approveEmployeeAccount(employee.id))
        : await authApis().put(endpoints.lockEmployeeAccount(employee.id), {
            is_locked: nextLocked,
          });
      setSuccess(response.data?.message || "Đã cập nhật tài khoản.");
      await fetchEmployees();
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setActionId(null);
      setConfirmState(null);
    }
  };

  const statusLabel = (employee) => {
    if (!employee.is_approved) return ["Chờ duyệt", "pending"];
    if (employee.is_locked) return ["Đã duyệt · Đang khóa", "locked"];
    return ["Đã duyệt", "active"];
  };

  return (
    <div className="employee-accounts-page">
      <div className="employee-accounts-header">
        <div>
          <h1>Quản lý tài khoản</h1>
        </div>
        <span>{pagination.total || 0} tài khoản</span>
      </div>

      <form className="employee-accounts-toolbar" onSubmit={search}>
        <input
          type="search"
          value={keywordInput}
          onChange={(event) => setKeywordInput(event.target.value)}
          placeholder="Tìm theo họ tên, username, email hoặc số điện thoại"
          aria-label="Tìm tài khoản nhân viên"
        />
        <select
          value={status}
          onChange={changeStatus}
          aria-label="Lọc trạng thái tài khoản"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="pending">Chờ duyệt</option>
          <option value="active">Đã duyệt</option>
          <option value="locked">Đang khóa</option>
        </select>
        <button type="submit">Tìm kiếm</button>
      </form>

      <AutoDismissMessage message={error} className="employee-accounts-alert" />
      <AutoDismissMessage
        message={success}
        type="success"
        className="employee-accounts-success"
      />

      <section className="employee-accounts-card">
        {loading ? (
          <Skeleton rows={6} columns={5} />
        ) : employees.length === 0 ? (
          <div className="employee-accounts-state">
            Không có tài khoản phù hợp.
          </div>
        ) : (
          <div className="employee-accounts-table-wrap">
            <table className="employee-accounts-table">
              <thead>
                <tr>
                  <th>Nhân viên</th>
                  <th>Liên hệ</th>
                  <th>Vai trò</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((employee) => {
                  const [label, statusClass] = statusLabel(employee);
                  const actionLabel = !employee.is_approved
                    ? "Duyệt"
                    : employee.is_locked
                      ? "Mở khóa"
                      : "Khóa";
                  return (
                    <tr key={employee.id}>
                      <td>
                        <strong>{employee.full_name}</strong>
                        <small>@{employee.username}</small>
                      </td>
                      <td>
                        {employee.email}
                        <small>{employee.phone}</small>
                      </td>
                      <td>{roleLabels[employee.role] || employee.role}</td>
                      <td>
                        <span
                          className={`employee-account-status ${statusClass}`}
                        >
                          {label}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className={`employee-account-action ${employee.is_locked ? "unlock" : ""}`}
                          disabled={actionId === employee.id}
                          onClick={() => requestAccountUpdate(employee)}
                        >
                          {actionId === employee.id
                            ? "Đang xử lý..."
                            : actionLabel}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <Pagination
        page={page}
        totalPages={Number(pagination.total_pages || 1)}
        onPageChange={setPage}
        disabled={loading}
      />
      <ConfirmDialog
        open={Boolean(confirmState)}
        title={confirmState?.title}
        message={confirmState?.message}
        confirmLabel={confirmState?.confirmLabel}
        onConfirm={updateAccount}
        onCancel={() => !actionId && setConfirmState(null)}
        loading={Boolean(actionId)}
        danger={Boolean(
          confirmState && !confirmState.approving && confirmState.nextLocked,
        )}
      />
    </div>
  );
}

export default EmployeeAccounts;
