import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { authApis } from "../configs/Apis";
import { PricingRow } from "./PricingManagement";

jest.mock("../configs/Apis", () => {
  const actual = jest.requireActual("../configs/Apis");
  return { ...actual, authApis: jest.fn() };
});

test("opens both cost breakdowns from the product row without interrupting inputs", async () => {
  const get = jest.fn().mockResolvedValue({
    data: {
      shared: [{ id: 1, occurred_on: "2026-11-10", category: "utilities", description: "Điện", per_unit: 905.65 }],
      direct: [{ id: 2, invoice_id: 3, category: "fuel", description: "Xăng", per_unit: 1928.02 }],
    },
  });
  authApis.mockReturnValue({ get });
  const row = {
    product_id: 1, name: "Bánh quy", unit: "hộp", estimated_unit_cost: 10000,
    shared_expense_per_unit: 905.65, direct_expense_per_unit: 1928.02,
    full_cost_per_unit: 12833.67, planned_quantity: "1000.000", planned_revenue: 5588000,
    reference_price: 5588, reference_confirmed: true, markup_percent: 20,
    rounding_step: 1000, current_price: 5588, suggested_price: 16000,
  };
  render(<table><tbody><PricingRow row={row} onSave={jest.fn()} onApply={jest.fn()} busy={false} costMode="actual" /></tbody></table>);

  const productRow = screen.getByText("Bánh quy").closest("tr");
  fireEvent.click(screen.getByRole("textbox", { name: "Sản lượng dự kiến Bánh quy" }));
  expect(get).not.toHaveBeenCalled();

  fireEvent.click(productRow.querySelector("td"));
  await waitFor(() => expect(get).toHaveBeenCalledTimes(1));
  expect(await screen.findByText("Chi phí chung")).toBeInTheDocument();
  expect(screen.getByText("Chi phí đơn/chuyến")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("textbox", { name: "Sản lượng dự kiến Bánh quy" }));
  expect(screen.getByText("Chi phí chung")).toBeInTheDocument();
  fireEvent.keyDown(productRow, { key: "Enter" });
  expect(screen.queryByText("Chi phí chung")).not.toBeInTheDocument();
});
