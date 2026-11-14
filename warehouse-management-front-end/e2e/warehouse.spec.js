const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const UI = 'http://127.0.0.1:3107/warehouse-management';
const API = 'http://127.0.0.1:5107/api';

function fixture() {
  const runId = process.env.E2E_RUN_ID;
  if (!runId || !/^[a-f0-9]{16,40}$/.test(runId)) {
    throw new Error('Missing generated E2E_RUN_ID');
  }
  return JSON.parse(fs.readFileSync(
    path.resolve(__dirname, '..', '..', 'tests', '.e2e-data', `${runId}.json`),
    'utf8',
  ));
}

async function asRole(browser, role) {
  const user = fixture().users[role];
  const context = await browser.newContext();
  await context.addInitScript(({ token, profile }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(profile));
  }, { token: user.token, profile: { id: user.id, username: user.username,
    full_name: user.name, role: user.role } });
  return { context, page: await context.newPage() };
}

async function apiAs(request, role, method, endpoint, data) {
  const response = await request[method](`${API}${endpoint}`, {
    headers: { Authorization: `Bearer ${fixture().users[role].token}` },
    ...(data === undefined ? {} : { data }),
  });
  return response;
}

async function selectOption(page, label, text) {
  const search = page.getByRole('searchbox', { name: label });
  await search.fill(text);
  await page.getByRole('listbox', { name: label })
    .getByRole('option', { name: text, exact: true }).click({ force: true });
}

async function selectOptionContaining(page, label, text) {
  await page.getByRole('searchbox', { name: label }).fill(text);
  await page.getByRole('listbox', { name: label }).getByRole('option')
    .filter({ hasText: text }).first().click({ force: true });
}

async function openOrder(page, id) {
  await page.goto(`${UI}/sales-invoices`, { waitUntil: 'domcontentloaded' });
  // The table shows customer and amount, not the order ID; each journey uses its own customer.
  const row = page.locator('.sales-table tbody tr').filter({ hasText: fixture().names.customer });
  await expect(row).toBeVisible();
  await row.dispatchEvent('click');
  return page.getByRole('dialog', { name: `Đơn hàng #${id}` });
}

async function createProduct(request, name, price = 10000) {
  const response = await apiAs(request, 'manager', 'post', '/products', {
    name, unit: 'Cái', default_sale_price: price,
  });
  expect(response.status(), await response.text()).toBe(201);
  return (await response.json()).product.id;
}

async function seedStock(request, productId, quantity = 20) {
  const f = fixture();
  const response = await apiAs(request, 'keeper', 'post', '/import-invoices', {
    warehouse_id: f.warehouses.central,
    supplier_id: f.supplier.id,
    items: [{ product_id: productId, quantity, unit_price: 5000 }],
    inbound_fee: 0,
    note: `E2E stock ${f.run_id}`,
  });
  expect(response.status(), await response.text()).toBe(201);
  return (await response.json()).invoice;
}

test.describe('A. Tài khoản, phiên và phân quyền', () => {
  test('đăng nhập sai, chưa duyệt, bị khóa và đăng nhập đúng qua giao diện', async ({ page }) => {
    const f = fixture();
    await page.goto(`${UI}/login`, { waitUntil: 'domcontentloaded' });
    for (const [role, password, expected] of [
      ['manager', 'wrong-password', 'Sai tên đăng nhập hoặc mật khẩu!'],
      ['pending', f.password, /phải được duyệt/i],
      ['locked', f.password, /đình chỉ|khóa/i],
    ]) {
      await page.getByRole('textbox', { name: 'Tên đăng nhập' }).fill(f.users[role].username);
      await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
      await page.getByRole('main').getByRole('button', { name: 'Đăng nhập', exact: true }).click({ force: true });
      await expect(page.getByText(expected)).toBeVisible();
      await expect(page).toHaveURL(/\/login$/);
    }
    await page.getByRole('textbox', { name: 'Tên đăng nhập' }).fill(f.users.manager.username);
    await page.getByLabel('Mật khẩu', { exact: true }).fill(f.password);
    await page.getByRole('main').getByRole('button', { name: 'Đăng nhập', exact: true }).click({ force: true });
    await expect(page).not.toHaveURL(/\/login$/);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('user')).role)).toBe('quản lý');
    await expect(page.getByText(f.users.manager.name).first()).toBeVisible();
  });

  test('route riêng yêu cầu đăng nhập; API từ chối vai trò sai và ID không tồn tại', async ({ page, request }) => {
    const f = fixture();
    await page.goto(`${UI}/pricing-management`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/login$/);
    const countBefore = await apiAs(request, 'manager', 'get', '/products/inventory');
    expect(countBefore.status()).toBe(200);
    const beforeTotal = (await countBefore.json()).pagination.total;
    const denied = await apiAs(request, 'seller', 'post', '/products', {
      name: `Forbidden ${f.run_id}`, unit: 'Cái', default_sale_price: 1000,
    });
    expect(denied.status()).toBe(403);
    expect((await (await apiAs(request, 'manager', 'get', '/products/inventory')).json()).pagination.total)
      .toBe(beforeTotal);
    expect((await apiAs(request, 'keeper', 'get', '/company-funds')).status()).toBe(403);
    expect((await apiAs(request, 'courier', 'get', '/sales-invoices')).status()).toBe(403);
    expect((await apiAs(request, 'keeper', 'get', '/reports/inventory?warehouse_id=99999999')).status())
      .toBe(404);
  });
});

