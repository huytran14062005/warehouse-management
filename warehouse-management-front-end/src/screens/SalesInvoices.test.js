import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { SalesInvoiceDetail, SalesInvoiceDueCell } from "./SalesInvoices";

const baseInvoice = {
  id: 11,
  status: "nháp",
  payment_status: "chưa thanh toán",
  sold_at: "2026-10-28T22:12:00",
  sale_source: "kho trung tâm",
  warehouse: { name: "Kho trung tâm" },
  employee: { full_name: "Nhân viên bán hàng" },
  customer: { full_name: "Khách hàng", phone: "0335351422", address: "Địa chỉ dài" },
  items: [{ id: 1, product_name: "Nước suối", unit: "Chai", quantity: 10, unit_price: 8000, total: 80000 }],
  discount: { amount: 0 },
  final_amount: 80000,
  paid_amount: 0,
  remaining_amount: 80000,
  payments: [],
};

function renderInvoice(changes = {}) {
  return render(<SalesInvoiceDetail invoice={{ ...baseInvoice, ...changes }} onClose={() => {}} />);
}

test("đơn nháp chỉ hiển thị tổng tiền đơn", () => {
  renderInvoice();
  const dialog = screen.getByRole("dialog");
  expect(within(dialog).getByText("Thời gian lập đơn:")).toBeInTheDocument();
  expect(within(dialog).getByText("28/10/2026 22:12")).toBeInTheDocument();
  expect(within(dialog).queryByText(/Lập lúc/)).not.toBeInTheDocument();
  expect(within(dialog).getByText("Tổng tiền đơn:")).toBeInTheDocument();
  expect(within(dialog).queryByText("Khách đã trả:")).not.toBeInTheDocument();
  expect(within(dialog).queryByText("Số tiền cần trả:")).not.toBeInTheDocument();
  expect(within(dialog).queryByText("Hạn thanh toán:")).not.toBeInTheDocument();
  expect(within(dialog).queryByText("Thanh toán")).not.toBeInTheDocument();
});

test("đơn hoàn thành còn nợ hiển thị số đã trả và hạn thanh toán", () => {
  renderInvoice({
    status: "hoàn thành",
    payment_status: "thanh toán một phần",
    paid_amount: 30000,
    remaining_amount: 50000,
    payment_due_date: "2026-11-15",
    payments: [{
      id: 1, amount: 30000, payment_method: "cash", paid_at: "2026-10-28T22:12:00",
      confirmed_by: { id: 7, full_name: "Kế toán Lan" },
    }],
  });
  const dialog = screen.getByRole("dialog");
  expect(within(dialog).getByText("Khách đã trả:")).toBeInTheDocument();
  expect(within(dialog).getByText("Số tiền cần trả:")).toBeInTheDocument();
  expect(within(dialog).getByText("15/11/2026")).toBeInTheDocument();
  expect(within(dialog).getByText("Lịch sử thanh toán")).toBeInTheDocument();
  expect(within(dialog).getByText("Người xác nhận thanh toán: Kế toán Lan")).toBeInTheDocument();
});

test("lịch sử thanh toán nằm sau form ghi nhận và thời gian cùng dòng phương thức", () => {
  render(
    <SalesInvoiceDetail
      invoice={{
        ...baseInvoice,
        status: "hoàn thành",
        final_amount: 280000,
        paid_amount: 200000,
        remaining_amount: 80000,
        payments: [{
          id: 1, amount: 200000, payment_method: "bank_transfer",
          paid_at: "2026-10-29T15:59:00",
          confirmed_by: { full_name: "Kế toán Lan" },
        }],
      }}
      onClose={() => {}}
      canRecordPayment
      onRecordPayment={() => {}}
    />,
  );
  const dialog = screen.getByRole("dialog");
  const paymentForm = within(dialog).getByText("Ghi nhận thanh toán").closest(".sales-complete-actions");
  const history = within(dialog).getByRole("region", { name: "Lịch sử thanh toán" });
  expect(paymentForm.nextElementSibling).toBe(history);
  const time = within(history).getByText("29/10/2026 15:59");
  expect(time.parentElement).toHaveTextContent("Chuyển khoản (29/10/2026 15:59)");
});

