import { fireEvent, render, screen, within } from "@testing-library/react";
import ProductDetailModal from "./ProductDetailModal";

const product = {
  name: "Bánh quy",
  unit: "Hộp",
  default_sale_price: 15000,
  available_stock: 44,
  total_imported: 200,
  total_sold: 46,
  total_damaged: 0,
  total_transferred: 110,
  warehouses: [{ warehouse_id: 1, warehouse_name: "Kho trung tâm", stock: 44 }],
};

test("product detail uses the same readable data layout without edit permission", () => {
  const onClose = jest.fn();
  render(<ProductDetailModal product={product} onClose={onClose} />);

  expect(screen.getByRole("dialog", { name: "Bánh quy" })).toBeInTheDocument();
  expect(screen.getByText("Thông tin sản phẩm")).toBeInTheDocument();
  const quantities = screen.getByRole("region", { name: "Thông tin số lượng trong kho" });
  expect(within(quantities).getByText("Tồn kho hiện tại:")).toBeInTheDocument();
  expect(screen.getByText("Đơn vị tính:")).toBeInTheDocument();
  expect(screen.getByText("Giá bán mặc định:")).toBeInTheDocument();
  for (const label of ["Đã nhập:", "Đã bán:", "Đã hư:", "Đã cấp đi:"]) {
    expect(within(quantities).getByText(label)).toBeInTheDocument();
  }
  expect(within(quantities).getByText("44 Hộp")).toBeInTheDocument();
  expect(screen.queryByText("Tồn theo kho")).not.toBeInTheDocument();
  expect(screen.queryByText("Kho trung tâm")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Chỉnh sửa sản phẩm" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Đóng chi tiết sản phẩm" }));
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("manager sees the same detail with an edit action", () => {
  const onEdit = jest.fn();
  render(<ProductDetailModal product={product} canEdit onClose={() => {}} onEdit={onEdit} />);

  expect(screen.getByRole("dialog", { name: "Bánh quy" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Chỉnh sửa sản phẩm" }));
  expect(onEdit).toHaveBeenCalledTimes(1);
});
