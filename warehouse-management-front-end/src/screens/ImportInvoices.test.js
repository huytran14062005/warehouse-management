import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { authApis, endpoints } from "../configs/Apis";
import ImportInvoices from "./ImportInvoices";

jest.mock("../configs/Apis", () => {
  const actual = jest.requireActual("../configs/Apis");
  return { ...actual, authApis: jest.fn() };
});

test.each([
  ["thủ kho", false],
  ["quản lý", true],
])("quyền thêm nhà cung cấp khi %s lập phiếu nhập", async (role, canAddSupplier) => {
  localStorage.setItem("token", "test-token");
  localStorage.setItem("user", JSON.stringify({ role }));
  authApis.mockReturnValue({
    get: jest.fn((url) => {
      if (url === endpoints.importInvoices)
        return Promise.resolve({ data: { invoices: [], pagination: { total_pages: 1 } } });
      if (url === endpoints.suppliers)
        return Promise.resolve({ data: { suppliers: [{ id: 1, name: "Nhà cung cấp cũ" }] } });
      if (url === endpoints.productsInventory)
        return Promise.resolve({ data: { products: [] } });
      return Promise.resolve({ data: {
        warehouses: [{ id: 1, name: "Kho trung tâm" }], default_warehouse_id: 1,
      } });
    }),
  });

  try {
    render(<MemoryRouter><ImportInvoices /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: "+ Tạo phiếu nhập" }));
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByRole("searchbox", { name: "Chọn nhà cung cấp" })).toBeInTheDocument();
    if (canAddSupplier) {
      expect(within(dialog).getByRole("button", { name: "Nhà cung cấp mới" })).toBeInTheDocument();
    } else {
      expect(within(dialog).queryByRole("button", { name: "Nhà cung cấp mới" })).not.toBeInTheDocument();
      expect(within(dialog).queryByRole("button", { name: "Nhà cung cấp đã lưu" })).not.toBeInTheDocument();
    }
  } finally {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  }
});

test("lịch sử thanh toán dài nằm sau ghi chú và xem được từng trang", async () => {
  localStorage.setItem("token", "test-token");
  localStorage.setItem("user", JSON.stringify({ role: "quản lý" }));
  const payments = Array.from({ length: 7 }, (_, index) => ({
    id: index + 1,
    amount: (index + 1) * 1000,
    payment_method: "cash",
    paid_at: `2026-10-${String(index + 1).padStart(2, "0")}T08:00:00`,
    note: `Ghi chú lần ${index + 1}`,
  }));
  authApis.mockReturnValue({
    get: jest.fn((url) => Promise.resolve({ data: url === endpoints.importInvoices
      ? { invoices: [{ id: 1, supplier: { name: "Nhà cung cấp mẫu" }, items_count: 1 }], pagination: { total_pages: 1 } }
      : {
        id: 1,
        warehouse: { name: "Kho trung tâm" },
        supplier: { name: "Nhà cung cấp mẫu" },
        employee: { full_name: "Nhân viên" },
        total_amount: 30000,
        paid_amount: 28000,
        remaining_amount: 2000,
        payment_status: "partial",
        items: [{ id: 1, product_name: "Bánh quy", unit: "Hộp", quantity: 1, unit_price: 30000, total: 30000 }],
        note: "Nhập hàng mẫu",
        payments,
      } })),
  });

  try {
    render(<MemoryRouter><ImportInvoices /></MemoryRouter>);
    fireEvent.click((await screen.findByText("Nhà cung cấp mẫu")).closest("tr"));
    const dialog = await screen.findByRole("dialog");
    const history = within(dialog).getByRole("region", { name: "Lịch sử thanh toán nhà cung cấp" });
    const invoiceNote = within(dialog).getByText("Nhập hàng mẫu");
    expect(invoiceNote.compareDocumentPosition(history) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(history).getByText("7 giao dịch")).toBeInTheDocument();
    expect(within(history).getByText("7.000(Tiền mặt)")).toBeInTheDocument();
    expect(within(history).getByText("Ghi chú lần 7")).toBeInTheDocument();
    expect(within(history).queryByText("Ghi chú lần 2")).not.toBeInTheDocument();

    fireEvent.click(within(history).getByRole("button", { name: "Sau" }));
    expect(within(history).getByText("Trang 2/2")).toBeInTheDocument();
    expect(within(history).getByText("Ghi chú lần 2")).toBeInTheDocument();
    expect(within(history).getByText("Ghi chú lần 1")).toBeInTheDocument();
    expect(within(history).queryByText("Ghi chú lần 7")).not.toBeInTheDocument();
  } finally {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  }
});
