import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { authApis, endpoints } from "../configs/Apis";
import { getApiError } from "../utils/apiError";
import useNotificationState from "../utils/useNotificationState";
import AutoDismissMessage from "../components/AutoDismissMessage";
import Pagination from "../components/Pagination";
import Skeleton from "../components/Skeleton";
import ConfirmDialog from "../components/ConfirmDialog";
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
  const [modalMode, setModalMode] = useState(null);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [supplierForm, setSupplierForm] = useState({
    name: "",
    phone: "",
    address: "",
  });
  const [modalError, setModalError] = useNotificationState();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const searchTimerRef = useRef(null);
  const detailRequestRef = useRef(0);
  const currentUser = (() => {
    try {
      return JSON.parse(localStorage.getItem("user")) || {};
    } catch {
      return {};
    }
  })();
  const canManageSupplier = currentUser.role === "quản lý";

  const fetchSuppliers = useCallback(
    async (filters = {}) => {
      if (!localStorage.getItem("token")) {
        navigate("/login", {
          replace: true,
          state: {
            message: "Vui lòng đăng nhập để xem danh sách nhà cung cấp.",
          },
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
        setPagination(
          response.data?.pagination || { total: 0, total_pages: 1 },
        );
      } catch (requestError) {
        setError(getApiError(requestError));
      } finally {
        setLoading(false);
      }
    },
    [keyword, navigate, page, setError],
  );

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

  const closeModal = () => {
    if (saving || confirmDelete) return;
    detailRequestRef.current += 1;
    setModalMode(null);
    setSelectedSupplier(null);
    setModalError("");
  };

  const openCreate = () => {
    setSupplierForm({ name: "", phone: "", address: "" });
    setModalError("");
    setModalMode("create");
  };

  const openDetail = async (supplier) => {
    const requestId = ++detailRequestRef.current;
    setSelectedSupplier(supplier);
    setModalMode("view");
    setModalError("");
    setDetailLoading(true);
    try {
      const response = await authApis().get(
        endpoints.supplierDetail(supplier.id),
      );
      if (requestId === detailRequestRef.current) {
        setSelectedSupplier(response.data?.supplier || supplier);
      }
    } catch (requestError) {
      if (requestId === detailRequestRef.current)
        setModalError(getApiError(requestError));
    } finally {
      if (requestId === detailRequestRef.current) setDetailLoading(false);
    }
  };

  const openEdit = () => {
    if (!selectedSupplier || !canManageSupplier) return;
    setSupplierForm({
      name: selectedSupplier.name || "",
      phone: selectedSupplier.phone || "",
      address: selectedSupplier.address || "",
    });
    setModalError("");
    setModalMode("edit");
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (!canManageSupplier) return;
    const name = supplierForm.name.trim();
    const phone = supplierForm.phone.replace(/[\s-]/g, "");
    const address = supplierForm.address.trim();
    if (!name || !address || !phone) {
      setModalError(
        "Vui lòng nhập tên, số điện thoại và địa chỉ nhà cung cấp.",
      );
      return;
    }
    if (!/^0\d{9,10}$/.test(phone)) {
      setModalError("Số điện thoại phải bắt đầu bằng 0 và gồm 10–11 chữ số.");
      return;
    }
    try {
      setSaving(true);
      setModalError("");
      const response =
        modalMode === "create"
          ? await authApis().post(endpoints.suppliers, { name, phone, address })
          : await authApis().put(
              endpoints.supplierDetail(selectedSupplier.id),
              { name, phone, address },
            );
      if (modalMode === "create") {
        detailRequestRef.current += 1;
        setModalMode(null);
        setKeywordInput("");
        setKeyword("");
        setPage(1);
        await fetchSuppliers({ page: 1, keyword: "" });
      } else {
        setSelectedSupplier((current) => ({
          ...current,
          ...response.data?.supplier,
        }));
        setModalMode("view");
        await fetchSuppliers();
      }
    } catch (requestError) {
      setModalError(getApiError(requestError));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!canManageSupplier || !selectedSupplier) return;
    try {
      setSaving(true);
      setModalError("");
      await authApis().delete(endpoints.supplierDetail(selectedSupplier.id));
      setConfirmDelete(false);
      setModalMode(null);
      setSelectedSupplier(null);
      const nextPage = suppliers.length === 1 && page > 1 ? page - 1 : page;
      if (nextPage !== page) setPage(nextPage);
      await fetchSuppliers({ page: nextPage });
    } catch (requestError) {
      setConfirmDelete(false);
      setModalError(getApiError(requestError));
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
          <span className="suppliers-count">
            {pagination.total} nhà cung cấp
          </span>
          {canManageSupplier && (
            <button
              type="button"
              className="suppliers-add-button"
              onClick={openCreate}
            >
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
          <Skeleton rows={6} columns={4} />
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
                  <th>Số điện thoại</th>
                  <th>Địa chỉ</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((supplier) => (
                  <tr
                    key={supplier.id}
                    tabIndex="0"
                    onClick={() => openDetail(supplier)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openDetail(supplier);
                      }
                    }}
                    aria-label={`Xem chi tiết nhà cung cấp ${supplier.name}`}
                  >
                    <td>{supplier.id}</td>
                    <td className="suppliers-name">{supplier.name}</td>
                    <td className="suppliers-phone">{supplier.phone || "Chưa cập nhật"}</td>
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
      {modalMode &&
        createPortal(
          <div className="suppliers-modal-overlay" onClick={closeModal}>
            <div
              className="suppliers-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="suppliers-modal-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="suppliers-modal-header">
                <div>
                  <span className="suppliers-modal-eyebrow">NHÀ CUNG CẤP</span>
                  <h2 id="suppliers-modal-title">
                    {modalMode === "create"
                      ? "Thêm nhà cung cấp"
                      : modalMode === "edit"
                        ? "Sửa thông tin nhà cung cấp"
                        : selectedSupplier?.name}
                  </h2>
                </div>
                <button
                  type="button"
                  className="suppliers-modal-close"
                  onClick={closeModal}
                  disabled={saving}
                  aria-label="Đóng"
                >
                  ×
                </button>
              </div>
              {modalMode === "view" ? (
                <>
                  <div className="suppliers-modal-body">
                    <AutoDismissMessage
                      message={modalError}
                      className="suppliers-alert"
                    />
                    {detailLoading ? (
                      <Skeleton rows={3} columns={1} />
                    ) : (
                      <dl className="suppliers-detail-list">
                        <div>
                          <dt>Tên nhà cung cấp</dt>
                          <dd>{selectedSupplier?.name || "—"}</dd>
                        </div>
                        <div>
                          <dt>Số điện thoại</dt>
                          <dd>{selectedSupplier?.phone || "Chưa cập nhật"}</dd>
                        </div>
                        <div>
                          <dt>Địa chỉ</dt>
                          <dd>{selectedSupplier?.address || "—"}</dd>
                        </div>
                      </dl>
                    )}
                    {canManageSupplier &&
                      !detailLoading &&
                      selectedSupplier?.can_delete === false && (
                        <p className="suppliers-delete-note">
                          Nhà cung cấp đã có phiếu nhập hoặc thanh toán nên
                          không thể xóa.
                        </p>
                      )}
                  </div>
                  <div className="suppliers-modal-actions">
                    {canManageSupplier && (
                      <>
                        <button
                          type="button"
                          className="suppliers-delete-button"
                          onClick={() => setConfirmDelete(true)}
                          disabled={
                            detailLoading ||
                            selectedSupplier?.can_delete !== true
                          }
                        >
                          Xóa nhà cung cấp
                        </button>
                        <button
                          type="button"
                          className="suppliers-add-button"
                          onClick={openEdit}
                          disabled={detailLoading}
                        >
                          Sửa thông tin
                        </button>
                      </>
                    )}
                    {!canManageSupplier && (
                      <button type="button" onClick={closeModal}>
                        Đóng
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <form onSubmit={handleSave}>
                  <div className="suppliers-modal-body">
                    <AutoDismissMessage
                      message={modalError}
                      className="suppliers-alert"
                    />
                    <label className="suppliers-modal-field">
                      <span>Tên nhà cung cấp</span>
                      <input
                        autoFocus
                        value={supplierForm.name}
                        onChange={(event) =>
                          setSupplierForm((current) => ({
                            ...current,
                            name: event.target.value,
                          }))
                        }
                        maxLength={255}
                        required
                      />
                    </label>
                    <label className="suppliers-modal-field">
                      <span>Số điện thoại</span>
                      <input
                        type="tel"
                        inputMode="tel"
                        value={supplierForm.phone}
                        onChange={(event) =>
                          setSupplierForm((current) => ({
                            ...current,
                            phone: event.target.value,
                          }))
                        }
                        maxLength={20}
                        placeholder="Ví dụ: 0901234567"
                        required
                      />
                    </label>
                    <label className="suppliers-modal-field">
                      <span>Địa chỉ</span>
                      <textarea
                        value={supplierForm.address}
                        onChange={(event) =>
                          setSupplierForm((current) => ({
                            ...current,
                            address: event.target.value,
                          }))
                        }
                        rows={3}
                        required
                      />
                    </label>
                  </div>
                  <div className="suppliers-modal-actions">
                    <button
                      type="button"
                      onClick={
                        modalMode === "edit"
                          ? () => setModalMode("view")
                          : closeModal
                      }
                      disabled={saving}
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      className="suppliers-add-button"
                      disabled={saving}
                    >
                      {saving
                        ? "Đang lưu..."
                        : modalMode === "edit"
                          ? "Lưu thay đổi"
                          : "Lưu nhà cung cấp"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>,
          document.body,
        )}
      <ConfirmDialog
        open={confirmDelete}
        title="Xóa nhà cung cấp?"
        message={`Bạn có chắc muốn xóa ${selectedSupplier?.name || "nhà cung cấp này"}? Thao tác này không thể hoàn tác.`}
        confirmLabel="Xóa nhà cung cấp"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
        loading={saving}
        danger
      />
    </div>
  );
}

export default Suppliers;
