import { fireEvent, render, screen } from "@testing-library/react";
import CustomerFields from "./CustomerFields";

test("customer fields allow a long address and show the shared dropdown state", () => {
  const onChange = jest.fn();
  const { container } = render(
    <CustomerFields
      value={{ full_name: "", phone: "", address: "", sales_area_id: "" }}
      onChange={onChange}
      salesAreas={[{ id: 2, name: "Khu vực 2" }]}
      requireSalesArea
    />,
  );

  const address = screen.getByLabelText("Địa chỉ");
  expect(address.tagName).toBe("TEXTAREA");
  fireEvent.change(address, { target: { value: "Số 12, đường A, phường B, quận C" } });
  expect(onChange).toHaveBeenCalledWith("address", "Số 12, đường A, phường B, quận C");

  fireEvent.click(screen.getByRole("button", { name: "Mở danh sách" }));
  expect(container.querySelector(".dropdown-chevron")).toHaveClass("is-open");
  fireEvent.click(screen.getByRole("option", { name: "Khu vực 2" }));
  expect(onChange).toHaveBeenCalledWith("sales_area_id", "2");
  expect(container.querySelector(".dropdown-chevron")).not.toHaveClass("is-open");
});