test.describe('B. Danh mục, tìm kiếm và combo', () => {
  test('quản lý tạo sản phẩm qua giao diện; tên trùng bị chặn và danh sách tìm thấy bản ghi', async ({ browser, request }, testInfo) => {
    const { context, page } = await asRole(browser, 'manager');
    const name = `Sản phẩm E2E ${fixture().run_id.slice(0, 8)} ${testInfo.retry}`;
    try {
      await page.goto(`${UI}/products`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: /Thêm sản phẩm/ }).first().click({ force: true });
      const dialog = page.getByRole('dialog').last();
      await expect(dialog).toBeVisible();
      await dialog.getByLabel('Tên sản phẩm').fill(name);
      await dialog.getByLabel('Đơn vị tính').fill('Cái');
      await dialog.getByRole('textbox', { name: 'Giá bán mặc định' }).fill('10000');
      await dialog.getByRole('button', { name: 'Thêm sản phẩm' }).click({ force: true });
      await expect(page.getByText(name)).toBeVisible();
      const list = await apiAs(request, 'manager', 'get', `/products/inventory?keyword=${encodeURIComponent(name)}`);
      expect(list.status()).toBe(200);
      expect((await list.json()).products.some((item) => item.name === name)).toBe(true);
    } finally {
      await context.close();
    }
  });

  test('combo đã cấu hình có hai thành phần và chỉ quản lý được sửa qua API', async ({ browser, request }) => {
    const f = fixture();
    const { context, page } = await asRole(browser, 'manager');
    try {
      await page.goto(`${UI}/products`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: '+ Tạo combo' }).click({ force: true });
      await expect(page.getByText(f.names.combo)).toBeVisible();
      const catalog = await apiAs(request, 'manager', 'get', '/products/combos');
      expect(catalog.status()).toBe(200);
      const combo = (await catalog.json()).combos.find((item) => item.id === f.combo);
      expect(combo.items).toHaveLength(2);
      const denied = await apiAs(request, 'seller', 'put', `/products/combos/${f.combo}`, {
        name: 'No permission', items: [], sale_price: 1,
      });
      expect(denied.status()).toBe(403);
      const after = await apiAs(request, 'manager', 'get', '/products/combos');
      expect((await after.json()).combos.find((item) => item.id === f.combo).name).toBe(f.names.combo);
    } finally {
      await context.close();
    }
  });
});

