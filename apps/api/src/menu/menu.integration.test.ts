import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApplication } from '../main';

describe('Menu and service CMS API', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.AUTH_STORE = 'memory';
    process.env.SESSION_STORE = 'memory';
    process.env.SESSION_SECRET = 'menu-test-session-secret-that-is-long-enough';

    app = await createApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  async function login(email: string, password: string) {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/api/v1/auth/staff/login').send({ email, password }).expect(200);
    return agent;
  }

  it('seeds the flat Cafe menu from menu.md and keeps the unit scoped', async () => {
    const cafe = await login('cafe@hadith-hotel.com', 'password');

    const items = await cafe
      .get('/api/v1/management/menu-items')
      .query({ unit: 'CAFE', includeInactive: true, page: 1, pageSize: 100 })
      .expect(200);

    expect(items.body).toMatchObject({ page: 1, pageSize: 100, total: 64 });
    expect(items.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          unit: 'CAFE',
          name: 'Iced Americano',
          sortOrder: 0,
        }),
        expect.objectContaining({
          unit: 'CAFE',
          name: 'Chocolate Bomboloni',
          sortOrder: expect.any(Number),
        }),
      ]),
    );
    for (const item of items.body.items) {
      expect(item).not.toHaveProperty('category');
      expect(item).not.toHaveProperty('categoryId');
    }

    await cafe
      .get('/api/v1/management/menu-items')
      .query({ unit: 'RESTAURANT', includeInactive: true })
      .expect(403);
  });

  it('supports Cafe menu item lifecycle actions', async () => {
    const cafe = await login('cafe@hadith-hotel.com', 'password');

    const item = await cafe
      .post('/api/v1/management/menu-items')
      .send({
        unit: 'CAFE',
        kind: 'PRODUCT',
        localizedName: {
          uz: 'API Test Drink',
          ru: 'API Test Drink',
          en: 'API Test Drink',
        },
        price: 25000,
        currency: 'usd',
        available: true,
        quantityAllowed: true,
        sortOrder: 90,
      })
      .expect(201);
    expect(item.body).toMatchObject({
      unit: 'CAFE',
      name: 'API Test Drink',
      price: 25000,
      currency: 'USD',
      sortOrder: 90,
      active: true,
      available: true,
    });
    expect(item.body).not.toHaveProperty('category');

    await cafe
      .post('/api/v1/management/menu-items')
      .send({
        unit: 'CAFE',
        kind: 'PRODUCT',
        localizedName: { uz: 'API Test Drink', ru: 'API Test Drink', en: 'API Test Drink' },
      })
      .expect(409);

    const updated = await cafe
      .patch(`/api/v1/management/menu-items/${item.body.id}`)
      .send({
        available: false,
        localizedName: {
          uz: 'API Test Drink Updated',
          ru: 'API Test Drink Updated',
          en: 'API Test Drink Updated',
        },
      })
      .expect(200);
    expect(updated.body).toMatchObject({ name: 'API Test Drink Updated', available: false });

    const deactivated = await cafe
      .post(`/api/v1/management/menu-items/${item.body.id}/deactivate`)
      .expect(200);
    expect(deactivated.body.active).toBe(false);

    const reactivated = await cafe
      .post(`/api/v1/management/menu-items/${item.body.id}/activate`)
      .expect(200);
    expect(reactivated.body.active).toBe(true);
  });

  it('seeds each approved catalog without categories and keeps every unit scoped', async () => {
    const restaurant = await login('restaurant@hadith-hotel.com', 'password');
    const lounge = await login('lounge@hadith-hotel.com', 'password');
    const spa = await login('spa@hadith-hotel.com', 'password');
    const beauty = await login('beauty-and-salon@hadith-hotel.com', 'password');

    const restaurantItems = await restaurant
      .get('/api/v1/management/menu-items')
      .query({ unit: 'RESTAURANT', includeInactive: true, page: 1, pageSize: 100 })
      .expect(200);
    expect(restaurantItems.body.total).toBe(18);
    expect(restaurantItems.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          unit: 'RESTAURANT',
          kind: 'PRODUCT',
          name: 'Nasi Goreng',
          sortOrder: 0,
        }),
      ]),
    );

    const loungeItems = await lounge
      .get('/api/v1/management/menu-items')
      .query({ unit: 'LOUNGE', includeInactive: true, page: 1, pageSize: 100 })
      .expect(200);
    expect(loungeItems.body).toMatchObject({ items: [], total: 0 });

    for (const [agent, unit, expectedCount] of [
      [spa, 'SPA', 11],
      [beauty, 'BEAUTY_AND_SALON', 11],
    ] as const) {
      const response = await agent
        .get('/api/v1/management/menu-items')
        .query({ unit, includeInactive: true, page: 1, pageSize: 100 })
        .expect(200);
      expect(response.body.total).toBe(expectedCount);
      expect(
        response.body.items.every(
          (item: { unit: string; kind: string }) => item.unit === unit && item.kind === 'SERVICE',
        ),
      ).toBe(true);
    }

    await restaurant
      .get('/api/v1/management/menu-items')
      .query({ unit: 'LOUNGE', includeInactive: true })
      .expect(403);
    await spa
      .get('/api/v1/management/menu-items')
      .query({ unit: 'BEAUTY_AND_SALON', includeInactive: true })
      .expect(403);
  });

  it('supports service catalog lifecycle actions', async () => {
    const spa = await login('spa@hadith-hotel.com', 'password');

    const item = await spa
      .post('/api/v1/management/menu-items')
      .send({
        unit: 'SPA',
        kind: 'SERVICE',
        localizedName: {
          uz: 'API Test Spa Service',
          ru: 'API Test Spa Service',
          en: 'API Test Spa Service',
        },
        price: 450000,
        currency: 'uzs',
        durationMinutes: 60,
        available: true,
        quantityAllowed: false,
        sortOrder: 90,
      })
      .expect(201);
    expect(item.body).toMatchObject({
      unit: 'SPA',
      kind: 'SERVICE',
      name: 'API Test Spa Service',
      price: 450000,
      currency: 'UZS',
      durationMinutes: 60,
      active: true,
      available: true,
      quantityAllowed: false,
    });
    expect(item.body).not.toHaveProperty('category');

    const updated = await spa
      .patch(`/api/v1/management/menu-items/${item.body.id}`)
      .send({
        durationMinutes: 90,
        available: false,
        localizedName: {
          uz: 'API Test Spa Service Updated',
          ru: 'API Test Spa Service Updated',
          en: 'API Test Spa Service Updated',
        },
        quantityAllowed: true,
      })
      .expect(200);
    expect(updated.body).toMatchObject({
      name: 'API Test Spa Service Updated',
      durationMinutes: 90,
      available: false,
      quantityAllowed: false,
    });

    await spa
      .post('/api/v1/management/menu-items')
      .send({
        unit: 'SPA',
        kind: 'PRODUCT',
        localizedName: {
          uz: 'Invalid SPA Product',
          ru: 'Invalid SPA Product',
          en: 'Invalid SPA Product',
        },
      })
      .expect(400);
  });

  it('rejects menu management for staff without the menu permission', async () => {
    const receptionist = await login('receptionist@hadith-hotel.com', 'password');
    await receptionist.get('/api/v1/management/menu-items').expect(403);
  });
});
