import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom";
import { authApis } from "../configs/Apis";
import Products from "./Products";
import DamageReports from "./DamageReports";
import CourierOrders from "./CourierOrders";
import Suppliers from "./Suppliers";
import ImportInvoices from "./ImportInvoices";

jest.mock("../configs/Apis", () => ({
  authApis: jest.fn(),
  endpoints: {
    productsInventory: "/products/inventory",
    productDetail: (id) => `/products/${id}`,
    damageReports: "/damage-reports",
    damageReportDetail: (id) => `/damage-reports/${id}`,
    myDeliveries: "/my-deliveries",
    myDeliveryDetail: (id) => `/my-deliveries/${id}`,
    suppliers: "/suppliers",
    supplierDetail: (id) => `/suppliers/${id}`,
    importInvoices: "/import-invoices",
    importInvoiceDetail: (id) => `/import-invoices/${id}`,
  },
}));

const product = {
  id: 1,
  name: "Bát trắng",
  unit: "Cái",
  default_sale_price: 4500,
  available_stock: 1200,
  total_imported: 1200,
  total_sold: 0,
  total_damaged: 0,
  total_transferred: 0,
};

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

beforeEach(() => {
  localStorage.setItem("token", "test-token");
  localStorage.setItem("user", JSON.stringify({ role: "quản lý" }));
});

afterEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
});

