import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { authApis, endpoints } from "../configs/Apis";
import { SalesInvoiceEditor } from "./SalesInvoices";

jest.mock("../configs/Apis", () => {
  const actual = jest.requireActual("../configs/Apis");
  return { ...actual, authApis: jest.fn() };
});

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

test("shows sales area creation in the existing customer mode", async () => {
  authApis.mockReturnValue({
    get: jest.fn((url) => Promise.resolve({ data: url === endpoints.salesAreas
      ? { sales_areas: [] }
      : url === endpoints.warehouses
        ? { warehouses: [{ id: 1, name: "Central" }], default_warehouse_id: 1 }
        : { combos: [] },
    })),
  });

  render(<SalesInvoiceEditor onClose={jest.fn()} onSaved={jest.fn()} />);

  expect(screen.getByRole("button", { name: "Khách hàng đã lưu" })).toHaveClass("is-active");
  expect(screen.getByRole("searchbox", { name: "Chọn khu vực bán hàng" })).toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole("button", { name: "+ Thêm khu vực" })).toBeEnabled());
});

test("keeps unsaved order input after the form is reopened", async () => {
  localStorage.setItem("user", JSON.stringify({ id: 7, role: "quản lý" }));
  authApis.mockReturnValue({
    get: jest.fn((url) => Promise.resolve({ data: url === endpoints.salesAreas
      ? { sales_areas: [] }
      : url === endpoints.warehouses
        ? { warehouses: [{ id: 1, name: "Central" }], default_warehouse_id: 1 }
        : { combos: [] },
    })),
  });

  const first = render(<SalesInvoiceEditor onClose={jest.fn()} onSaved={jest.fn()} />);
  await waitFor(() => expect(screen.getByRole("button", { name: "+ Thêm khu vực" })).toBeEnabled());
  fireEvent.change(screen.getByPlaceholderText("Nhập ghi chú cho đơn hàng"), {
    target: { value: "Khách hẹn giao buổi chiều" },
  });
  first.unmount();
  render(<SalesInvoiceEditor onClose={jest.fn()} onSaved={jest.fn()} />);
  await waitFor(() => expect(screen.getByRole("button", { name: "+ Thêm khu vực" })).toBeEnabled());

  expect(screen.getByPlaceholderText("Nhập ghi chú cho đơn hàng"))
    .toHaveValue("Khách hẹn giao buổi chiều");
});

test("keeps note drafts separate between accounts", async () => {
  localStorage.setItem("user", JSON.stringify({ id: 7, role: "quản lý" }));
  authApis.mockReturnValue({
    get: jest.fn((url) => Promise.resolve({ data: url === endpoints.warehouses
      ? { warehouses: [{ id: 1, name: "Central" }], default_warehouse_id: 1 }
      : { sales_areas: [], combos: [] },
    })),
  });

  const first = render(<SalesInvoiceEditor onClose={jest.fn()} onSaved={jest.fn()} />);
  await waitFor(() => expect(screen.getByRole("button", { name: "+ Thêm khu vực" })).toBeEnabled());
  fireEvent.change(screen.getByPlaceholderText("Nhập ghi chú cho đơn hàng"), {
    target: { value: "Ghi chú của tài khoản 7" },
  });
  first.unmount();

  localStorage.setItem("user", JSON.stringify({ id: 8, role: "quản lý" }));
  const second = render(<SalesInvoiceEditor onClose={jest.fn()} onSaved={jest.fn()} />);
  await waitFor(() => expect(screen.getByRole("button", { name: "+ Thêm khu vực" })).toBeEnabled());
  expect(screen.getByPlaceholderText("Nhập ghi chú cho đơn hàng")).toHaveValue("");
  second.unmount();

  localStorage.setItem("user", JSON.stringify({ id: 7, role: "quản lý" }));
  render(<SalesInvoiceEditor onClose={jest.fn()} onSaved={jest.fn()} />);
  await waitFor(() => expect(screen.getByRole("button", { name: "+ Thêm khu vực" })).toBeEnabled());
  expect(screen.getByPlaceholderText("Nhập ghi chú cho đơn hàng"))
    .toHaveValue("Ghi chú của tài khoản 7");
});

test("clears an edited note draft after the order is saved", async () => {
  localStorage.setItem("user", JSON.stringify({ id: 7, role: "quản lý" }));
  const put = jest.fn().mockResolvedValue({ data: { invoice: { id: 23 } } });
  authApis.mockReturnValue({
    get: jest.fn((url) => Promise.resolve({ data: url === endpoints.warehouses
      ? { warehouses: [{ id: 1, name: "Central" }], default_warehouse_id: 1 }
      : { sales_areas: [], combos: [] },
    })),
    put,
  });
  const invoice = {
    id: 23,
    warehouse_id: 1,
    customer: { id: 9, full_name: "Khách thử" },
    note: "Ghi chú đã lưu",
    items: [{ product_id: 11, product_name: "Bánh quy", quantity: 1,
      unit_price: 10000, default_sale_price: 10000 }],
  };

  const first = render(<SalesInvoiceEditor invoice={invoice} onClose={jest.fn()} onSaved={jest.fn()} />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Lưu thay đổi" })).toBeEnabled());
  fireEvent.change(screen.getByPlaceholderText("Nhập ghi chú cho đơn hàng"), {
    target: { value: "Ghi chú mới" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
  await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(sessionStorage.getItem("sales-invoice-note:7:23")).toBeNull());
  first.unmount();

  await act(async () => {
    render(<SalesInvoiceEditor invoice={invoice} onClose={jest.fn()} onSaved={jest.fn()} />);
  });
  expect(screen.getByPlaceholderText("Nhập ghi chú cho đơn hàng"))
    .toHaveValue("Ghi chú đã lưu");
});

test("does not restore an edited note over a newer saved note", async () => {
  localStorage.setItem("user", JSON.stringify({ id: 7, role: "quản lý" }));
  sessionStorage.setItem("sales-invoice-note:7:23", JSON.stringify({
    baseNote: "Ghi chú cũ",
    note: "Bản sửa chưa lưu",
  }));
  authApis.mockReturnValue({
    get: jest.fn((url) => Promise.resolve({ data: url === endpoints.warehouses
      ? { warehouses: [{ id: 1, name: "Central" }], default_warehouse_id: 1 }
      : { sales_areas: [], combos: [] },
    })),
  });

  await act(async () => {
    render(<SalesInvoiceEditor invoice={{ id: 23, note: "Ghi chú mới trên máy chủ",
      customer: { id: 9, full_name: "Khách thử" }, warehouse_id: 1, items: [] }}
    onClose={jest.fn()} onSaved={jest.fn()} />);
  });
  expect(screen.getByPlaceholderText("Nhập ghi chú cho đơn hàng"))
    .toHaveValue("Ghi chú mới trên máy chủ");
});
