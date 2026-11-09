import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { authApis, endpoints } from "../configs/Apis";
import Promotions from "./Promotions";

jest.mock("../configs/Apis", () => ({
  authApis: jest.fn(),
  endpoints: {
    promotions: "/promotions",
    promotionDetail: (id) => `/promotions/${id}`,
  },
}));

afterEach(() => localStorage.removeItem("user"));

test("loads each promotions page from the API using the shared pagination controls", async () => {
  localStorage.setItem("user", JSON.stringify({ role: "quản lý" }));
  const get = jest.fn((_, { params }) => Promise.resolve({
    data: {
      promotions: [{
        id: params.page,
        name: `Chương trình trang ${params.page}`,
        condition_summary: "Điều kiện",
        benefit_summary: "Giảm giá",
      }],
      pagination: { page: params.page, per_page: 10, total: 11, total_pages: 2 },
    },
  }));
  authApis.mockReturnValue({ get });

  render(<Promotions />);
  expect(await screen.findByText("Chương trình trang 1")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "2" }));
  expect(await screen.findByText("Chương trình trang 2")).toBeInTheDocument();
  expect(screen.queryByText("Chương trình trang 1")).not.toBeInTheDocument();
  expect(get).toHaveBeenLastCalledWith(endpoints.promotions, {
    params: { page: 2, per_page: 10 },
  });
});
