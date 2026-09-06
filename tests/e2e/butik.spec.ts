import { expect, test, type Page, type Route } from '@playwright/test';

const API_PREFIX = '**/api/v1';
const categoryId = '00000000-0000-4000-8000-000000000001';
const menuItemId = '00000000-0000-4000-8000-000000000002';
const variantId = '00000000-0000-4000-8000-000000000003';
const requestId = '00000000-0000-4000-8000-000000000004';
const clientRequestId = '00000000-0000-4000-8000-000000000005';
const timestamp = '2026-08-31T11:00:00.000Z';

function localized(uz: string, ru: string, en: string) {
  return { uz, ru, en };
}

const category = {
  id: categoryId,
  localizedName: localized('Aksessuarlar', 'Аксессуары', 'Accessories'),
  localizedDescription: localized(
    'Indoneziya aksessuarlari',
    'Индонезийские аксессуары',
    'Indonesian accessories',
  ),
  imageMediaId: null,
  active: true,
  sortOrder: 0,
  createdAt: timestamp,
  updatedAt: timestamp,
};

const variant = {
  id: variantId,
  menuItemId,
  sku: 'BATIK-OS',
  options: [
    {
      code: 'size',
      label: localized('O‘lcham', 'Размер', 'Size'),
      value: localized('Yagona o‘lcham', 'Один размер', 'One size'),
    },
  ],
  price: 125000,
  currency: 'IDR',
  active: true,
  stockOnHand: 4,
  reservedQuantity: 0,
  availableQuantity: 4,
  sortOrder: 0,
  createdAt: timestamp,
  updatedAt: timestamp,
};

const menuItem = {
  id: menuItemId,
  unit: 'BUTIK_INDONESIA',
  kind: 'PRODUCT',
  name: 'Selendang Batik',
  localizedName: localized('Batik sharf', 'Батиковый шарф', 'Batik scarf'),
  description: 'A hand-finished batik scarf.',
  localizedDescription: localized(
    'Qo‘lda ishlangan batik sharf.',
    'Шарф из батика ручной работы.',
    'A hand-finished batik scarf.',
  ),
  price: variant.price,
  currency: variant.currency,
  durationMinutes: null,
  imageMediaId: null,
  active: true,
  available: true,
  quantityAllowed: true,
  sortOrder: 0,
  createdAt: timestamp,
  updatedAt: timestamp,
  categoryId,
  category,
  variants: [variant],
};

function requestItem() {
  return {
    menuItemId,
    unit: 'BUTIK_INDONESIA',
    kind: 'PRODUCT',
    name: menuItem.name,
    localizedName: menuItem.localizedName,
    quantity: 1,
    note: null,
    unitPrice: variant.price,
    currency: variant.currency,
    variantId,
    sku: variant.sku,
    variantOptions: variant.options,
  };
}

function guestRequest() {
  return {
    id: requestId,
    clientRequestId,
    department: 'BUTIK_INDONESIA',
    unit: 'BUTIK_INDONESIA',
    items: [requestItem()],
    guestNote: null,
    status: 'NEW',
    requestedAt: timestamp,
    confirmedAt: null,
    completedAt: null,
    reservationExpiresAt: '2026-08-31T11:30:00.000Z',
    cancelledAt: null,
    cancellationReason: null,
    cancellationSource: null,
    statusHistory: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

async function installGuestMocks(page: Page) {
  let submitted = false;
  let submittedBody: { items?: Array<{ variantId?: string }> } | undefined;

  await page.route(`${API_PREFIX}/guest/context`, (route: Route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        room: { id: '00000000-0000-4000-8000-000000000010', number: '305' },
        roomStatus: 'OCCUPIED',
        welcome: { message: 'Welcome, E2E Guest', guestName: 'E2E Guest', personalized: true },
        stay: {
          checkInAt: '2026-08-31T07:00:00.000Z',
          checkOutAt: '2026-09-03T07:00:00.000Z',
          totalDays: 3,
          timeZone: 'Asia/Tashkent',
        },
        availableUnits: ['BUTIK_INDONESIA'],
      }),
    }),
  );
  await page.route(`${API_PREFIX}/guest/departments`, (route: Route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            code: 'BUTIK_INDONESIA',
            name: 'Butik Indonesia',
            units: [
              {
                code: 'BUTIK_INDONESIA',
                department: 'BUTIK_INDONESIA',
                name: 'Butik Indonesia',
                roomManagerMonitoring: false,
                enabled: true,
                disabledReason: null,
              },
            ],
          },
        ],
      }),
    }),
  );
  await page.route(`${API_PREFIX}/guest/menus*`, (route: Route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        items: [menuItem],
        categories: [category],
        page: 1,
        pageSize: 10,
        total: 1,
      }),
    }),
  );
  await page.route(`${API_PREFIX}/guest/requests*`, async (route: Route) => {
    if (route.request().method() === 'POST') {
      submitted = true;
      submittedBody = route.request().postDataJSON() as { items?: Array<{ variantId?: string }> };
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(guestRequest()),
      });
      return;
    }
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        items: submitted ? [guestRequest()] : [],
        page: 1,
        pageSize: 50,
        total: submitted ? 1 : 0,
      }),
    });
  });

  return {
    wasSubmitted: () => submitted,
    submittedBody: () => submittedBody,
  };
}

