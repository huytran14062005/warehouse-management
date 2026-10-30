import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { authApis, endpoints } from "../configs/Apis";
import CompanyFunds from "./CompanyFunds";

jest.mock("../configs/Apis", () => {
  const actual = jest.requireActual("../configs/Apis");
  return { ...actual, authApis: jest.fn() };
});

test("quản lý điều chỉnh số dư bằng một giao dịch có lý do", async () => {
  localStorage.setItem("user", JSON.stringify({ role: "quản lý" }));
  let cashBalance = 1000;
  const get = jest.fn((url) => {
    if (url === endpoints.companyFunds) return Promise.resolve({ data: {
      initialized: true, total_balance: cashBalance + 2000,
      total_opening_balance: 3000,
      funds: [
        { method: "cash", balance: cashBalance, opening_balance: 1000, opened_at: "2026-10-30T09:00:00" },
        { method: "bank_transfer", balance: 2000, opening_balance: 2000, opened_at: "2026-10-30T09:00:00" },
      ],
    } });
    return Promise.resolve({ data: { entries: [], pagination: { total_pages: 1 } } });
  });
  const post = jest.fn(() => {
    cashBalance = 900;
    return Promise.resolve({ data: {} });
  });
  authApis.mockReturnValue({ get, post });

  try {
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><CompanyFunds /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: "Điều chỉnh số dư" }));
    fireEvent.change(screen.getByLabelText("Số dư mới"), { target: { value: "900" } });
    fireEvent.change(screen.getByLabelText("Lý do điều chỉnh"), { target: { value: "Kiểm kê tiền mặt" } });
    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra và lưu" }));
    fireEvent.click(screen.getByRole("button", { name: "Lưu điều chỉnh" }));
    await waitFor(() => expect(post).toHaveBeenCalledWith(endpoints.companyFundsAdjustment, {
      method: "cash", new_balance: 900, expected_balance: 1000, reason: "Kiểm kê tiền mặt",
    }, { timeout: 20000 }));
    expect(await screen.findByText("Đã điều chỉnh số dư. Thay đổi và lý do đã được ghi vào lịch sử thu chi.")).toBeInTheDocument();
  } finally {
    localStorage.removeItem("user");
  }
});

test("hết thời gian chờ khi lập số dư thì dừng trạng thái đang xử lý", async () => {
  localStorage.setItem("user", JSON.stringify({ role: "quản lý" }));
  authApis.mockReturnValue({
    get: jest.fn((url) => Promise.resolve({ data: url === endpoints.companyFunds
      ? { initialized: false, funds: [], total_balance: 0 }
      : { entries: [], pagination: { total_pages: 1 } } })),
    post: jest.fn(() => Promise.reject(Object.assign(new Error("timeout"), { code: "ECONNABORTED" }))),
  });
  try {
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><CompanyFunds /></MemoryRouter>);
    fireEvent.change(await screen.findByLabelText("Số dư tiền mặt"), { target: { value: "49999" } });
    fireEvent.change(screen.getByLabelText("Số dư ngân hàng"), { target: { value: "50000" } });
    fireEvent.click(screen.getByRole("button", { name: "Bắt đầu theo dõi" }));
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận và bắt đầu" }));
    expect(await screen.findByText("Máy chủ phản hồi quá lâu. Hãy tải lại trang kiểm tra số dư trước khi thử lại.")).toBeInTheDocument();
    expect(screen.queryByText("Đang xử lý...")).not.toBeInTheDocument();
  } finally {
    localStorage.removeItem("user");
  }
});

test("lý do điều chỉnh chỉ hiển thị trong chi tiết giao dịch", async () => {
  localStorage.setItem("user", JSON.stringify({ role: "quản lý" }));
  const reason = "Nhập sai số dư khi bắt đầu theo dõi, đã đối chiếu lại với sao kê ngân hàng.";
  authApis.mockReturnValue({
    get: jest.fn((url) => Promise.resolve({ data: url === endpoints.companyFunds
      ? {
        initialized: true, total_balance: 100000, total_opening_balance: 60000,
        funds: [{ method: "bank_transfer", balance: 100000, opening_balance: 60000, opened_at: "2026-10-30T09:00:00" }],
      }
      : {
        entries: [{ id: 1, method: "bank_transfer", direction: "in", entry_type: "balance_adjustment", amount: 40000,
          balance_after: 100000, occurred_at: "2026-10-30T09:25:00", description: "Điều chỉnh số dư ngân hàng",
          note: reason, employee_name: "Trần Minh Quân" }],
        pagination: { total_pages: 1 },
      } })),
  });
  try {
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><CompanyFunds /></MemoryRouter>);
    const description = await screen.findByText("Điều chỉnh số dư ngân hàng");
    expect(screen.queryByText(reason)).not.toBeInTheDocument();
    fireEvent.click(description.closest("tr"));
    expect(screen.getByRole("dialog", { name: "Chi tiết giao dịch" })).toBeInTheDocument();
    expect(screen.getByText(reason)).toBeInTheDocument();
    expect(screen.getByText("Lý do điều chỉnh")).toBeInTheDocument();
    expect(screen.getByText("Số dư trước giao dịch:").parentElement).toHaveTextContent("60.000");
    fireEvent.click(screen.getByRole("button", { name: "Đóng chi tiết giao dịch" }));
    expect(screen.queryByText(reason)).not.toBeInTheDocument();
  } finally {
    localStorage.removeItem("user");
  }
});
