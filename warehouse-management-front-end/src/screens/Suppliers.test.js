import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { authApis, endpoints } from "../configs/Apis";
import Suppliers from "./Suppliers";

jest.mock("../configs/Apis", () => {
  const actual = jest.requireActual("../configs/Apis");
  return { ...actual, authApis: jest.fn() };
});

function renderForRole(role, api) {
  localStorage.setItem("token", "test-token");
  localStorage.setItem("user", JSON.stringify({ role }));
  authApis.mockReturnValue(api);
  return render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Suppliers /></MemoryRouter>);
}

afterEach(() => {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
});

test("quản lý thêm nhà cung cấp từ trang danh sách", async () => {
  let created = false;
  const get = jest.fn(() => Promise.resolve({ data: {
    suppliers: created ? [{ id: 2, name: "Nhà cung cấp mới", address: "Địa chỉ mới" }] : [],
    pagination: { total: created ? 1 : 0, total_pages: 1 },
  } }));
  const post = jest.fn(() => {
    created = true;
    return Promise.resolve({ data: { supplier: { id: 2, name: "Nhà cung cấp mới", address: "Địa chỉ mới" } } });
  });
  renderForRole("quản lý", { get, post });

  fireEvent.click(await screen.findByRole("button", { name: "+ Thêm nhà cung cấp" }));
  const dialog = screen.getByRole("dialog");
  fireEvent.change(within(dialog).getByLabelText("Tên nhà cung cấp"), { target: { value: " Nhà cung cấp mới " } });
  fireEvent.change(within(dialog).getByLabelText("Địa chỉ"), { target: { value: " Địa chỉ mới " } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Lưu nhà cung cấp" }));

  await waitFor(() => expect(post).toHaveBeenCalledWith(endpoints.suppliers, {
    name: "Nhà cung cấp mới", address: "Địa chỉ mới",
  }));
  expect(await screen.findByText("Nhà cung cấp mới")).toBeInTheDocument();
});

test.each(["thủ kho", "kế toán"])("%s chỉ xem danh sách nhà cung cấp", async (role) => {
  renderForRole(role, { get: jest.fn(() => Promise.resolve({ data: {
    suppliers: [], pagination: { total: 0, total_pages: 1 },
  } })) });
  expect(await screen.findByRole("heading", { name: "Danh sách nhà cung cấp" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "+ Thêm nhà cung cấp" })).not.toBeInTheDocument();
});
