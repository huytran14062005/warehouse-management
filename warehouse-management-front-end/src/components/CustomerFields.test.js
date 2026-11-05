import React, { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { authApis, endpoints } from "../configs/Apis";
import CustomerFields from "./CustomerFields";

jest.mock("../configs/Apis", () => ({
  authApis: jest.fn(),
  endpoints: { salesAreas: "/sales-areas" },
}));

function CustomerFieldsWithArea() {
  const [customer, setCustomer] = useState({ full_name: "", phone: "", address: "", sales_area_id: "" });
  const [areas, setAreas] = useState([]);
  return (
    <CustomerFields
      value={customer}
      onChange={(field, value) => setCustomer((current) => ({ ...current, [field]: value }))}
      salesAreas={areas}
      requireSalesArea
      onSalesAreaCreated={(area) => setAreas((current) => [...current, area])}
    />
  );
}

test("creates and selects a sales area without leaving the customer form", async () => {
  const post = jest.fn().mockResolvedValue({
    data: { sales_area: { id: 7, code: "custom_area", name: "North region" } },
  });
  authApis.mockReturnValue({ post });

  render(<CustomerFieldsWithArea />);
  fireEvent.click(screen.getByRole("button", { name: "+ Thêm khu vực" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Tên khu vực bán hàng mới" }), {
    target: { value: " North   region " },
  });
  fireEvent.click(screen.getByRole("button", { name: "Lưu khu vực" }));

  expect(await screen.findByRole("status")).toHaveTextContent("Đã thêm khu vực bán hàng North region.");
  expect(post).toHaveBeenCalledWith(endpoints.salesAreas, { name: "North region" });
  expect(screen.getByRole("searchbox", { name: "Chọn khu vực bán hàng" })).toHaveValue("North region");
});