test.describe('C. Nhập kho và trả nhà cung cấp', () => {
  test('thủ kho nhập hàng trên UI, kế toán trả một phần; đối chiếu tồn, nợ và quỹ', async ({ browser, request }) => {
    const f = fixture();
    const keeper = await asRole(browser, 'keeper');
    const accountant = await asRole(browser, 'accountant');
    try {
      await keeper.page.goto(`${UI}/import-invoices`, { waitUntil: 'domcontentloaded' });
      await keeper.page.getByRole('button', { name: '+ Tạo phiếu nhập' }).click({ force: true });
      const form = keeper.page.getByRole('dialog').last();
      await expect(form).toBeVisible();
      await selectOption(form, 'Chọn nhà cung cấp', f.supplier.name);
      await form.getByRole('button', { name: '+ Thêm sản phẩm' }).click({ force: true });
      await selectOption(form, 'Chọn sản phẩm nhập', f.names.new);
      await form.getByRole('spinbutton', { name: 'Số lượng nhập' }).fill('4');
      await form.getByRole('textbox', { name: 'Đơn giá nhập' }).fill('5000');
      await form.getByRole('textbox', { name: 'Phí mua hàng về kho' }).fill('1000');
      await form.getByPlaceholder('Nhập ghi chú cho phiếu nhập').fill(`E2E import ${f.run_id}`);
      const createdResponse = keeper.page.waitForResponse((response) =>
        response.url().endsWith('/api/import-invoices') && response.request().method() === 'POST');
      await form.getByRole('button', { name: 'Lưu phiếu nhập' }).click({ force: true });
      const created = await createdResponse;
      expect(created.status(), await created.text()).toBe(201);
      const invoice = (await created.json()).invoice;
      expect(invoice.items).toHaveLength(1);
      expect(invoice.items[0].quantity).toBe(4);
      expect(invoice.total_amount).toBe(20000);
      expect(invoice.remaining_amount).toBe(20000);
      expect(invoice.inbound_fee).toBe(1000);

      const stock = await apiAs(request, 'keeper', 'get',
        `/products/${f.products.new}?warehouse_id=${f.warehouses.central}`);
      expect(stock.status()).toBe(200);
      expect((await stock.json()).product.available_stock).toBe(4);
      const fundsBefore = (await (await apiAs(request, 'accountant', 'get', '/company-funds')).json()).funds;
      const cashBefore = fundsBefore.find((fund) => fund.method === 'cash').balance;

      await accountant.page.goto(`${UI}/import-invoices`, { waitUntil: 'domcontentloaded' });
      await accountant.page.getByRole('searchbox', { name: 'Tìm phiếu nhập' }).fill(String(invoice.id));
      const row = accountant.page.locator('.warehouse-clickable-table tbody tr')
        .filter({ hasText: '20.000' });
      await expect(row).toHaveCount(1);
      await row.click({ force: true });
      const detail = accountant.page.getByRole('dialog').last();
      await detail.getByRole('textbox', { name: 'Số tiền trả nhà cung cấp' }).fill('5000');
      await selectOption(detail, 'Chọn phương thức thanh toán', 'Tiền mặt');
      const paymentResponse = accountant.page.waitForResponse((response) =>
        response.url().endsWith(`/api/import-invoices/${invoice.id}/payments`) &&
        response.request().method() === 'POST');
      await detail.getByRole('button', { name: 'Ghi nhận đã trả' }).click({ force: true });
      expect((await paymentResponse).status()).toBe(201);
      const saved = await apiAs(request, 'accountant', 'get', `/import-invoices/${invoice.id}`);
      const after = await saved.json();
      expect(after.paid_amount).toBe(5000);
      expect(after.remaining_amount).toBe(15000);
      expect(after.payments).toHaveLength(1);
      const fundsAfter = (await (await apiAs(request, 'accountant', 'get', '/company-funds')).json()).funds;
      expect(fundsAfter.find((fund) => fund.method === 'cash').balance).toBe(cashBefore - 5000);
      await accountant.page.reload();
      await expect(accountant.page.getByText(f.supplier.name).first()).toBeVisible();
    } finally {
      await keeper.context.close();
      await accountant.context.close();
    }
  });

  test('API từ chối trả dưới 500, trả vượt nợ và người không có quyền; không ghi quỹ', async ({ request }, testInfo) => {
    const productId = await createProduct(request, `Nhập lỗi E2E ${fixture().run_id.slice(0, 8)} ${testInfo.workerIndex}`);
    const invoice = await seedStock(request, productId, 2);
    const before = await apiAs(request, 'accountant', 'get', `/import-invoices/${invoice.id}`);
    const cashBefore = (await (await apiAs(request, 'accountant', 'get', '/company-funds')).json())
      .funds.find((fund) => fund.method === 'cash').balance;
    expect((await before.json()).remaining_amount).toBe(10000);
    for (const [role, amount, status] of [
      ['accountant', 499, 400], ['accountant', 10001, 400], ['keeper', 500, 403],
    ]) {
      const response = await apiAs(request, role, 'post', `/import-invoices/${invoice.id}/payments`,
        { amount, payment_method: 'cash' });
      expect(response.status(), await response.text()).toBe(status);
    }
    const after = await apiAs(request, 'accountant', 'get', `/import-invoices/${invoice.id}`);
    expect((await after.json()).payments).toHaveLength(0);
    const cashAfter = (await (await apiAs(request, 'accountant', 'get', '/company-funds')).json())
      .funds.find((fund) => fund.method === 'cash').balance;
    expect(cashAfter).toBe(cashBefore);
  });
});

