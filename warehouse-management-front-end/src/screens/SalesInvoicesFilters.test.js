import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { authApis, endpoints } from "../configs/Apis";
import SalesInvoices, { requiresSalesInvoiceAction } from "./SalesInvoices";

jest.mock("../configs/Apis", () => {
  const actual = jest.requireActual("../configs/Apis");
  return { ...actual, authApis: jest.fn() };
});

test("đơn nháp vừa tạo có chấm đỏ trên chính dòng đơn", async () => {
  const get = jest.fn().mockResolvedValue({ data: { invoices: [{
    id: 42, status: "nháp", employee: { id: 5 }, sold_at: "2026-10-30T13:54:00",
    sale_source: "kho trung tâm", warehouse: { name: "Kho trung tâm" },
    customer: { full_name: "Khách hàng", phone: "0123456789" },
    items_count: 1, final_amount: 8000,
  }], total: 1, pages: 1 } });
  authApis.mockReturnValue({ get });
  localStorage.setItem("token", "test-token");
  localStorage.setItem("user", JSON.stringify({ id: 5, role: "nhân viên bán hàng" }));
  try {
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><SalesInvoices /></MemoryRouter>);
    const dot = await screen.findByLabelText("Đơn hàng #42 cần xử lý");
    expect(dot.closest("td")).toHaveClass("sales-order-start-cell");
    expect(screen.queryByText(/Việc cần xử lý:/)).not.toBeInTheDocument();
  } finally {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  }
});

test("chấm đỏ chỉ hiện khi vai trò hiện tại có bước cần thao tác", () => {
  const invoice = { id: 42, status: "nháp", employee: { id: 5 } };
  expect(requiresSalesInvoiceAction(invoice, { id: 5, role: "nhân viên bán hàng" })).toBe(true);
  expect(requiresSalesInvoiceAction(invoice, { id: 6, role: "nhân viên bán hàng" })).toBe(false);
  expect(requiresSalesInvoiceAction(invoice, { role: "thủ kho" })).toBe(false);
  expect(requiresSalesInvoiceAction({ ...invoice, warehouse_submitted_at: "2026-10-30T14:00:00" }, { role: "thủ kho" })).toBe(true);
  expect(requiresSalesInvoiceAction({ ...invoice, status: "đang giao", delivered_at: "2026-10-30T15:00:00" }, { role: "kế toán" })).toBe(true);
  expect(requiresSalesInvoiceAction({ ...invoice, status: "đang giao", delivered_at: "2026-10-30T15:00:00", discount: { status: "chờ duyệt" } }, { role: "kế toán" })).toBe(false);
  expect(requiresSalesInvoiceAction({ ...invoice, status: "hoàn thành" }, { role: "kế toán" })).toBe(false);
});

test("bộ lọc hủy mặc định xem mọi đơn, còn hạn thanh toán chỉ lọc khi được chọn", async () => {
  const get = jest.fn().mockResolvedValue({ data: { invoices: [], total: 0, pages: 1 } });
  authApis.mockReturnValue({ get });
  localStorage.setItem("token", "test-token");
  localStorage.setItem("user", JSON.stringify({ role: "nhân viên bán hàng" }));

  try {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <SalesInvoices />
      </MemoryRouter>,
    );
    const cancelOnly = screen.getByRole("checkbox", { name: "Chỉ xem đơn chờ duyệt hủy" });
    expect(cancelOnly).not.toBeChecked();
    expect(screen.getByRole("searchbox", { name: "Lọc theo hạn thanh toán" })).toHaveValue("Không lọc hạn thanh toán");
    await waitFor(() => expect(get).toHaveBeenCalledWith(endpoints.salesInvoices, expect.objectContaining({
      params: expect.objectContaining({ cancel_requested: undefined, debt_status: undefined }),
    })));

    fireEvent.click(cancelOnly);
    await waitFor(() => expect(get).toHaveBeenCalledWith(endpoints.salesInvoices, expect.objectContaining({
      params: expect.objectContaining({ cancel_requested: "true" }),
    })));
    expect(screen.getByText("Chỉ hiển thị đơn đang xử lý hoặc đang giao có yêu cầu hủy chờ duyệt.")).toBeInTheDocument();

    fireEvent.focus(screen.getByRole("searchbox", { name: "Lọc theo hạn thanh toán" }));
    fireEvent.click(screen.getByRole("option", { name: "Quá hạn thanh toán" }));
    await waitFor(() => expect(get).toHaveBeenCalledWith(endpoints.salesInvoices, expect.objectContaining({
      params: expect.objectContaining({ cancel_requested: undefined, debt_status: "overdue" }),
    })));
    expect(cancelOnly).not.toBeChecked();
    expect(screen.getByText("Chỉ hiển thị đơn hoàn thành còn nợ có hạn thanh toán phù hợp.")).toBeInTheDocument();

    fireEvent.focus(screen.getByRole("searchbox", { name: "Lọc theo trạng thái đơn hàng" }));
    fireEvent.click(screen.getByRole("option", { name: "Nháp" }));
    await waitFor(() => expect(get).toHaveBeenCalledWith(endpoints.salesInvoices, expect.objectContaining({
      params: expect.objectContaining({ status: "nháp", debt_status: undefined }),
    })));
  } finally {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  }
});