async function installStaffMocks(page: Page) {
  let orderStatus: 'NEW' | 'IN_PROCESS' | 'COMPLETED' | 'CANCELLED' = 'NEW';
  let uploaded = false;
  let stockAdjusted = false;

  await page.route(`${API_PREFIX}/auth/me`, (route: Route) => route.fulfill({ status: 401 }));
  await page.route(`${API_PREFIX}/auth/staff/login`, async (route: Route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        user: {
          id: '00000000-0000-4000-8000-000000000020',
          displayName: 'Butik Operator',
          roles: ['BUTIK_INDONESIA'],
          permissions: [
            'request:view',
            'request:confirm',
            'request:complete',
            'request:history',
            'request:cancel',
            'menu:manage',
            'inventory:manage',
            'media:manage',
          ],
        },
      }),
    });
  });
  await page.route(`${API_PREFIX}/department/requests*`, async (route: Route) => {
    const status = new URL(route.request().url()).searchParams.get('status');
    const items = status === orderStatus ? [staffOrder(orderStatus)] : [];
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ items, page: 1, pageSize: 100, total: items.length }),
    });
  });
  await page.route(
    `${API_PREFIX}/department/requests/${requestId}/confirm`,
    async (route: Route) => {
      orderStatus = 'IN_PROCESS';
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(staffOrder(orderStatus)),
      });
    },
  );
  await page.route(`${API_PREFIX}/department/requests/${requestId}/done`, async (route: Route) => {
    orderStatus = 'COMPLETED';
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(staffOrder(orderStatus)),
    });
  });
  await page.route(
    `${API_PREFIX}/department/requests/${requestId}/cancel`,
    async (route: Route) => {
      orderStatus = 'CANCELLED';
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(staffOrder(orderStatus)),
      });
    },
  );
  await page.route(`${API_PREFIX}/management/boutique/categories`, async (route: Route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ items: [category] }),
    });
  });
  await page.route(`${API_PREFIX}/management/boutique/products*`, async (route: Route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(staffProduct()),
      });
      return;
    }
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ items: [staffProduct()], page: 1, pageSize: 100, total: 1 }),
    });
  });
  await page.route(`${API_PREFIX}/media/upload`, async (route: Route) => {
    uploaded = true;
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        id: '00000000-0000-4000-8000-000000000030',
        contentType: 'image/png',
        sizeBytes: 4,
        createdAt: timestamp,
      }),
    });
  });
  await page.route(
    `${API_PREFIX}/management/boutique/variants/${variantId}/stock-adjustments`,
    async (route: Route) => {
      stockAdjusted = true;
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(variant) });
    },
  );
  return {
    wasUploaded: () => uploaded,
    wasStockAdjusted: () => stockAdjusted,
  };
}

function staffProduct() {
  return {
    item: menuItem,
    categoryId,
    category,
    variants: [variant],
  };
}

function staffOrder(status: 'NEW' | 'IN_PROCESS' | 'COMPLETED' | 'CANCELLED') {
  return {
    ...guestRequest(),
    room: { id: '00000000-0000-4000-8000-000000000010', number: '305' },
    guestName: 'E2E Guest',
    status,
    confirmedAt: status === 'NEW' ? null : timestamp,
    completedAt: status === 'COMPLETED' ? timestamp : null,
    cancelledAt: status === 'CANCELLED' ? timestamp : null,
    cancellationReason: status === 'CANCELLED' ? 'Guest changed the selection.' : null,
    cancellationSource: status === 'CANCELLED' ? 'STAFF' : null,
    statusHistory: [],
  };
}

