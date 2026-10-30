import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { authApis, endpoints } from "../configs/Apis";
import { SalesInvoiceEditor } from "./SalesInvoices";
import { getSalePriceBounds } from "../utils/salePrice";

jest.mock("../configs/Apis", () => {
  const actual = jest.requireActual("../configs/Apis");
  return { ...actual, authApis: jest.fn() };
});

test("giá bán chỉ được nhập trong khoảng ±10% và hiện giá mặc định của sản phẩm", async () => {
  const put = jest.fn();
  authApis.mockReturnValue({
    get: jest.fn().mockResolvedValue({ data: { warehouses: [{ id: 1, name: "Kho trung tâm" }], default_warehouse_id: 1 } }),
    put,
  });
  localStorage.setItem("user", JSON.stringify({ role: "quản lý" }));
  const invoice = {
    id: 1,
    warehouse_id: 1,
    sale_source: "kho trung tâm",
    customer: { id: 1, full_name: "Khách hàng", phone: "0900000000", address: "Địa chỉ" },
    items: [{ product_id: 7, product_name: "Dầu gội", unit: "Chai", default_sale_price: 120000, quantity: 1, unit_price: 120000 }],
  };

  try {
    render(<SalesInvoiceEditor invoice={invoice} onClose={() => {}} onSaved={() => {}} />);
    const dialog = screen.getByRole("dialog");
    await waitFor(() => expect(within(dialog).getByRole("searchbox", { name: "Chọn kho xuất hàng" })).toHaveValue("Kho trung tâm"));
    expect(within(dialog).getByText("Số lượng")).toBeInTheDocument();
    expect(within(dialog).getByText("Giá bán")).toBeInTheDocument();
    expect(within(dialog).getByText(/Giá bán mặc định:/)).toHaveTextContent("120.000");
    expect(within(dialog).getByText(/Cho phép:/)).toHaveTextContent("108.000");
    expect(within(dialog).getByText(/Cho phép:/)).toHaveTextContent("132.000");

    fireEvent.change(within(dialog).getByRole("textbox", { name: "Giá bán" }), { target: { value: "5.000.000" } });
    expect(within(dialog).getByText(/không được vượt quá 132.000 đồng/)).toBeInTheDocument();
    fireEvent.submit(dialog.querySelector("form"));
    expect(await screen.findByText(/Giá bán sản phẩm phải từ/)).toBeInTheDocument();
    expect(put).not.toHaveBeenCalled();
  } finally {
    localStorage.removeItem("user");
  }
});

test("giới hạn giá bán theo giá mặc định và mức tối thiểu 500 đ", () => {
  expect(getSalePriceBounds(15000)).toEqual({ min: 13500, max: 16500 });
  expect(getSalePriceBounds(500)).toEqual({ min: 500, max: 550 });
  expect(getSalePriceBounds(0)).toBeNull();
});

test("nhân viên bán hàng chỉ chọn hạn nợ, không thể ghi tiền khi lập đơn", async () => {
  authApis.mockReturnValue({
    get: jest.fn().mockResolvedValue({ data: { warehouses: [{ id: 1, name: "Kho trung tâm" }], default_warehouse_id: 1 } }),
  });
  localStorage.setItem("user", JSON.stringify({ role: "nhân viên bán hàng" }));
  const invoice = {
    id: 2,
    warehouse_id: 1,
    sale_source: "hàng nhân viên",
    customer: { id: 1, full_name: "Khách hàng", phone: "0900000000", address: "Địa chỉ" },
    items: [{ product_id: 7, product_name: "Dầu gội", unit: "Chai", default_sale_price: 120000, quantity: 1, unit_price: 120000 }],
  };

  try {
    render(<SalesInvoiceEditor invoice={invoice} onClose={() => {}} onSaved={() => {}} />);
    const dialog = screen.getByRole("dialog");
    await waitFor(() => expect(within(dialog).getByText("Hạn thanh toán (nếu cho nợ)")).toBeInTheDocument());
    const dueDate = within(dialog).getByLabelText("Hạn thanh toán (nếu cho nợ)");
    expect(dialog.querySelector(".sales-editor-financials .sales-editor-totals")).toBeInTheDocument();
    expect(within(dialog).queryByRole("textbox", { name: "Khách thanh toán" })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("searchbox", { name: "Chọn phương thức thanh toán" })).not.toBeInTheDocument();
    expect(dueDate).toBeEnabled();
    expect(dueDate).not.toBeRequired();
  } finally {
    localStorage.removeItem("user");
  }
});
