import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { authApis, endpoints } from "../configs/Apis";
import { getApiError } from "../utils/apiError";
import AutoDismissMessage from "../components/AutoDismissMessage";
import "../css/PendingRequests.css";

function PendingRequests({ pendingRequests }) {
  const counts = pendingRequests?.counts || {};
  const [productRequests, setProductRequests] = useState([]);
  const [productRequestError, setProductRequestError] = useState("");

  useEffect(() => {
    let cancelled = false;
    authApis()
      .get(endpoints.productRequests)
      .then((response) => {
        if (!cancelled) setProductRequests(response.data?.requests || []);
      })
      .catch((error) => {
        if (!cancelled) setProductRequestError(getApiError(error));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const requests = [
    {
      key: "accounts",
      title: "Tài khoản chờ duyệt",
      description: "Kiểm tra và duyệt tài khoản nhân viên mới đăng ký.",
      count: Number(counts.accounts || 0),
      path: "/employee-accounts?status=pending",
      action: "Mở quản lý tài khoản",
    },
    {
      key: "damage_reports",
      title: "Phiếu hàng hư chờ duyệt",
      description: "Kiểm tra số lượng hàng hư trước khi ghi nhận vào tồn kho.",
      count: Number(counts.damage_reports || 0),
      path: "/damage-reports?status=pending",
      action: "Mở phiếu hàng hư",
    },
    {
      key: "discount_invoices",
      title: "Đơn chờ duyệt giảm giá",
      description: "Xem và duyệt hoặc từ chối các yêu cầu giảm giá.",
      count: Number(counts.discount_invoices || 0),
      path: "/sales-invoices",
      action: "Mở đơn bán hàng",
    },
    {
      key: "cancel_requests",
      title: "Yêu cầu hủy đơn",
      description: "Kiểm tra các đơn bán hàng đang chờ xử lý yêu cầu hủy.",
      count: Number(counts.cancel_requests || 0),
      path: "/sales-invoices?cancel_requested=pending",
      action: "Mở đơn bán hàng",
    },
  ];

  return (
    <div className="pending-requests-page">
      <div className="pending-requests-header">
        <div>
          <h1>Yêu cầu cần duyệt</h1>
        </div>
        <strong>{Number(pendingRequests?.total || 0)} yêu cầu</strong>
      </div>
      <div className="pending-requests-grid">
        {requests.map((request) => (
          <section
            className={`pending-request-card${request.count ? " has-pending" : ""}`}
            key={request.key}
          >
            <div className="pending-request-card-top">
              <h2>{request.title}</h2>
              <span>{request.count}</span>
            </div>
            <p>{request.description}</p>
            <Link to={request.path}>
              {request.action} <span aria-hidden="true">→</span>
            </Link>
          </section>
        ))}
        <section
          className={`pending-request-card${Number(counts.product_requests || 0) ? " has-pending" : ""}`}
        >
          <div className="pending-request-card-top">
            <h2>Yêu cầu thêm sản phẩm</h2>
            <span>{Number(counts.product_requests || 0)}</span>
          </div>
          <p>Nhân viên bán hàng hoặc thủ kho gửi yêu cầu khi chưa có sản phẩm trong danh mục.</p>
          <AutoDismissMessage message={productRequestError} className="pending-request-error" />
          {productRequests.length ? (
            <div className="pending-product-request-list">
              {productRequests.map((request) => (
                <Link
                  key={request.id}
                  className="pending-product-request-link"
                  to={`/products?product_request_id=${request.id}`}
                >
                  <strong>{request.name}</strong>
                  <small>
                    {request.requested_by?.full_name || "Nhân viên"} · {request.requested_by?.role || ""}
                  </small>
                </Link>
              ))}
            </div>
          ) : (
            <span className="pending-request-empty">Chưa có yêu cầu đang chờ.</span>
          )}
        </section>
      </div>
    </div>
  );
}

export default PendingRequests;