test.describe('D. Điều chuyển và tồn nhân viên', () => {
  test('thủ kho cấp hàng bằng UI, tồn kho nguồn giảm và tồn nhân viên tăng', async ({ browser, request }) => {
    const f = fixture();
    const { context, page } = await asRole(browser, 'keeper');
    try {
      await page.goto(`${UI}/stock-transfers`, { waitUntil: 'domcontentloaded' });
      const createTransfer = page.getByRole('button', { name: '+ Cấp hàng cho nhân viên' });
      await expect(createTransfer).toBeEnabled();
      await createTransfer.click();
      const dialog = page.getByRole('dialog', { name: 'Cấp hàng cho nhân viên' });
      await selectOption(dialog, 'Chọn nhân viên nhận hàng', `${f.users.seller.name} - ${f.users.seller.phone || ''}`);
      await dialog.getByRole('button', { name: '+ Thêm sản phẩm' }).click({ force: true });
      await selectOption(dialog, 'Chọn sản phẩm cấp đi', f.names.biscuit);
      await dialog.getByRole('spinbutton', { name: 'Số lượng cấp đi' }).fill('2');
      const responsePromise = page.waitForResponse((response) =>
        response.url().endsWith('/api/stock-transfers') && response.request().method() === 'POST');
      await dialog.getByRole('button', { name: 'Xác nhận cấp hàng' }).click({ force: true });
      const response = await responsePromise;
      expect(response.status(), await response.text()).toBe(201);
      const stock = await apiAs(request, 'keeper', 'get',
        `/products/${f.products.biscuit}?warehouse_id=${f.warehouses.central}`);
      expect((await stock.json()).product.available_stock).toBe(28);
      const employeeStock = await apiAs(request, 'seller', 'get', '/employee-stock/me');
      expect(employeeStock.status()).toBe(200);
      expect(JSON.stringify(await employeeStock.json())).toContain(f.names.biscuit);
    } finally {
      await context.close();
    }
  });
});

