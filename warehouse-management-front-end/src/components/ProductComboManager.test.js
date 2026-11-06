import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { authApis, endpoints } from "../configs/Apis";
import ProductComboManager from "./ProductComboManager";

jest.mock("../configs/Apis", () => ({
  authApis: jest.fn(),
  endpoints: {
    productCombos: "/products/combos",
    productComboCatalog: "/products/combos/catalog",
    productComboDetail: (id) => `/products/combos/${id}`,
  },
}));

jest.mock("./SearchableDropdown", () => function MockSearchableDropdown({ ariaLabel, value, options, onChange }) {
  const React = require("react");
  return React.createElement("select", {
    "aria-label": ariaLabel,
    value,
    onChange: (event) => onChange(event.target.value),
  }, options.map((option) => React.createElement("option", {
    key: option.value,
    value: option.value,
  }, option.label)));
});

test("shows combo creation success above the mobile dialog", async () => {
  const products = [
    { id: 1, name: "Product 1", unit: "item", default_sale_price: 1000 },
    { id: 2, name: "Product 2", unit: "item", default_sale_price: 2000 },
  ];
  const api = {
    get: jest.fn((url) => Promise.resolve({
      data: url === endpoints.productCombos ? { combos: [] } : { products },
    })),
    post: jest.fn().mockResolvedValue({ data: { combo: {
      id: 1,
      name: "Sample combo",
      calculated_price: 3000,
      sale_price: 3000,
      items: products.map((product) => ({
        product_id: product.id,
        product_name: product.name,
        quantity: 1,
      })),
    } } }),
  };
  authApis.mockReturnValue(api);

  render(<ProductComboManager onClose={jest.fn()} />);
  await screen.findAllByText("Product 1 · item");
  fireEvent.change(screen.getByRole("textbox", { name: "Tên combo" }), {
    target: { value: "Sample combo" },
  });
  fireEvent.change(screen.getByLabelText("Sản phẩm combo 1"), { target: { value: "1" } });
  fireEvent.change(screen.getByLabelText("Sản phẩm combo 2"), { target: { value: "2" } });
  fireEvent.click(screen.getByRole("button", { name: "Tạo combo" }));

  const notification = await screen.findByRole("status");
  expect(api.post).toHaveBeenCalledTimes(1);
  expect(notification).toHaveTextContent("Đã tạo combo");
  expect(notification).toHaveClass("app-notification-success");
  expect(notification.parentElement).toBe(document.body);
});
