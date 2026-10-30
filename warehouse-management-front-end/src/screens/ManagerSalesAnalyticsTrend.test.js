import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Chart } from "chart.js";
import { authApis } from "../configs/Apis";
import ManagerSalesAnalytics from "./ManagerSalesAnalytics";

jest.mock("../configs/Apis", () => {
  const actual = jest.requireActual("../configs/Apis");
  return { ...actual, authApis: jest.fn() };
});

jest.mock("chart.js", () => {
  const actual = jest.requireActual("chart.js");
  const MockChart = jest.fn();
  MockChart.prototype.destroy = jest.fn();
  MockChart.register = jest.fn();
  return {
    ...actual,
    Chart: MockChart,
  };
});

test("biểu đồ và bảng dùng tháng hoặc ngày theo bộ lọc", async () => {
  localStorage.setItem("token", "test-token");
  const currentYear = new Date().getFullYear();
  const monthRow = {
    period: `${currentYear}-10`, month: `${currentYear}-10`, orders: 1,
    sold_quantity: 2, revenue: 100, paid: 80, cash_paid: 80, bank_paid: 0,
  };
  const dayRow = {
    period: "2026-10-29", day: "2026-10-29", orders: 1,
    sold_quantity: 2, revenue: 100, paid: 80, cash_paid: 80, bank_paid: 0,
  };
  const get = jest.fn((_, { params }) => {
    const isDaily = params.granularity === "day";
    const row = isDaily ? dayRow : monthRow;
    const debt = {
      customer_id: 1, customer_name: "Khách A", phone: "0900000000", area: "Hà Nội",
      period_paid: isDaily ? 0 : 20, period_debt: isDaily ? 50 : 100,
    };
    return Promise.resolve({ data: {
      trend_granularity: isDaily ? "day" : "month",
      monthly_trend: [row], monthly_table: [row], monthly_peak: row,
      monthly_pagination: { page: 1, total_pages: 1 },
      debts: [debt], debt_chart: [debt], debt_pagination: { page: 1, total_pages: 1 },
    } });
  });
  authApis.mockReturnValue({ get });

  try {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ManagerSalesAnalytics />
      </MemoryRouter>,
    );
    await screen.findByRole("heading", { name: "Doanh thu theo tháng" });
    expect(screen.getByRole("columnheader", { name: "Tháng" })).toBeInTheDocument();
    expect(Chart.mock.calls.some(([, config]) =>
      config?.data?.labels?.includes(`T10/${currentYear}`))).toBe(true);
    const debtSection = document.getElementById("manager-debt-chart");
    expect(within(debtSection).queryByRole("columnheader", { name: "Doanh số" })).not.toBeInTheDocument();
    expect(within(debtSection).getByRole("columnheader", { name: "Còn nợ trong kỳ" })).toBeInTheDocument();
    expect(within(debtSection).getByText("100 đ")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Mở danh sách" }));
    fireEvent.click(screen.getByRole("option", { name: "Không chọn năm" }));
    fireEvent.change(screen.getByLabelText("Từ ngày"), { target: { value: "2026-10-29" } });
    fireEvent.change(screen.getByLabelText("Đến ngày"), { target: { value: "2026-10-29" } });
    fireEvent.click(screen.getByRole("button", { name: "Xem thống kê" }));

    await screen.findByRole("heading", { name: "Doanh thu theo ngày" });
    expect(screen.getByRole("columnheader", { name: "Ngày" })).toBeInTheDocument();
    expect(screen.getAllByText("29/10/2026").length).toBeGreaterThan(0);
    expect(within(document.getElementById("manager-debt-chart")).getByText("50 đ")).toBeInTheDocument();
    await waitFor(() => expect(Chart.mock.calls.some(([, config]) =>
      config?.data?.labels?.includes("29/10/2026") &&
      config.data.datasets[0].barThickness === 22)).toBe(true));
    expect(Chart.mock.calls.some(([, config]) =>
      config?.data?.labels?.includes("Khách A") && config.data.datasets[0].data[0] === 50)).toBe(true);
  } finally {
    localStorage.removeItem("token");
  }
});