test.describe('E–G. Đơn bán, giao nhận, khuyến mãi, thu tiền và báo cáo', () => {
  test('hành trình thật từ nhập hàng đến đơn hoàn thành qua bốn vai trò', async ({ browser, request }) => {
    test.setTimeout(240000);
    const f = fixture();
    const journeyProductName = `Hàng hành trình E2E ${f.run_id.slice(0, 8)}`;
    const journeyProductId = await createProduct(request, journeyProductName, 2000);
    const keeper = await asRole(browser, 'keeper');
    const seller = await asRole(browser, 'seller');
    const courier = await asRole(browser, 'courier');
    const accountant = await asRole(browser, 'accountant');
    const monthStart = new Date().toISOString().slice(0, 7) + '-01';
    const reportPath = `/pricing/profitability?from_date=${monthStart}`;
    const revenueBefore = (await (await apiAs(request, 'manager', 'get', reportPath)).json()).revenue;
    try {
      // The new product starts with no stock; all stock for this journey comes from this UI import.
      await keeper.page.goto(`${UI}/import-invoices`, { waitUntil: 'domcontentloaded' });
      await keeper.page.getByRole('button', { name: '+ Tạo phiếu nhập' }).click({ force: true });
      const importForm = keeper.page.getByRole('dialog').last();
      await selectOption(importForm, 'Chọn nhà cung cấp', f.supplier.name);
      await importForm.getByRole('button', { name: '+ Thêm sản phẩm' }).click({ force: true });
      await selectOption(importForm, 'Chọn sản phẩm nhập', journeyProductName);
      await importForm.getByRole('spinbutton', { name: 'Số lượng nhập' }).fill('8');
      await importForm.getByRole('textbox', { name: 'Đơn giá nhập' }).fill('1000');
      await importForm.getByRole('textbox', { name: 'Phí mua hàng về kho' }).fill('500');
      const importResponse = keeper.page.waitForResponse((r) =>
        r.url().endsWith('/api/import-invoices') && r.request().method() === 'POST');
      await importForm.getByRole('button', { name: 'Lưu phiếu nhập' }).click({ force: true });
      const imported = await importResponse;
      expect(imported.status(), await imported.text()).toBe(201);
      const importId = (await imported.json()).invoice.id;
      const cashBefore = (await (await apiAs(request, 'accountant', 'get', '/company-funds')).json())
        .funds.find((fund) => fund.method === 'cash').balance;

      // Accountant pays the supplier in the real detail form.
      await accountant.page.goto(`${UI}/import-invoices`, { waitUntil: 'domcontentloaded' });
      await accountant.page.getByRole('searchbox', { name: 'Tìm phiếu nhập' }).fill(String(importId));
      const importRow = accountant.page.locator('.warehouse-clickable-table tbody tr')
        .filter({ hasText: '8.000' });
      await expect(importRow).toHaveCount(1);
      await importRow.click({ force: true });
      const importDetail = accountant.page.getByRole('dialog').last();
      await importDetail.getByRole('textbox', { name: 'Số tiền trả nhà cung cấp' }).fill('8000');
      await selectOption(importDetail, 'Chọn phương thức thanh toán', 'Tiền mặt');
      const supplierPaymentResponse = accountant.page.waitForResponse((r) =>
        r.url().endsWith(`/api/import-invoices/${importId}/payments`) && r.request().method() === 'POST');
      await importDetail.getByRole('button', { name: 'Ghi nhận đã trả' }).click({ force: true });
      expect((await supplierPaymentResponse).status()).toBe(201);

      // Seller creates a discounted order through the editor.
      await seller.page.goto(`${UI}/sales-invoices`, { waitUntil: 'domcontentloaded' });
      await seller.page.getByRole('button', { name: '+ Tạo đơn bán hàng' }).click({ force: true });
      const editor = seller.page.getByRole('dialog').last();
      await selectOption(editor, 'Chọn khách hàng', f.names.customer);
      await editor.getByRole('button', { name: '+ Thêm sản phẩm / combo' }).click({ force: true });
      await selectOption(editor, 'Chọn sản phẩm hoặc combo', journeyProductName);
      await editor.getByRole('spinbutton', { name: 'Số lượng' }).fill('2');
      await editor.getByRole('button', { name: 'Chọn khuyến mãi' }).click({ force: true });
      await editor.getByRole('button').filter({ hasText: `Giảm E2E ${f.run_id.slice(0, 8)}` }).click({ force: true });
      await editor.getByPlaceholder('Nhập ghi chú cho đơn hàng').fill(`E2E order ${f.run_id}`);
      const orderResponse = seller.page.waitForResponse((r) =>
        r.url().endsWith('/api/sales-invoices') && r.request().method() === 'POST');
      await editor.getByRole('button', { name: 'Tạo đơn nháp' }).click({ force: true });
      const orderCreated = await orderResponse;
      expect(orderCreated.status(), await orderCreated.text()).toBe(201);
      const orderId = (await orderCreated.json()).invoice.id;
      const draft = (await (await apiAs(request, 'seller', 'get', `/sales-invoices/${orderId}`)).json());
      expect(draft.status).toBe('nháp');
      expect(draft.items[0].quantity).toBe(2);
      expect(draft.final_amount).toBe(3000); // 2 × 2,000 − 1,000; independent arithmetic.

      // Handoff to warehouse and prevent seller from taking the keeper action.
      const sellerDetail = await openOrder(seller.page, orderId);
      await selectOptionContaining(sellerDetail, 'Thủ kho nhận đơn', f.users.keeper.name);
      await sellerDetail.getByRole('button', { name: 'Gửi đơn cho kho' }).click({ force: true });
      await expect(sellerDetail.getByText(f.users.keeper.name).first()).toBeVisible();
      expect((await apiAs(request, 'seller', 'put', `/sales-invoices/${orderId}/status`,
        { status: 'đang xử lý' })).status()).toBe(403);

      const keeperDetail = await openOrder(keeper.page, orderId);
      await expect(keeperDetail.getByText('Chờ nhận việc')).toBeVisible();
      await keeperDetail.getByRole('button', { name: 'Nhận xử lý đơn này' }).click({ force: true });
      const processingResponse = keeper.page.waitForResponse((r) =>
        r.url().endsWith(`/api/sales-invoices/${orderId}/status`) && r.request().method() === 'PUT');
      await keeperDetail.getByRole('button', { name: 'Xác nhận xử lý đơn' }).click({ force: true });
      expect((await processingResponse).status()).toBe(200);
      const stockAfterDispatch = await apiAs(request, 'keeper', 'get',
        `/products/${journeyProductId}?warehouse_id=${f.warehouses.central}`);
      expect((await stockAfterDispatch.json()).product.available_stock).toBe(6);
      await keeperDetail.getByRole('radio', { name: 'Nhân viên công ty' }).check();
      await selectOptionContaining(keeperDetail, 'Nhân viên giao hàng', f.users.courier.name);
      await keeperDetail.getByRole('button', { name: 'Lưu phương án' }).click({ force: true });
      await expect(keeperDetail.getByText(f.users.courier.name).first()).toBeVisible();

      // The assigned courier sees the order, starts delivery, then hands it to accounting.
      await courier.page.goto(`${UI}/my-deliveries`, { waitUntil: 'domcontentloaded' });
      await courier.page.getByRole('button', { name: new RegExp(`Đơn #${orderId} ·`) }).click({ force: true });
      let courierDetail = courier.page.getByRole('dialog', { name: `Đơn giao hàng #${orderId}` });
      await courierDetail.getByRole('button', { name: 'Bắt đầu giao hàng' }).click({ force: true });
      const deliveryStarted = courier.page.waitForResponse((r) =>
        r.url().endsWith(`/api/sales-invoices/my-deliveries/${orderId}/start`) &&
        r.request().method() === 'POST');
      await courier.page.getByRole('dialog', { name: 'Bắt đầu giao hàng?' })
        .getByRole('button', { name: 'Bắt đầu giao' }).click({ force: true });
      expect((await deliveryStarted).status()).toBe(200);
      await courier.page.getByRole('dialog', { name: `Đơn giao hàng #${orderId}` })
        .getByRole('button', { name: 'Đóng', exact: true }).first().click({ force: true });
      const assigneesLoaded = courier.page.waitForResponse((r) =>
        r.url().includes('/api/sales-invoices/assignees?') &&
        r.url().includes('stage=accounting') && r.request().method() === 'GET');
      await courier.page.getByRole('button', { name: new RegExp(`Đơn #${orderId} ·`) })
        .click({ force: true });
      expect((await (await assigneesLoaded).json()).employees.some((person) =>
        person.id === f.users.accountant.id)).toBe(true);
      courierDetail = courier.page.getByRole('dialog', { name: `Đơn giao hàng #${orderId}` });
      await courierDetail.getByRole('textbox', { name: 'Người thực nhận hàng' }).fill('Khách E2E');
      await expect(courierDetail.getByRole('searchbox', { name: 'Kế toán tiếp nhận đơn' }))
        .toHaveValue(new RegExp(f.users.accountant.name));
      await courierDetail.getByRole('button', { name: 'Xác nhận đã giao' }).click({ force: true });
      await courier.page.getByRole('dialog', { name: /Xác nhận đã giao/ })
        .getByRole('button', { name: /Xác nhận/ }).last().click({ force: true });

      // Accounting completes and collects exact cash; no duplicate receipt on retry.
      const accountingDetail = await openOrder(accountant.page, orderId);
      await accountingDetail.getByRole('button', { name: 'Nhận xử lý đơn này' }).click({ force: true });
      await accountingDetail.getByRole('textbox', { name: 'Số tiền khách trả' }).fill('3000');
      await selectOption(accountingDetail, 'Chọn phương thức thanh toán', 'Tiền mặt');
      const completionResponse = accountant.page.waitForResponse((r) =>
        r.url().endsWith(`/api/sales-invoices/${orderId}/complete`) &&
        r.request().method() === 'PUT');
      await accountingDetail.getByRole('button', { name: 'Hoàn thành và thu tiền' }).click({ force: true });
      expect((await completionResponse).status()).toBe(200);
      const completed = (await (await apiAs(request, 'accountant', 'get', `/sales-invoices/${orderId}`)).json());
      expect(completed.status).toBe('hoàn thành');
      expect(completed.paid_amount).toBe(3000);
      expect(completed.payments).toHaveLength(1);
      expect((await apiAs(request, 'accountant', 'put', `/sales-invoices/${orderId}/complete`,
        { payment_amount: 3000, payment_method: 'cash' })).status()).toBe(400);
      const cashAfter = (await (await apiAs(request, 'accountant', 'get', '/company-funds')).json())
        .funds.find((fund) => fund.method === 'cash').balance;
      expect(cashAfter).toBe(cashBefore - 8000 + 3000);
      const customer = (await (await apiAs(request, 'accountant', 'get',
        `/customers/${f.customers.new}`)).json()).customer;
      expect(customer.debt_amount).toBe(0);
      const revenueAfter = (await (await apiAs(request, 'manager', 'get', reportPath)).json()).revenue;
      expect(revenueAfter - revenueBefore).toBe(3000);
      const reopened = await openOrder(accountant.page, orderId);
      await expect(reopened.getByText('Hoàn thành').first()).toBeVisible();
    } finally {
      await keeper.context.close();
      await seller.context.close();
      await courier.context.close();
      await accountant.context.close();
    }
  });
});

