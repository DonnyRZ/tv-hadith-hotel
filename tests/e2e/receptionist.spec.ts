import { expect, test, type Page, type Route } from '@playwright/test';

const API_PREFIX = '**/api/v1';

async function installReceptionistMocks(page: Page) {
  await page.route(`${API_PREFIX}/auth/me`, (route: Route) => route.fulfill({ status: 401 }));
  await page.route(`${API_PREFIX}/auth/staff/login`, async (route: Route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        user: {
          id: '00000000-0000-4000-8000-000000000040',
          displayName: 'Receptionist E2E',
          roles: ['RECEPTIONIST'],
          permissions: [
            'receptionist:rooms:view',
            'receptionist:guest:assign',
            'receptionist:guest:update',
            'receptionist:guest:checkout',
            'receptionist:tv:pair',
          ],
        },
      }),
    });
  });
  await page.route(`${API_PREFIX}/receptionist/rooms*`, async (route: Route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            room: { id: '00000000-0000-4000-8000-000000000041', number: '305' },
            roomStatus: 'VACANT',
            activeAssignment: null,
          },
        ],
        page: 1,
        pageSize: 100,
        total: 1,
      }),
    });
  });
  await page.route(`${API_PREFIX}/department/requests*`, async (route: Route) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ items: [], page: 1, pageSize: 100, total: 0 }),
    });
  });
}

test.describe('Receptionist workspace navigation', () => {
  test('keeps one shell, orders Room before Housekeeping, and switches content immediately', async ({
    page,
  }) => {
    await installReceptionistMocks(page);
    await page.goto('http://127.0.0.1:4174/');
    await page.locator('#staff-email').fill('receptionist@example.com');
    await page.locator('#staff-password').fill('test-password');
    await page.getByRole('button', { name: 'Kirish', exact: true }).click();

    const navigation = page.locator('nav[aria-label="Asosiy navigatsiya"]');
    await expect(navigation).toBeVisible();
    await expect(navigation.locator('button')).toHaveText(['Xonalar', 'Housekeeping']);
    await expect(page.getByRole('region', { name: 'Xonalar', exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Housekeeping', exact: true }).click();
    await expect(page).toHaveURL(/\/housekeeping\/requests$/);
    await expect(navigation).toBeVisible();
    await expect(navigation.locator('button')).toHaveText(['Xonalar', 'Housekeeping']);
    await expect(page.getByRole('heading', { name: /Housekeeping/ })).toBeVisible();
    await expect(page.locator('.admin-shell')).toHaveCount(1);
    await expect(page.locator('.operational-dashboard--embedded')).toBeVisible();
    await expect(
      page.locator('.receptionist-view-panel:not([hidden]) .admin-loading-state'),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Xonalar', exact: true }).click();
    await expect(page).toHaveURL(/\/receptionist\/rooms$/);
    await expect(page.getByRole('region', { name: 'Xonalar', exact: true })).toBeVisible();
    await expect(
      page.locator('.receptionist-view-panel:not([hidden]) .admin-loading-state'),
    ).toHaveCount(0);
  });
});