test("lịch sử xử lý đặt thời gian trong ngoặc cạnh tên bước", () => {
  renderInvoice({ workflow_events: [{
    id: 1, action: "submitted_to_warehouse",
    occurred_at: "2026-10-30T14:09:00", actor: "Test nhân viên bán hàng 1",
  }] });
  const entry = screen.getByText("Đã gửi kho").closest(".sales-workflow-entry-line");
  expect(entry).toHaveTextContent("Đã gửi kho(30/10/2026 14:09)");
  expect(entry.nextElementSibling).toHaveTextContent("Test nhân viên bán hàng 1");
});

test("đơn đang xử lý và chưa thu tiền chỉ hiển thị tổng tiền", () => {
  renderInvoice({ status: "đang xử lý" });
  const dialog = screen.getByRole("dialog");
  expect(within(dialog).getByText("Tổng tiền đơn:")).toBeInTheDocument();
  expect(within(dialog).queryByText("Số tiền cần trả:")).not.toBeInTheDocument();
  expect(within(dialog).queryByText("Hạn thanh toán:")).not.toBeInTheDocument();
});

test("kế toán nhập tiền và hạn nợ trong một form, lưu là hoàn thành đơn", () => {
  const onComplete = jest.fn();
  render(
    <SalesInvoiceDetail
      invoice={{ ...baseInvoice, status: "đang giao", delivered_at: "2026-10-30T10:00:00", delivery_recipient: "Khách hàng", final_amount: 1515000, remaining_amount: 1515000 }}
      onClose={() => {}}
      canComplete
      onComplete={onComplete}
    />,
  );
  const dialog = screen.getByRole("dialog");
  const dueDate = within(dialog).getByLabelText("Hạn thanh toán");
  const amount = within(dialog).getByRole("textbox", { name: "Số tiền khách trả" });
  const save = within(dialog).getByRole("button", { name: "Lưu thanh toán" });
  expect(within(dialog).getAllByLabelText("Hạn thanh toán")).toHaveLength(1);
  expect(save).toBeDisabled();
  fireEvent.change(dueDate, { target: { value: "2026-11-15" } });
  fireEvent.click(save);
  expect(onComplete).toHaveBeenCalledWith(0, null, "2026-11-15");
  fireEvent.change(amount, { target: { value: "500.000" } });
  fireEvent.focus(within(dialog).getByRole("searchbox", { name: "Chọn phương thức thanh toán" }));
  fireEvent.click(within(dialog).getByRole("option", { name: "Chuyển khoản" }));
  fireEvent.click(save);
  expect(onComplete).toHaveBeenCalledWith(500000, "bank_transfer", "2026-11-15");
});

test("trả đủ tiền có thể lưu ngay mà không cần hạn nợ", () => {
  const onComplete = jest.fn();
  render(<SalesInvoiceDetail
    invoice={{ ...baseInvoice, status: "đang giao", delivered_at: "2026-10-30T10:00:00" }}
    onClose={() => {}} canComplete onComplete={onComplete}
  />);
  fireEvent.change(screen.getByRole("textbox", { name: "Số tiền khách trả" }), { target: { value: "80.000" } });
  fireEvent.focus(screen.getByRole("searchbox", { name: "Chọn phương thức thanh toán" }));
  fireEvent.click(screen.getByRole("option", { name: "Tiền mặt" }));
  fireEvent.click(screen.getByRole("button", { name: "Lưu thanh toán" }));
  expect(onComplete).toHaveBeenCalledWith(80000, "cash", "");
});

test("thủ kho chỉ nhận đơn đã được gửi kho", () => {
  const onAdvanceStatus = jest.fn();
  const { rerender } = render(<SalesInvoiceDetail invoice={baseInvoice} onClose={() => {}} canManageStatus onAdvanceStatus={onAdvanceStatus} />);
  expect(screen.queryByRole("button", { name: "Xác nhận xử lý đơn" })).not.toBeInTheDocument();
  rerender(<SalesInvoiceDetail invoice={{ ...baseInvoice, warehouse_submitted_at: "2026-10-30T09:00:00", workflow_stage: "chờ kho" }} onClose={() => {}} canManageStatus onAdvanceStatus={onAdvanceStatus} />);
  fireEvent.click(screen.getByRole("button", { name: "Xác nhận xử lý đơn" }));
  expect(onAdvanceStatus).toHaveBeenCalledWith("đang xử lý");
});

