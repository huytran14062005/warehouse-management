import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { authApis, endpoints } from "../configs/Apis";
import { SalesInvoiceEditor } from "./SalesInvoices";

jest.mock("../configs/Apis", () => {
  const actual = jest.requireActual("../configs/Apis");
  return { ...actual, authApis: jest.fn() };
});

test("shows sales area creation in the existing customer mode", async () => {
  authApis.mockReturnValue({
    get: jest.fn((url) => Promise.resolve({ data: url === endpoints.salesAreas
      ? { sales_areas: [] }
      : url === endpoints.warehouses
        ? { warehouses: [{ id: 1, name: "Central" }], default_warehouse_id: 1 }
        : { combos: [] },
    })),
  });

  render(<SalesInvoiceEditor onClose={jest.fn()} onSaved={jest.fn()} />);

  expect(screen.getByRole("button", { name: "Khách hàng đã lưu" })).toHaveClass("is-active");
  expect(screen.getByRole("searchbox", { name: "Chọn khu vực bán hàng" })).toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole("button", { name: "+ Thêm khu vực" })).toBeEnabled());
});
