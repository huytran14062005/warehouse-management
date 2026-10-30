import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { authApis, endpoints } from "../configs/Apis";
import DamageReports from "./DamageReports";

jest.mock("../configs/Apis", () => {
  const actual = jest.requireActual("../configs/Apis");
  return { ...actual, authApis: jest.fn() };
});

test("nhân viên đi tỉnh báo hư từ hàng đang giữ, không nhập lý do từng sản phẩm", async () => {
  localStorage.setItem("token", "test-token");
  localStorage.setItem("user", JSON.stringify({ role: "nhân viên bán hàng" }));
  const get = jest.fn((url) => {
    if (url === endpoints.employeeStock) {
      return Promise.resolve({ data: {
        products: [{ id: 7, name: "Bánh quy", unit: "Hộp", quantity: 5 }],
        pagination: { total_pages: 1 },
      } });
    }
    return Promise.resolve({ data: { reports: [], pagination: { total_pages: 1 } } });
  });
  const post = jest.fn().mockResolvedValue({ data: { report: { id: 1 } } });
  authApis.mockReturnValue({ get, post });

  try {
    render(<MemoryRouter><DamageReports /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: "+ Báo hàng hư" }));
    const dialog = screen.getByRole("dialog");
    expect(await within(dialog).findByText("Nguồn hàng: Hàng đi tỉnh bạn đang giữ")).toBeInTheDocument();
    expect(within(dialog).queryByText("Kho xuất hàng")).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "+ Thêm sản phẩm" }));
    expect(within(dialog).queryByText("Lý do hư hỏng")).not.toBeInTheDocument();

    fireEvent.focus(within(dialog).getByRole("searchbox", { name: "Chọn sản phẩm hư" }));
    fireEvent.click(within(dialog).getByRole("option", { name: "Bánh quy" }));
    fireEvent.change(within(dialog).getByRole("spinbutton", { name: "Số lượng hư" }), {
      target: { value: "2" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Gửi phiếu báo hư" }));

    await waitFor(() => expect(post).toHaveBeenCalledWith(endpoints.damageReports, {
      note: "",
      items: [{ product_id: 7, quantity: 2 }],
    }));
  } finally {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  }
});

test("giải thích khi nhân viên không còn hàng đi tỉnh để báo hư", async () => {
  localStorage.setItem("token", "test-token");
  localStorage.setItem("user", JSON.stringify({ role: "nhân viên bán hàng" }));
  authApis.mockReturnValue({
    get: jest.fn((url) => Promise.resolve({ data: url === endpoints.employeeStock
      ? { products: [], pagination: { total_pages: 0 } }
      : { reports: [], pagination: { total_pages: 1 } } })),
  });

  try {
    render(<MemoryRouter><DamageReports /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: "+ Báo hàng hư" }));
    const dialog = screen.getByRole("dialog");
    expect(await within(dialog).findByText(/Bạn không còn sản phẩm nào trong tồn kho nhân viên/)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "+ Thêm sản phẩm" })).toBeDisabled();
  } finally {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  }
});