async function signInAsButik(page: Page) {
  await page.goto('http://127.0.0.1:4174/');
  await page.locator('#staff-email').fill('butik@example.com');
  await page.locator('#staff-password').fill('test-password');
  await page.getByRole('button', { name: 'Kirish', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Buyurtmalar', exact: true }).first(),
  ).toBeVisible();
}

test.describe('Butik Indonesia guest flow', () => {
  test('guest can select a variant and submit a room request', async ({ page }) => {
    const mock = await installGuestMocks(page);

    await page.goto('/?access_token=e2e-guest');
    await expect(page.getByRole('heading', { name: 'Xush kelibsiz, E2E Guest' })).toBeVisible();
    await expect(page.locator('.stay-summary')).toContainText('305');
    await expect(page.locator('.stay-summary')).toContainText('Turar joyingiz');
    await expect(page.locator('.stay-summary')).toContainText('3 kunlik turar joy');
    await page.getByRole('button', { name: 'EN', exact: true }).click();
    await page.getByRole('button', { name: /01 Services/ }).click();
    await page.getByRole('button', { name: /Butik Indonesia/ }).click();
    await expect(page.getByRole('heading', { name: 'Butik Indonesia', exact: true })).toBeVisible();
    await expect(page.getByText('Accessories', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await page.getByRole('button', { name: /Request/ }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Submit request', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Request submitted', exact: true }),
    ).toBeVisible();
    expect(mock.wasSubmitted()).toBe(true);
    expect(mock.submittedBody()?.items?.[0]?.variantId).toBe(variantId);
  });
});

test.describe('Butik Indonesia staff flow', () => {
  test('operator can confirm and complete a room order', async ({ page }) => {
    await installStaffMocks(page);
    await signInAsButik(page);
    await expect(page.getByText('E2E Guest', { exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Ko‘rish', exact: true }).click();
    await page.getByRole('button', { name: 'Tasdiqlash', exact: true }).last().click();
    await page.getByRole('button', { name: 'Yakunlash', exact: true }).last().click();
    await expect(page.getByText('Yakunlangan', { exact: true }).first()).toBeVisible();
  });

  test('operator can cancel an order, upload media, and adjust stock', async ({ page }) => {
    const mock = await installStaffMocks(page);
    await signInAsButik(page);
    await page.getByRole('button', { name: 'Ko‘rish', exact: true }).click();
    await page.locator('#butik-cancel-reason').fill('Guest changed the selection.');
    await page.getByRole('button', { name: 'Bekor qilish', exact: true }).click();
    await expect(page.getByText('Bekor qilingan', { exact: true }).first()).toBeVisible();

    await page.getByRole('button', { name: 'Yopish', exact: true }).click();
    await page.getByRole('button', { name: 'Katalog', exact: true }).click();
    const productAdd = page.getByRole('button', { name: /Mahsulot qo‘shish/ });
    await productAdd.scrollIntoViewIfNeeded();
    await productAdd.click();
    await expect(page.locator('.butik-product-drawer')).toBeVisible();
    await expect(page.locator('.butik-product-drawer')).not.toContainText('JSON');
    await expect(
      page.locator('.butik-product-drawer').getByText('UZ', { exact: true }),
    ).toHaveCount(0);
    await expect(
      page.locator('.butik-product-drawer').getByText('RU', { exact: true }),
    ).toHaveCount(0);
    await expect(
      page.locator('.butik-product-drawer').getByText('EN', { exact: true }),
    ).toHaveCount(0);
    await page.locator('.butik-file-field input[type="file"]').setInputFiles({
      name: 'catalog.png',
      mimeType: 'image/png',
      buffer: Buffer.from([137, 80, 78, 71]),
    });
    await page.getByLabel(/Mahsulot nomi/).fill('Selendang Batik');
    await page.locator('.butik-product-drawer select').selectOption(categoryId);
    await page.getByLabel('SKU', { exact: true }).fill('BATIK-E2E');
    await page.getByLabel('Narx', { exact: true }).fill('125000');
    expect(mock.wasUploaded()).toBe(false);
    await page.getByRole('button', { name: 'Yaratish', exact: true }).last().click();
    await expect.poll(mock.wasUploaded).toBe(true);
    await page.getByRole('button', { name: 'Stokni o‘zgartirish', exact: true }).click();
    await page.getByLabel(/O‘zgarish/).fill('1');
    await page.getByLabel(/Sabab/).fill('E2E delivery');
    await page.getByRole('button', { name: 'Qo‘llash', exact: true }).click();
    await expect.poll(mock.wasStockAdjusted).toBe(true);
  });
});