test.describe('H. Quỹ và chi phí kinh doanh', () => {
  test('chi phí phát sinh tính giá trước thanh toán; ghi chi và hủy hoàn quỹ', async ({ browser, request }) => {
    const f = fixture();
    const marker = `E2E expense ${f.run_id}`;
    const { context, page } = await asRole(browser, 'manager');
    try {
      const beforeCatalog = await apiAs(request, 'manager', 'get', '/pricing/catalog');
      const beforeAllocated = (await beforeCatalog.json()).pricing_allocated_expenses;
      const beforeFund = (await (await apiAs(request, 'manager', 'get', '/company-funds')).json())
        .funds.find((fund) => fund.method === 'cash').balance;
      await page.goto(`${UI}/pricing-management`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: '+ Ghi chi phí' }).dispatchEvent('click');
      const editor = page.getByRole('dialog', { name: 'Ghi chi phí phát sinh' });
      await editor.getByRole('button', { name: '+ Thêm loại chi phí' }).click({ force: true });
      await editor.getByRole('textbox', { name: 'Tên loại chi phí mới' })
        .fill(`Loại E2E ${f.run_id.slice(0, 8)}`);
      await editor.getByRole('button', { name: 'Lưu loại' }).click({ force: true });
      await editor.getByLabel('Số tiền', { exact: true }).fill('10000');
      await editor.getByRole('textbox', { name: 'Nội dung chi phí' }).fill(marker);
      const createdResponse = page.waitForResponse((r) =>
        r.url().endsWith('/api/pricing/expenses') && r.request().method() === 'POST');
      await editor.getByRole('button', { name: 'Ghi nhận chi phí' }).click({ force: true });
      const created = await createdResponse;
      expect(created.status(), await created.text()).toBe(201);
      const expenseId = (await created.json()).expense.id;
      expect((await (await apiAs(request, 'manager', 'get', '/pricing/catalog')).json())
        .pricing_allocated_expenses - beforeAllocated).toBe(10000);
      const row = page.getByRole('row').filter({ hasText: marker });
      await expect(row).toBeVisible();
      await row.getByRole('button', { name: 'Ghi đã chi' }).click({ force: true });
      const payDialog = page.getByRole('dialog', { name: 'Ghi đã chi tiền?' });
      await payDialog.getByLabel('Chi từ quỹ').selectOption({ label: 'Tiền mặt' });
      const paidResponse = page.waitForResponse((r) =>
        r.url().endsWith(`/api/pricing/expenses/${expenseId}/pay`) &&
        r.request().method() === 'POST');
      await payDialog.getByRole('button', { name: 'Ghi đã chi' }).click({ force: true });
      expect((await paidResponse).status()).toBe(200);
      const paid = await apiAs(request, 'manager', 'get', '/pricing/catalog');
      expect((await paid.json()).pricing_allocated_expenses - beforeAllocated).toBe(10000);
      const afterPayFund = (await (await apiAs(request, 'manager', 'get', '/company-funds')).json())
        .funds.find((fund) => fund.method === 'cash').balance;
      expect(afterPayFund).toBe(beforeFund - 10000);

      await row.getByRole('button', { name: 'Hủy khoản chi' }).click({ force: true });
      const voidDialog = page.getByRole('dialog', { name: 'Hủy khoản chi?' });
      await voidDialog.getByRole('textbox', { name: 'Lý do hủy' }).fill(`Sai chứng từ E2E ${f.run_id}`);
      const voidResponse = page.waitForResponse((r) =>
        r.url().endsWith(`/api/pricing/expenses/${expenseId}/void`) &&
        r.request().method() === 'POST');
      await voidDialog.getByRole('button', { name: 'Hủy khoản chi' }).click({ force: true });
      expect((await voidResponse).status()).toBe(200);
      const expense = await apiAs(request, 'manager', 'get', `/pricing/expenses?from_date=2000-01-01&to_date=2100-01-01`);
      expect(JSON.stringify(await expense.json())).toContain(String(expenseId));
      expect((await (await apiAs(request, 'manager', 'get', '/pricing/catalog')).json())
        .pricing_allocated_expenses).toBe(beforeAllocated);
      const afterVoidFund = (await (await apiAs(request, 'manager', 'get', '/company-funds')).json())
        .funds.find((fund) => fund.method === 'cash').balance;
      expect(afterVoidFund).toBe(beforeFund);
    } finally {
      await context.close();
    }
  });
});

