import { expect, test, type Page, type Route } from '@playwright/test';

async function installGuestMocks(page: Page) {
  await page.route('**/api/v1/guest/context*', (route: Route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        room: { id: '00000000-0000-4000-8000-000000000010', number: '305' },
        roomStatus: 'OCCUPIED',
        welcome: {
          message: 'Welcome, Gallery Guest',
          guestName: 'Gallery Guest',
          personalized: true,
        },
        stay: {
          checkInAt: '2026-08-31T07:00:00.000Z',
          checkOutAt: '2026-09-03T07:00:00.000Z',
          totalDays: 3,
          timeZone: 'Asia/Tashkent',
        },
        availableUnits: [],
      }),
    }),
  );
  await page.route('**/api/v1/guest/departments*', (route: Route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ items: [] }),
    }),
  );
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1))
    .toBe(true);
}

test.describe('Guest About galleries', () => {
  test('opens curated stay, taste, and wellness galleries', async ({ page }) => {
    await installGuestMocks(page);
    await page.goto('/?access_token=gallery-test');

    await expect(page.locator('.welcome-block')).toBeVisible();
    await page.locator('.home-action').nth(1).click();
    await expect(page).toHaveURL(/#about$/);
    await expect(page.locator('.about-feature')).toHaveCount(3);

    await page.locator('.about-feature').nth(0).click();
    await expect(page).toHaveURL(/#about\/stay$/);
    await expect(page.locator('.gallery-room-tab')).toHaveCount(4);
    await expect(page.locator('.gallery-thumb')).toHaveCount(0);
    await expect(page.locator('.gallery-stage-image')).toHaveAttribute(
      'src',
      /junior-suite-01\.webp$/,
    );
    await expectNoHorizontalOverflow(page);
    await page.locator('.gallery-stage-trigger').focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.gallery-stage-image')).toHaveAttribute(
      'src',
      /junior-suite-02\.webp$/,
    );
    await page.locator('.gallery-stage-trigger').click();
    await expect(page.locator('.gallery-lightbox')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.gallery-lightbox')).toHaveCount(0);
    await page.locator('.gallery-room-tab').nth(0).click();
    await expect(page.locator('.gallery-stage-image')).toHaveAttribute('src', /standard-01\.webp$/);
    await expect(page.locator('.gallery-stage-nav')).toHaveCount(2);
    await page.locator('.gallery-room-tab').nth(1).click();
    await expect(page.locator('.gallery-stage-image')).toHaveAttribute('src', /balcony-01\.webp$/);
    await expect(page.locator('.gallery-counter')).toHaveText('01 / 01');
    await expect(page.locator('.gallery-stage-nav')).toHaveCount(0);
    await page.locator('.gallery-room-tab').nth(2).click();
    await expect(page.locator('.gallery-stage-image')).toHaveAttribute('src', /suite-01\.webp$/);
    await page.locator('.gallery-room-tab').nth(3).click();
    await expect(page.locator('.gallery-stage-image')).toHaveAttribute(
      'src',
      /junior-suite-01\.webp$/,
    );

    await page.locator('.back-link').click();
    await page.locator('.about-feature').nth(1).click();
    await expect(page).toHaveURL(/#about\/taste\/saji$/);
    await expect(page.locator('.gallery-thumb')).toHaveCount(0);
    await expect(page.locator('.gallery-stage-image')).toHaveAttribute('src', /nasi-goreng\.webp$/);
    await expect(page.locator('.gallery-stage-nav')).toHaveCount(2);
    await page.locator('.gallery-brand-tab').nth(1).click();
    await expect(page).toHaveURL(/#about\/taste\/7oz$/);
    await expect(page.locator('.gallery-thumb')).toHaveCount(0);
    await expect(page.locator('.gallery-stage-image')).toHaveAttribute('src', /berrypresso\.webp$/);
    await expect(page.locator('.gallery-stage-image')).not.toHaveAttribute('src', /menu-book/);

    await page.locator('.back-link').click();
    await page.locator('.about-feature').nth(2).click();
    await expect(page).toHaveURL(/#about\/rest$/);
    await expect(page.locator('.gallery-thumb')).toHaveCount(0);
    await expect(page.locator('.gallery-stage-image')).toHaveAttribute('src', /pool\.webp$/);
  });
});
