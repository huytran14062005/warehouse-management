import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { authApis, endpoints } from "../configs/Apis";
import Sidebar from "./Sidebar";

jest.mock("../configs/Apis", () => {
  const actual = jest.requireActual("../configs/Apis");
  return { ...actual, authApis: jest.fn() };
});

test("menu đơn bán hàng hiện ô số đỏ theo số đơn thủ kho cần xử lý", async () => {
  const get = jest.fn().mockResolvedValueOnce({ data: { total: 1 } })
    .mockResolvedValue({ data: { total: 2 } });
  authApis.mockReturnValue({ get });
  localStorage.setItem("token", "test-token");
  try {
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Sidebar user={{ id: 3, role: "thủ kho" }} /></MemoryRouter>);
    const firstBadge = await screen.findByLabelText("1 đơn bán hàng cần xử lý");
    expect(firstBadge).toHaveClass("sales-invoice-action-badge");
    expect(get).toHaveBeenCalledWith(endpoints.salesInvoiceActionCount);
    act(() => window.dispatchEvent(new Event("sales-invoices:action-count-refresh")));
    await waitFor(() => expect(screen.getByLabelText("2 đơn bán hàng cần xử lý")).toBeInTheDocument());
  } finally {
    localStorage.removeItem("token");
  }
});
