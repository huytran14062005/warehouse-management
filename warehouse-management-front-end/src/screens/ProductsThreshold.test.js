import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { authApis, endpoints } from "../configs/Apis";
import Products from "./Products";

jest.mock("../configs/Apis", () => {
  const actual = jest.requireActual("../configs/Apis");
  return { ...actual, authApis: jest.fn() };
});

afterEach(() => {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
});

test("quản lý đổi ngưỡng và nhãn tồn kho cập nhật theo tỷ lệ đã lưu", async () => {
  localStorage.setItem("token", "test-token");
  localStorage.setItem("user", JSON.stringify({ role: "quản lý" }));
  let percentage = 25;
  const get = jest.fn((url) => {
    if (url !== endpoints.productsInventory) throw new Error(`Unexpected URL: ${url}`);
    return Promise.resolve({ data: {
      products: [{
        id: 1, name: "Bánh quy", unit: "Hộp", default_sale_price: 15000,
        total_imported: 100, total_sold: 80, total_damaged: 0,
        total_transferred: 0, available_stock: 20,
      }],
      low_stock_percentage: percentage,
      pagination: { total: 1, total_pages: 1 },
    } });
  });
  const put = jest.fn((url, payload) => {
    percentage = payload.low_stock_percentage;
    return Promise.resolve({ data: { low_stock_percentage: percentage } });
  });
  authApis.mockReturnValue({ get, put });
  render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Products /></MemoryRouter>);

  const row = await screen.findByRole("button", { name: "Xem chi tiết Bánh quy" });
  expect(within(row).getByText("Sắp hết hàng")).toBeInTheDocument();
  const configure = screen.getByRole("button", { name: "Điều chỉnh ngưỡng sắp hết hàng" });
  await waitFor(() => expect(configure).toBeEnabled());
  fireEvent.click(configure);
  const dialog = screen.getByRole("dialog", { name: "Ngưỡng sắp hết hàng" });
  expect(within(dialog).queryByText(/Sản phẩm được đánh dấu sắp hết/)).not.toBeInTheDocument();
  fireEvent.change(within(dialog).getByRole("spinbutton", { name: "Tỷ lệ sắp hết hàng" }), {
    target: { value: "15" },
  });
  fireEvent.click(within(dialog).getByRole("button", { name: "Lưu ngưỡng" }));

  await waitFor(() => expect(put).toHaveBeenCalledWith(endpoints.inventoryThreshold, {
    low_stock_percentage: 15,
  }));
  expect(await within(row).findByText("Còn hàng")).toBeInTheDocument();
  expect(screen.getByText(/15% tổng số đã nhập/)).toBeInTheDocument();
});