test("nhân viên xác nhận giao hàng trước khi kế toán hoàn thành", () => {
  const onConfirmDelivery = jest.fn();
  const invoice = { ...baseInvoice, status: "đang giao" };
  const { rerender } = render(<SalesInvoiceDetail invoice={invoice} onClose={() => {}} canConfirmDelivery canComplete onConfirmDelivery={onConfirmDelivery} />);
  expect(screen.queryByRole("button", { name: "Lưu thanh toán" })).not.toBeInTheDocument();
  fireEvent.change(screen.getByPlaceholderText("Tên người nhận hàng"), { target: { value: "Anh Minh" } });
  fireEvent.click(screen.getByRole("button", { name: "Xác nhận đã giao" }));
  expect(onConfirmDelivery).toHaveBeenCalledWith("Anh Minh", "");
  rerender(<SalesInvoiceDetail invoice={{ ...invoice, delivered_at: "2026-10-30T15:00:00", delivery_recipient: "Anh Minh" }} onClose={() => {}} canConfirmDelivery canComplete onConfirmDelivery={onConfirmDelivery} />);
  expect(screen.getByRole("button", { name: "Lưu thanh toán" })).toBeInTheDocument();
});

test("lịch sử thanh toán dài có nút tải trang tiếp theo", () => {
  const onLoadMorePayments = jest.fn();
  render(<SalesInvoiceDetail
    invoice={{ ...baseInvoice, status: "hoàn thành", payments_total: 21, payments_page: 1,
      payments: [{ id: 1, amount: 1000, payment_method: "cash", paid_at: "2026-10-30T10:00:00" }] }}
    onClose={() => {}} onLoadMorePayments={onLoadMorePayments}
  />);
  fireEvent.click(screen.getByRole("button", { name: "Xem thêm thanh toán" }));
  expect(onLoadMorePayments).toHaveBeenCalledTimes(1);
});

test("thủ kho chuyển trạng thái nhưng không thấy nút hoàn thành đơn", () => {
  render(
    <SalesInvoiceDetail
      invoice={{ ...baseInvoice, status: "đang giao" }}
      onClose={() => {}}
      canManageStatus
    />,
  );
  expect(within(screen.getByRole("dialog")).queryByRole("button", { name: "Lưu thanh toán" })).not.toBeInTheDocument();
});

test("chỉ kế toán thấy form ghi tiền và tiền mặt tính tiền thối", () => {
  const onRecordPayment = jest.fn();
  render(
    <SalesInvoiceDetail
      invoice={{ ...baseInvoice, status: "hoàn thành", final_amount: 1515000, remaining_amount: 1515000 }}
      onClose={() => {}}
      canRecordPayment
      canManageDueDate
      onRecordPayment={onRecordPayment}
    />,
  );
  const dialog = screen.getByRole("dialog");
  const amount = within(dialog).getByRole("textbox", { name: "Số tiền khách trả" });
  const dueDate = within(dialog).getByLabelText("Hạn thanh toán");
  expect(within(dialog).queryByRole("button", { name: "Lưu hạn thanh toán" })).not.toBeInTheDocument();
  fireEvent.change(dueDate, { target: { value: "2026-11-15" } });
  fireEvent.change(amount, { target: { value: "4.445.555" } });
  expect(within(dialog).getByText(/không được vượt quá 1.515.000 đồng/)).toBeInTheDocument();
  expect(within(dialog).getByRole("button", { name: "Lưu thanh toán" })).toBeDisabled();

  fireEvent.focus(within(dialog).getByRole("searchbox", { name: "Chọn phương thức thanh toán" }));
  fireEvent.click(within(dialog).getByRole("option", { name: "Tiền mặt" }));
  expect(within(dialog).queryByText(/không được vượt quá 1.515.000 đồng/)).not.toBeInTheDocument();
  expect(within(dialog).getByText(/Tiền thối lại:/)).toHaveTextContent("2.930.555");
  fireEvent.click(within(dialog).getByRole("button", { name: "Lưu thanh toán" }));
  expect(onRecordPayment).toHaveBeenCalledWith(4445555, "cash", "2026-11-15");

  fireEvent.focus(within(dialog).getByRole("searchbox", { name: "Chọn phương thức thanh toán" }));
  fireEvent.click(within(dialog).getByRole("option", { name: "Chuyển khoản" }));
  expect(within(dialog).queryByText(/Tiền thối lại:/)).not.toBeInTheDocument();
  expect(within(dialog).getByText(/không được vượt quá 1.515.000 đồng/)).toBeInTheDocument();
  expect(within(dialog).getByRole("button", { name: "Lưu thanh toán" })).toBeDisabled();
  expect(onRecordPayment).toHaveBeenCalledTimes(1);
});

