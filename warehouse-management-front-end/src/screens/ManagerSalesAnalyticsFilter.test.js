import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { authApis, endpoints } from "../configs/Apis";
import ManagerSalesAnalytics, {
  getReportYearOptions,
} from "./ManagerSalesAnalytics";

jest.mock("../configs/Apis", () => {
  const actual = jest.requireActual("../configs/Apis");
  return { ...actual, authApis: jest.fn() };
});

test("danh sách năm bắt đầu từ 2026 và tự thêm năm mới", () => {
  expect(getReportYearOptions(2026).map((option) => option.label)).toEqual([
    "Không chọn năm",
    "2026",
  ]);
  expect(getReportYearOptions(2027).map((option) => option.label)).toEqual([
    "Không chọn năm",
    "2027",
    "2026",
  ]);
});

test("bộ lọc năm và ngày áp dụng cho báo cáo cùng các trang dữ liệu", async () => {
  localStorage.setItem("token", "test-token");
  const inventoryRow = {
    product_id: 1,
    product_name: "Sản phẩm A",
    unit: "cái",
    quantity: 5,
  };
  const get = jest.fn((_, { params }) =>
    Promise.resolve({
      data: params.table
        ? {
            inventory_table: [inventoryRow],
            inventory_pagination: { page: params.table_page, total_pages: 2 },
          }
        : {
            debt_summary: { period_sales_total: 100, period_paid_total: 150 },
            inventory_chart: [inventoryRow],
            inventory_table: [inventoryRow],
            inventory_pagination: { page: 1, total_pages: 2 },
          },
    }),
  );
  authApis.mockReturnValue({ get });

  try {
    render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <ManagerSalesAnalytics />
      </MemoryRouter>,
    );
    await screen.findByText("Sản phẩm A");

    const yearInput = screen.getByRole("searchbox", {
      name: "Thống kê theo năm",
    });
    const currentYear = new Date().getFullYear();
    fireEvent.click(screen.getByRole("button", { name: "Mở danh sách" }));
    const renderedOptions = screen.getAllByRole("option");
    const expectedOptions = getReportYearOptions(currentYear);
    expect(renderedOptions).toHaveLength(expectedOptions.length);
    expectedOptions.forEach((option, index) => {
      expect(renderedOptions[index]).toHaveTextContent(option.label);
    });

    const fromInput = screen.getByLabelText("Từ ngày");
    const toInput = screen.getByLabelText("Đến ngày");
    fireEvent.click(screen.getByRole("option", { name: String(currentYear) }));
    expect(yearInput).toHaveValue(String(currentYear));
    expect(fromInput).toBeDisabled();
    expect(toInput).toBeDisabled();
    expect(get).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Xem thống kê" }));
    await waitFor(() =>
      expect(get).toHaveBeenCalledWith(endpoints.managerSalesReport, {
        params: {
          from_date: `${currentYear}-01-01`,
          to_date: `${currentYear}-12-31`,
          granularity: "month",
          page: 1,
          per_page: 10,
        },
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "2" }));
    await waitFor(() =>
      expect(get).toHaveBeenCalledWith(endpoints.managerSalesReport, {
        params: {
          from_date: `${currentYear}-01-01`,
          to_date: `${currentYear}-12-31`,
          granularity: "month",
          table: "inventory",
          table_page: 2,
          table_per_page: 10,
        },
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Mở danh sách" }));
    fireEvent.click(
      screen.getByRole("option", { name: "Không chọn năm" }),
    );
    expect(fromInput).toBeEnabled();
    expect(toInput).toBeEnabled();
    fireEvent.change(fromInput, { target: { value: "2025-02-01" } });
    fireEvent.change(toInput, { target: { value: "2025-02-28" } });
    expect(get).toHaveBeenCalledTimes(3);
    fireEvent.click(screen.getByRole("button", { name: "Xem thống kê" }));
    await waitFor(() =>
      expect(get).toHaveBeenCalledWith(endpoints.managerSalesReport, {
        params: {
          from_date: "2025-02-01",
          to_date: "2025-02-28",
          granularity: "day",
          page: 1,
          per_page: 10,
        },
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Xem thống kê" }));
    await waitFor(() => expect(get).toHaveBeenCalledTimes(5));
  } finally {
    localStorage.removeItem("token");
  }
});