test.describe('I. Hàng hư hỏng', () => {
  test('thủ kho báo hư, quản lý duyệt; chỉ trừ tồn một lần', async ({ browser, request }) => {
    const f = fixture();
    const keeper = await asRole(browser, 'keeper');
    const manager = await asRole(browser, 'manager');
    try {
      await keeper.page.goto(`${UI}/damage-reports`, { waitUntil: 'domcontentloaded' });
      await keeper.page.getByRole('button', { name: '+ Báo hàng hư' }).click({ force: true });
      const editor = keeper.page.getByRole('dialog').last();
      await editor.getByRole('button', { name: '+ Thêm sản phẩm' }).click({ force: true });
      await selectOption(editor, 'Chọn sản phẩm hư', f.names.water);
      await editor.getByRole('spinbutton', { name: 'Số lượng hư' }).fill('2');
      await editor.getByPlaceholder('Nhập ghi chú cho phiếu hàng hư').fill(`E2E damage ${f.run_id}`);
      const createResponse = keeper.page.waitForResponse((r) =>
        r.url().endsWith('/api/damage-reports') && r.request().method() === 'POST');
      await editor.getByRole('button', { name: /Lưu|Gửi|Tạo phiếu/ }).last().click({ force: true });
      const created = await createResponse;
      expect(created.status(), await created.text()).toBe(201);
      const reportId = (await created.json()).report.id;
      const pendingStock = await apiAs(request, 'keeper', 'get',
        `/products/${f.products.water}?warehouse_id=${f.warehouses.central}`);
      expect((await pendingStock.json()).product.available_stock).toBe(28);
      expect((await apiAs(request, 'keeper', 'patch',
        `/damage-reports/${reportId}/approve`, {})).status()).toBe(403);

      await manager.page.goto(`${UI}/damage-reports`, { waitUntil: 'domcontentloaded' });
      const row = manager.page.getByRole('row').filter({ hasText: `E2E damage ${f.run_id}` });
      await expect(row).toBeVisible();
      await row.click({ force: true });
      await manager.page.getByRole('dialog').last().getByRole('button', { name: 'Duyệt phiếu' }).click({ force: true });
      await manager.page.getByRole('dialog', { name: 'Duyệt phiếu hàng hư?' })
        .getByRole('button', { name: 'Duyệt phiếu' }).click({ force: true });
      const approvedStock = await apiAs(request, 'keeper', 'get',
        `/products/${f.products.water}?warehouse_id=${f.warehouses.central}`);
      expect((await approvedStock.json()).product.available_stock).toBe(28);
      expect((await apiAs(request, 'manager', 'patch',
        `/damage-reports/${reportId}/approve`, {})).status()).toBe(400);
    } finally {
      await keeper.context.close();
      await manager.context.close();
    }
  });
});

