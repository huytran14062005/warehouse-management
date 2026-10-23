import React, { useCallback, useEffect, useRef, useState } from "react";
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
  const searchTimerRef = useRef(null);

  const fetchSuppliers = useCallback(async () => {
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
        params: { page, per_page: PER_PAGE, keyword: keyword || undefined },
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

  return (
    <div className="suppliers-page">
      <div className="suppliers-header">
        <div>
          <h1>Danh sách nhà cung cấp</h1>
        </div>
        <span className="suppliers-count">{pagination.total} nhà cung cấp</span>
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
    </div>
  );
}

export default Suppliers;
