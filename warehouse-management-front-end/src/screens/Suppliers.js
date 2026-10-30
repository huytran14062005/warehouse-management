import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { authApis, endpoints } from "../configs/Apis";
import { getApiError } from "../utils/apiError";
import useNotificationState from "../utils/useNotificationState";
import AutoDismissMessage from "../components/AutoDismissMessage";
import Pagination from "../components/Pagination";
import Skeleton from "../components/Skeleton";
import "../css/Suppliers.css";

function Suppliers() {
  const PER_PAGE = 10;
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, total_pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useNotificationState();
  const [showCreate, setShowCreate] = useState(false);
  const [newSupplier, setNewSupplier] = useState({ name: "", address: "" });
  const [createError, setCreateError] = useNotificationState();
  const [saving, setSaving] = useState(false);
  const searchTimerRef = useRef(null);
  const currentUser = (() => {
    try {
      return JSON.parse(localStorage.getItem("user")) || {};
    } catch {
      return {};
    }
  })();
  const canCreateSupplier = currentUser.role === "quản lý";

  const fetchSuppliers = useCallback(async (filters = {}) => {
    if (!localStorage.getItem("token")) {
      navigate("/login", {
        replace: true,
        state: { message: "Vui lòng đăng nhập để xem danh sách nhà cung cấp." },
      });
      return;
    }

    try {
      setLoading(true);
      setError("");
      const response = await authApis().get(endpoints.suppliers, {
        params: {
          page: filters.page ?? page,
          per_page: PER_PAGE,
          keyword: (filters.keyword ?? keyword) || undefined,
        },
      });
      setSuppliers(response.data?.suppliers || []);
      setPagination(response.data?.pagination || { total: 0, total_pages: 1 });
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setLoading(false);
    }
  }, [keyword, navigate, page, setError]);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  useEffect(
    () => () => {
      if (searchTimerRef.current) window.clearTimeout(searchTimerRef.current);
    },
    [],
  );

  const handleSearchChange = (event) => {
    const value = event.target.value;
    setKeywordInput(value);
    if (searchTimerRef.current) window.clearTimeout(searchTimerRef.current);
    searchTimerRef.current = window.setTimeout(() => {
      setPage(1);
      setKeyword(value.trim());
    }, 400);
  };

  const handleSearch = (event) => {
    event.preventDefault();
    if (searchTimerRef.current) window.clearTimeout(searchTimerRef.current);
    setPage(1);
    setKeyword(keywordInput.trim());
  };

  const closeCreate = () => {
    if (saving) return;
    setShowCreate(false);
    setNewSupplier({ name: "", address: "" });
    setCreateError("");
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    const name = newSupplier.name.trim();
    const address = newSupplier.address.trim();
    if (!name || !address) {
      setCreateError("Vui lòng nhập tên và địa chỉ nhà cung cấp.");
      return;
    }
    try {
      setSaving(true);
      setCreateError("");
      await authApis().post(endpoints.suppliers, { name, address });
      setShowCreate(false);
      setNewSupplier({ name: "", address: "" });
      setKeywordInput("");
      setKeyword("");
      setPage(1);
      await fetchSuppliers({ page: 1, keyword: "" });
    } catch (requestError) {
      setCreateError(getApiError(requestError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="suppliers-page">
      <div className="suppliers-header">
        <div>
          <h1>Danh sách nhà cung cấp</h1>
        </div>
        <div className="suppliers-header-actions">
          <span className="suppliers-count">{pagination.total} nhà cung cấp</span>
          {canCreateSupplier && (
            <button type="button" className="suppliers-add-button" onClick={() => setShowCreate(true)}>
              + Thêm nhà cung cấp
            </button>
          )}
        </div>
      </div>

      <form className="suppliers-toolbar" onSubmit={handleSearch}>
        <input
          type="search"
          value={keywordInput}
          onChange={handleSearchChange}
          placeholder="Tìm theo tên nhà cung cấp"
          aria-label="Tìm kiếm nhà cung cấp"
        />
        <button type="submit">Tìm kiếm</button>
      </form>

      <AutoDismissMessage message={error} className="suppliers-alert" />

      <div className="suppliers-card">
        {loading ? (
          <Skeleton rows={6} columns={3} />
        ) : suppliers.length === 0 ? (
          <div className="suppliers-state">
            Không tìm thấy nhà cung cấp phù hợp.
          </div>
        ) : (
          <div className="suppliers-table-wrapper">
            <table className="suppliers-table">
              <thead>
                <tr>
                  <th>Mã</th>
                  <th>Tên nhà cung cấp</th>
                  <th>Địa chỉ</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((supplier) => (
                  <tr key={supplier.id}>
                    <td>{supplier.id}</td>
                    <td className="suppliers-name">{supplier.name}</td>
                    <td>{supplier.address || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <Pagination
        page={page}
        totalPages={Number(pagination.total_pages || 1)}
        onPageChange={setPage}
        disabled={loading}
      />
      {showCreate && createPortal(
        <div className="suppliers-modal-overlay" onClick={closeCreate}>
          <div className="suppliers-modal" role="dialog" aria-modal="true" aria-labelledby="suppliers-create-title" onClick={(event) => event.stopPropagation()}>
            <div className="suppliers-modal-header">
              <h2 id="suppliers-create-title">Thêm nhà cung cấp</h2>
              <button type="button" className="suppliers-modal-close" onClick={closeCreate} disabled={saving} aria-label="Đóng">×</button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="suppliers-modal-body">
                <AutoDismissMessage message={createError} className="suppliers-alert" />
                <label className="suppliers-modal-field">
                  <span>Tên nhà cung cấp</span>
                  <input
                    autoFocus
                    value={newSupplier.name}
                    onChange={(event) => setNewSupplier((current) => ({ ...current, name: event.target.value }))}
                    maxLength={255}
                    required
                  />
                </label>
                <label className="suppliers-modal-field">
                  <span>Địa chỉ</span>
                  <textarea
                    value={newSupplier.address}
                    onChange={(event) => setNewSupplier((current) => ({ ...current, address: event.target.value }))}
                    rows={3}
                    required
                  />
                </label>
              </div>
              <div className="suppliers-modal-actions">
                <button type="button" onClick={closeCreate} disabled={saving}>Hủy</button>
                <button type="submit" className="suppliers-add-button" disabled={saving}>
                  {saving ? "Đang lưu..." : "Lưu nhà cung cấp"}
                </button>
              </div>
            </form>
          </div>
        </div>, document.body,
      )}
    </div>
  );
}

export default Suppliers;