test.describe('J. Báo cáo, tìm kiếm và phân trang', () => {
  test('lọc sản phẩm và chuyển trang có total đúng', async ({ browser, request }, testInfo) => {
    const f = fixture();
    const prefix = `Trang E2E ${f.run_id.slice(0, 8)} ${testInfo.workerIndex}`;
    for (let index = 0; index < 12; index += 1) {
      await createProduct(request, `${prefix} ${String(index).padStart(2, '0')}`, 1000);
    }
    const firstResponse = await apiAs(request, 'manager', 'get',
      `/products/inventory?keyword=${encodeURIComponent(prefix)}&page=1&per_page=10`);
    const first = await firstResponse.json();
    expect(first.pagination.total).toBe(12);
    expect(first.products).toHaveLength(10);
    const secondResponse = await apiAs(request, 'manager', 'get',
      `/products/inventory?keyword=${encodeURIComponent(prefix)}&page=2&per_page=10`);
    const second = await secondResponse.json();
    expect(second.products).toHaveLength(2);
    expect(new Set([...first.products, ...second.products].map((row) => row.id)).size).toBe(12);

    const { context, page } = await asRole(browser, 'manager');
    try {
      await page.goto(`${UI}/products`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('searchbox', { name: 'Tìm kiếm sản phẩm' })
        .fill(prefix);
      await page.getByRole('button', { name: 'Tìm kiếm' }).click({ force: true });
      await expect(page.getByRole('button', { name: new RegExp(`Xem chi tiết ${prefix}`) }))
        .toHaveCount(10);
      await page.getByLabel('Phân trang').getByRole('button', { name: /Sau/ }).click({ force: true });
      await expect(page.getByRole('button', { name: new RegExp(`Xem chi tiết ${prefix}`) }))
        .toHaveCount(2);
    } finally {
      await context.close();
    }
  });
});