test("product detail opens from the list before its refresh finishes, then uses fresh data", async () => {
  const detailRequest = deferred();
  const get = jest.fn((url) => url === "/products/inventory"
    ? Promise.resolve({ data: { products: [product], pagination: { total_pages: 1 } } })
    : detailRequest.promise);
  authApis.mockReturnValue({ get });

  render(<MemoryRouter><Products /></MemoryRouter>);
  fireEvent.click(await screen.findByRole("button", { name: "Xem chi tiết Bát trắng" }));

  const dialog = screen.getByRole("dialog", { name: "Bát trắng" });
  expect(within(dialog).getByText("1.200 Cái")).toBeInTheDocument();
  expect(within(dialog).queryByRole("button", { name: "Chỉnh sửa sản phẩm" })).not.toBeInTheDocument();

  await act(async () => detailRequest.resolve({ data: { product: { ...product, name: "Bát trắng mới" } } }));
  expect(screen.getByRole("dialog", { name: "Bát trắng mới" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Chỉnh sửa sản phẩm" })).toBeInTheDocument();
});

test("closing a product detail ignores its late API response", async () => {
  const detailRequest = deferred();
  const get = jest.fn((url) => url === "/products/inventory"
    ? Promise.resolve({ data: { products: [product], pagination: { total_pages: 1 } } })
    : detailRequest.promise);
  authApis.mockReturnValue({ get });

  render(<MemoryRouter><Products /></MemoryRouter>);
  fireEvent.click(await screen.findByRole("button", { name: "Xem chi tiết Bát trắng" }));
  fireEvent.click(screen.getByRole("button", { name: "Đóng chi tiết sản phẩm" }));
  await act(async () => detailRequest.resolve({ data: { product } }));

  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("damage report detail opens immediately but review waits for the verified report", async () => {
  const detailRequest = deferred();
  const report = {
    id: 7,
    warehouse: { name: "Kho chính" },
    reported_by: { full_name: "Người báo" },
    status: "pending",
    reported_at: "2026-11-20T08:00:00",
    items: [{ id: 1, product_name: "Bát trắng", unit: "Cái", quantity: 2 }],
  };
  const get = jest.fn((url) => url === "/damage-reports"
    ? Promise.resolve({ data: { reports: [report], pagination: { total_pages: 1 } } })
    : detailRequest.promise);
  authApis.mockReturnValue({ get });

  render(<MemoryRouter><DamageReports /></MemoryRouter>);
  const row = await screen.findByText("Người báo", { selector: "td" });
  fireEvent.click(row.closest("tr"));

  const dialog = screen.getByRole("dialog");
  expect(within(dialog).getByRole("heading", { name: "Chi tiết phiếu hàng hư #7" })).toBeInTheDocument();
  expect(within(dialog).getByText("Bát trắng")).toBeInTheDocument();
  expect(within(dialog).queryByRole("button", { name: "Duyệt phiếu" })).not.toBeInTheDocument();

  await act(async () => detailRequest.resolve({ data: report }));
  await waitFor(() => expect(within(dialog).getByRole("button", { name: "Duyệt phiếu" })).toBeInTheDocument());
});

test("courier detail opens immediately but delivery actions wait for verification", async () => {
  localStorage.setItem("user", JSON.stringify({ role: "nhân viên giao hàng" }));
  const detailRequest = deferred();
  const order = {
    id: 3,
    status: "đang xử lý",
    customer: { full_name: "Khách A", phone: "0123456789", address: "Địa chỉ A" },
    warehouse: "Kho chính",
    items: [{ product_name: "Bát trắng", quantity: 2, unit: "Cái" }],
  };
  const get = jest.fn((url) => url === "/my-deliveries"
    ? Promise.resolve({ data: { invoices: [order], pagination: { total_pages: 1 } } })
    : detailRequest.promise);
  authApis.mockReturnValue({ get });

  render(<MemoryRouter><CourierOrders /></MemoryRouter>);
  fireEvent.click(await screen.findByRole("button", { name: /Đơn #3 · Khách A/ }));

  const dialog = screen.getByRole("dialog", { name: "Đơn giao hàng #3" });
  expect(within(dialog).getByText("Bát trắng")).toBeInTheDocument();
  expect(within(dialog).queryByRole("button", { name: "Bắt đầu giao hàng" })).not.toBeInTheDocument();

  await act(async () => detailRequest.resolve({ data: { invoice: order } }));
  expect(within(dialog).getByRole("button", { name: "Bắt đầu giao hàng" })).toBeInTheDocument();
});

test("supplier details are visible from the list while delete eligibility loads", async () => {
  const detailRequest = deferred();
  const supplier = { id: 5, name: "NCC A", phone: "0123456789", address: "Địa chỉ A" };
  const get = jest.fn((url) => url === "/suppliers"
    ? Promise.resolve({ data: { suppliers: [supplier], pagination: { total_pages: 1 } } })
    : detailRequest.promise);
  authApis.mockReturnValue({ get });

  render(<MemoryRouter><Suppliers /></MemoryRouter>);
  const row = await screen.findByText("NCC A", { selector: "td" });
  fireEvent.click(row.closest("tr"));

  const dialog = screen.getByRole("dialog", { name: "NCC A" });
  expect(within(dialog).getByText("Địa chỉ A")).toBeInTheDocument();
  expect(within(dialog).getByRole("button", { name: "Xóa nhà cung cấp" })).toBeDisabled();

  await act(async () => detailRequest.resolve({ data: { supplier: { ...supplier, can_delete: true } } }));
  expect(within(dialog).getByRole("button", { name: "Xóa nhà cung cấp" })).toBeEnabled();
});

test("import invoice opens a loading dialog immediately and only shows actions with full data", async () => {
  const detailRequest = deferred();
  const invoice = {
    id: 9,
    warehouse: { name: "Kho chính" },
    supplier: { name: "NCC A" },
    employee: { full_name: "Người lập" },
    imported_at: "2026-11-20T08:00:00",
    total_amount: 9000,
    paid_amount: 0,
    remaining_amount: 9000,
    payment_status: "unpaid",
    items: [{ id: 1, product_name: "Bát trắng", unit: "Cái", quantity: 2, unit_price: 4500, total: 9000 }],
    payments: [],
  };
  const get = jest.fn((url) => url === "/import-invoices"
    ? Promise.resolve({ data: { invoices: [invoice], pagination: { total_pages: 1 } } })
    : detailRequest.promise);
  authApis.mockReturnValue({ get });

  render(<MemoryRouter><ImportInvoices /></MemoryRouter>);
  const row = await screen.findByText("Phiếu #9");
  fireEvent.click(row.closest("tr"));

  const dialog = screen.getByRole("dialog", { name: "Chi tiết phiếu nhập #9" });
  expect(within(dialog).getByRole("status")).toBeInTheDocument();
  expect(within(dialog).queryByText("Sản phẩm nhập")).not.toBeInTheDocument();

  await act(async () => detailRequest.resolve({ data: invoice }));
  const fullDialog = screen.getByRole("dialog");
  expect(within(fullDialog).getByText("Bát trắng")).toBeInTheDocument();
});