test("đơn đã hủy không hiển thị khoản cần trả", () => {
  renderInvoice({ status: "đã hủy" });
  const dialog = screen.getByRole("dialog");
  expect(within(dialog).getByText("Giá trị đơn trước khi hủy:")).toBeInTheDocument();
  expect(within(dialog).queryByText("Số tiền cần trả:")).not.toBeInTheDocument();
});

test("đơn đã thanh toán đủ không hiển thị hạn hay số tiền còn nợ", () => {
  renderInvoice({
    status: "hoàn thành",
    payment_status: "đã thanh toán",
    paid_amount: 80000,
    remaining_amount: 0,
  });
  const dialog = screen.getByRole("dialog");
  expect(within(dialog).getByText("Đã thanh toán")).toBeInTheDocument();
  expect(within(dialog).queryByText("Số tiền cần trả:")).not.toBeInTheDocument();
  expect(within(dialog).queryByText("Hạn thanh toán:")).not.toBeInTheDocument();
});

test("cột hạn thanh toán hiển thị ngày và tình trạng nợ của đơn hoàn thành", () => {
  const { rerender } = render(
    <SalesInvoiceDueCell invoice={{
      status: "hoàn thành", remaining_amount: 50000,
      payment_due_date: "2026-11-15", payment_due_status: "overdue", days_overdue: 3,
    }} />,
  );
  expect(screen.getByText("15/11/2026")).toBeInTheDocument();
  expect(screen.getByText("Quá hạn 3 ngày")).toHaveClass("is-overdue");

  for (const [days, expectedClass] of [
    [9, "is-due-yellow"],
    [5, "is-due-orange-light"],
    [2, "is-due-orange-dark"],
    [1, "is-due-red"],
  ]) {
    rerender(<SalesInvoiceDueCell invoice={{
      status: "hoàn thành", remaining_amount: 50000,
      payment_due_date: "2026-11-15",
      payment_due_status: days > 7 ? "not_due" : "due_soon",
      days_until_due: days,
    }} />);
    const date = screen.getByText("15/11/2026");
    const badge = screen.getByText(`Còn ${days} ngày`);
    expect(badge).toHaveClass(expectedClass);
    expect(date.parentElement).toContainElement(badge);
  }

  rerender(<SalesInvoiceDueCell invoice={{
    status: "hoàn thành", remaining_amount: 50000,
    payment_due_date: "2026-11-15", payment_due_status: "due_today", days_until_due: 0,
  }} />);
  expect(screen.getByText("Đến hạn hôm nay")).toHaveClass("is-due-red");

  rerender(<SalesInvoiceDueCell invoice={{ status: "hoàn thành", remaining_amount: 0 }} />);
  expect(screen.getByText("Đã thanh toán")).toBeInTheDocument();

  rerender(<SalesInvoiceDueCell invoice={{ status: "nháp", remaining_amount: 50000, payment_due_date: "2026-11-15" }} />);
  expect(screen.getByText("—")).toBeInTheDocument();
});
