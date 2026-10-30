import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { authApis, endpoints } from "../configs/Apis";
import ProductComboManager from "../components/ProductComboManager";
import { SalesInvoiceEditor } from "./SalesInvoices";

jest.mock("../configs/Apis", () => {
  const actual = jest.requireActual("../configs/Apis");
  return { ...actual, authApis: jest.fn() };
});

const products = [
  { id: 1, name: "Rèm cửa", unit: "Bộ", default_sale_price: 200000, available_stock: 10 },
  { id: 2, name: "Móc rèm", unit: "Cái", default_sale_price: 5000, available_stock: 20 },
];
const combo = {
  id: 7, name: "Bộ rèm cửa", items: [
    { product_id: 1, product_name: "Rèm cửa", unit: "Bộ", default_sale_price: 200000, quantity: 1 },
    { product_id: 2, product_name: "Móc rèm", unit: "Cái", default_sale_price: 5000, quantity: 2 },
  ],
};

afterEach(() => localStorage.removeItem("user"));

test("quản lý tạo combo từ danh mục sản phẩm", async () => {
  let saved = [];
  const get = jest.fn((url) => {
    if (url === endpoints.productCombos) return Promise.resolve({ data: { combos: saved } });
    if (url === endpoints.productComboCatalog) return Promise.resolve({ data: { products } });
    throw new Error(`Unexpected URL: ${url}`);
  });
  const post = jest.fn((url, payload) => {
    saved = [{ ...combo, name: payload.name }];
    return Promise.resolve({ data: { combo: saved[0] } });
  });
  authApis.mockReturnValue({ get, post });
  render(<ProductComboManager onClose={() => {}} />);

  const dialog = screen.getByRole("dialog", { name: "Tạo combo sản phẩm" });
  await within(dialog).findByRole("searchbox", { name: "Sản phẩm combo 1" });
  fireEvent.change(within(dialog).getByRole("textbox", { name: "Tên combo" }), {
    target: { value: "Bộ rèm cửa" },
  });
  fireEvent.focus(within(dialog).getByRole("searchbox", { name: "Sản phẩm combo 1" }));
  fireEvent.click(within(dialog).getByRole("option", { name: "Rèm cửa · Bộ" }));
  fireEvent.focus(within(dialog).getByRole("searchbox", { name: "Sản phẩm combo 2" }));
  fireEvent.click(within(dialog).getByRole("option", { name: "Móc rèm · Cái" }));
  fireEvent.change(within(dialog).getAllByRole("spinbutton")[1], { target: { value: "2" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Tạo combo", exact: true }));

  await waitFor(() => expect(post).toHaveBeenCalledWith(endpoints.productCombos, {
    name: "Bộ rèm cửa",
    items: [{ product_id: 1, quantity: 1 }, { product_id: 2, quantity: 2 }],
  }));
  expect(await within(dialog).findByText(/Nhân viên có thể chọn bộ này/)).toBeInTheDocument();
});

test("người bán có thể giữ phụ kiện lẻ hoặc thêm đủ combo", async () => {
  localStorage.setItem("user", JSON.stringify({ role: "quản lý" }));
  const get = jest.fn((url) => {
    if (url === endpoints.warehouses) return Promise.resolve({ data: {
      warehouses: [{ id: 1, name: "Kho trung tâm" }], default_warehouse_id: 1,
    } });
    if (url === endpoints.productCombos) return Promise.resolve({ data: { combos: [combo] } });
    if (url === endpoints.productsInventory) return Promise.resolve({ data: { products } });
    if (url.startsWith("/products/")) {
      const product = products.find((item) => url === endpoints.productDetail(item.id));
      return Promise.resolve({ data: { product } });
    }
    throw new Error(`Unexpected URL: ${url}`);
  });
  authApis.mockReturnValue({ get });
  render(<SalesInvoiceEditor onClose={() => {}} onSaved={() => {}} />);
  const dialog = screen.getByRole("dialog");
  await waitFor(() => expect(get).toHaveBeenCalledWith(endpoints.productCombos));
  fireEvent.click(within(dialog).getByRole("button", { name: "+ Thêm sản phẩm" }));
  const search = within(dialog).getByRole("searchbox", { name: "Chọn sản phẩm" });
  fireEvent.change(search, { target: { value: "Móc" } });
  await within(dialog).findByRole("option", { name: "Móc rèm" }, { timeout: 2500 });
  fireEvent.click(within(dialog).getByRole("option", { name: "Móc rèm" }));

  const suggestion = await within(dialog).findByRole("region", { name: "Gợi ý combo" });
  expect(within(suggestion).getByText("Bộ rèm cửa")).toBeInTheDocument();
  fireEvent.click(within(suggestion).getByRole("button", { name: "Chỉ bán lẻ" }));
  expect(within(dialog).getAllByRole("searchbox", { name: "Chọn sản phẩm" })).toHaveLength(1);

  fireEvent.focus(within(dialog).getByRole("searchbox", { name: "Chọn sản phẩm" }));
  fireEvent.click(within(dialog).getByRole("option", { name: "Móc rèm" }));
  fireEvent.change(within(dialog).getByRole("spinbutton", { name: "Số bộ combo" }), { target: { value: "2" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Dùng combo" }));
  await waitFor(() => expect(within(dialog).getAllByRole("searchbox", { name: "Chọn sản phẩm" })).toHaveLength(2));
  expect(within(dialog).getAllByRole("spinbutton", { name: "Số lượng" }).map((input) => input.value)).toEqual(["4", "2"]);
  expect(within(dialog).getByText(/Đã thêm combo “Bộ rèm cửa” \(2 bộ\)/)).toBeInTheDocument();
});
