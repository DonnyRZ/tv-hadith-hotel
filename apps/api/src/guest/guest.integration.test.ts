import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApplication } from '../main';
import { RECEPTIONIST_ROOM_CATALOG, roomIdForNumber } from '../receptionist/receptionist.types';

type TestAgent = ReturnType<typeof request.agent>;

describe('guest context, catalog, and request API', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.AUTH_STORE = 'memory';
    process.env.SESSION_STORE = 'memory';
    process.env.SESSION_SECRET = 'guest-test-session-secret-that-is-long-enough';
    process.env.GUEST_WEB_URL = 'http://localhost:5173';

    app = await createApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  async function login(email: string) {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/api/v1/auth/staff/login').send({ email, password: 'password' }).expect(200);
    return agent;
  }

  async function issueGuestToken(receptionist: TestAgent, roomNumber: string) {
    const response = await receptionist
      .post(`/api/v1/receptionist/rooms/${roomIdForNumber(roomNumber)}/guest-access-token`)
      .expect(200);
    const url = new URL(response.body.qrUrl as string);
    const token = url.searchParams.get('access_token');
    expect(token).toEqual(expect.any(String));
    return token as string;
  }

  async function assignRoom(receptionist: TestAgent, roomNumber: string, guestName: string) {
    return receptionist
      .post(`/api/v1/receptionist/rooms/${roomIdForNumber(roomNumber)}/guest-assignment`)
      .send({ guestName, stayDays: 3 })
      .expect(201);
  }

  it('resolves QR context only for an occupied room and exposes configured catalog units', async () => {
    expect(RECEPTIONIST_ROOM_CATALOG).toHaveLength(114);
    expect(new Set(RECEPTIONIST_ROOM_CATALOG.map((room) => room.number)).size).toBe(114);

    const receptionist = await login('receptionist@hadith-hotel.com');
    const token = await issueGuestToken(receptionist, '201');

    await request(app.getHttpServer())
      .get('/api/v1/guest/context')
      .set('X-Guest-Access-Token', token)
      .expect(404);

    await assignRoom(receptionist, '201', 'QR Guest');

    const context = await request(app.getHttpServer())
      .get('/api/v1/guest/context')
      .set('X-Guest-Access-Token', token)
      .expect(200);
    expect(context.headers['cache-control']).toContain('no-store');
    expect(context.body).toMatchObject({
      room: { number: '201' },
      roomStatus: 'OCCUPIED',
      welcome: { guestName: 'QR Guest', personalized: true },
    });
    expect(context.body.availableUnits).toEqual([
      'CAFE',
      'RESTAURANT',
      'SPA',
      'HOUSEKEEPING',
      'BEAUTY_AND_SALON',
    ]);

    const departments = await request(app.getHttpServer())
      .get('/api/v1/guest/departments')
      .set('X-Guest-Access-Token', token)
      .expect(200);
    const units = departments.body.items.flatMap(
      (department: { units: Array<Record<string, unknown>> }) => department.units,
    );
    expect(units).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'LOUNGE',
          enabled: false,
          disabledReason: 'MENU_NOT_CONFIGURED',
        }),
        expect.objectContaining({ code: 'HOUSEKEEPING', enabled: true }),
      ]),
    );

    const cafe = await request(app.getHttpServer())
      .get('/api/v1/guest/menus')
      .query({ unit: 'CAFE', page: 1, pageSize: 100 })
      .set('X-Guest-Access-Token', token)
      .expect(200);
    expect(cafe.body).toMatchObject({ total: 64, page: 1, pageSize: 100 });
    expect(
      cafe.body.items.every(
        (item: { active: boolean; available: boolean }) => item.active && item.available,
      ),
    ).toBe(true);
    for (const item of cafe.body.items) {
      expect(item.localizedName.uz).toEqual(expect.any(String));
      expect(item.localizedName.ru).toEqual(expect.any(String));
      expect(item.localizedName.en).toEqual(expect.any(String));
      expect(item.localizedName.uz.trim()).not.toBe('');
      expect(item.localizedName.ru.trim()).not.toBe('');
      expect(item.localizedName.en.trim()).not.toBe('');
      expect(item.price).toBeNull();
    }

    const housekeeping = await request(app.getHttpServer())
      .get('/api/v1/guest/menus')
      .query({ unit: 'HOUSEKEEPING', page: 1, pageSize: 100 })
      .set('X-Guest-Access-Token', token)
      .expect(200);
    expect(housekeeping.body.total).toBe(11);

    for (const [unit, total] of [
      ['RESTAURANT', 18],
      ['SPA', 11],
      ['BEAUTY_AND_SALON', 11],
    ] as const) {
      const catalog = await request(app.getHttpServer())
        .get('/api/v1/guest/menus')
        .query({ unit, page: 1, pageSize: 100 })
        .set('X-Guest-Access-Token', token)
        .expect(200);
      expect(catalog.body.total).toBe(total);
      for (const item of catalog.body.items) {
        expect(item.localizedName.uz.trim()).not.toBe('');
        expect(item.localizedName.ru.trim()).not.toBe('');
        expect(item.localizedName.en.trim()).not.toBe('');
      }
    }

    await request(app.getHttpServer())
      .get('/api/v1/guest/menus')
      .query({ unit: 'LOUNGE' })
      .set('X-Guest-Access-Token', token)
      .expect(404);

    await request(app.getHttpServer())
      .get('/api/v1/guest/context')
      .set('X-Guest-Access-Token', 'invalid-token')
      .expect(401);
  });

  it('creates one-unit requests, snapshots localization and price, and de-duplicates retries', async () => {
    const receptionist = await login('receptionist@hadith-hotel.com');
    const cafe = await login('cafe@hadith-hotel.com');
    const token = await issueGuestToken(receptionist, '202');
    await assignRoom(receptionist, '202', 'Request Guest');

    const cafeMenu = await request(app.getHttpServer())
      .get('/api/v1/guest/menus')
      .query({ unit: 'CAFE', page: 1, pageSize: 1 })
      .set('X-Guest-Access-Token', token)
      .expect(200);
    const cafeItem = cafeMenu.body.items[0] as {
      id: string;
      localizedName: { uz: string; ru: string; en: string };
    };

    const clientRequestId = randomUUID();
    const created = await request(app.getHttpServer())
      .post('/api/v1/guest/requests')
      .set('X-Guest-Access-Token', token)
      .send({
        clientRequestId,
        roomId: roomIdForNumber('999'),
        items: [{ menuItemId: cafeItem.id, quantity: 2, note: 'Less ice' }],
        guestNote: 'Please deliver quietly',
      })
      .expect(400);
    expect(created.body.code).toBe('VALIDATION_ERROR');

    const requestResponse = await request(app.getHttpServer())
      .post('/api/v1/guest/requests')
      .set('X-Guest-Access-Token', token)
      .send({
        clientRequestId,
        items: [{ menuItemId: cafeItem.id, quantity: 2, note: 'Less ice' }],
        guestNote: 'Please deliver quietly',
      })
      .expect(201);
    expect(requestResponse.body).toMatchObject({
      clientRequestId,
      unit: 'CAFE',
      department: 'CAFE',
      status: 'NEW',
      guestNote: 'Please deliver quietly',
    });
    expect(requestResponse.body).not.toHaveProperty('room');
    expect(requestResponse.body).not.toHaveProperty('guestAssignmentId');
    expect(requestResponse.body).not.toHaveProperty('total');
    expect(requestResponse.body.items[0]).toMatchObject({
      quantity: 2,
      note: 'Less ice',
      localizedName: cafeItem.localizedName,
      unitPrice: null,
      currency: null,
    });
    expect(requestResponse.body.items[0]).not.toHaveProperty('lineTotal');

    const retry = await request(app.getHttpServer())
      .post('/api/v1/guest/requests')
      .set('X-Guest-Access-Token', token)
      .send({
        clientRequestId,
        items: [{ menuItemId: cafeItem.id, quantity: 2 }],
      })
      .expect(201);
    expect(retry.body.id).toBe(requestResponse.body.id);

    const restaurantMenu = await request(app.getHttpServer())
      .get('/api/v1/guest/menus')
      .query({ unit: 'RESTAURANT', page: 1, pageSize: 1 })
      .set('X-Guest-Access-Token', token)
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/v1/guest/requests')
      .set('X-Guest-Access-Token', token)
      .send({
        clientRequestId: randomUUID(),
        items: [
          { menuItemId: cafeItem.id, quantity: 1 },
          { menuItemId: restaurantMenu.body.items[0].id, quantity: 1 },
        ],
      })
      .expect(409);

    const spaMenu = await request(app.getHttpServer())
      .get('/api/v1/guest/menus')
      .query({ unit: 'SPA', page: 1, pageSize: 1 })
      .set('X-Guest-Access-Token', token)
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/v1/guest/requests')
      .set('X-Guest-Access-Token', token)
      .send({
        clientRequestId: randomUUID(),
        items: [{ menuItemId: spaMenu.body.items[0].id, quantity: 2 }],
      })
      .expect(400);

    const dynamicItem = await cafe
      .post('/api/v1/management/menu-items')
      .send({
        unit: 'CAFE',
        kind: 'PRODUCT',
        localizedName: {
          uz: 'Dynamic Guest Item',
          ru: 'Динамическая позиция',
          en: 'Dynamic Guest Item',
        },
        price: null,
        available: true,
        quantityAllowed: true,
        sortOrder: 99,
      })
      .expect(201);

    await cafe
      .patch(`/api/v1/management/menu-items/${dynamicItem.body.id}`)
      .send({ price: 42000, currency: 'UZS' })
      .expect(200);
    const dynamicMenuItem = await request(app.getHttpServer())
      .get(`/api/v1/guest/menus/${dynamicItem.body.id}`)
      .set('X-Guest-Access-Token', token)
      .expect(200);
    expect(dynamicMenuItem.body).toMatchObject({ price: 42000, currency: 'UZS' });

    await cafe
      .patch(`/api/v1/management/menu-items/${dynamicItem.body.id}`)
      .send({ quantityAllowed: false })
      .expect(200);
    const invalidQuantity = await request(app.getHttpServer())
      .post('/api/v1/guest/requests')
      .set('X-Guest-Access-Token', token)
      .send({
        clientRequestId: randomUUID(),
        items: [{ menuItemId: dynamicItem.body.id, quantity: 2 }],
      })
      .expect(400);
    expect(invalidQuantity.body.code).toBe('PRODUCT_QUANTITY_INVALID');

    await cafe.post(`/api/v1/management/menu-items/${dynamicItem.body.id}/deactivate`).expect(200);
    await request(app.getHttpServer())
      .get(`/api/v1/guest/menus/${dynamicItem.body.id}`)
      .set('X-Guest-Access-Token', token)
      .expect(404);

    const queue = await cafe
      .get('/api/v1/department/requests')
      .query({ unit: 'CAFE', room: '202', page: 1, pageSize: 10 })
      .expect(200);
    expect(queue.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: requestResponse.body.id, status: 'NEW' }),
      ]),
    );
  });

  it('isolates requests by the active assignment and invalidates the QR token on revoke', async () => {
    const receptionist = await login('receptionist@hadith-hotel.com');
    const token = await issueGuestToken(receptionist, '203');
    const firstAssignment = await assignRoom(receptionist, '203', 'First Guest');

    const cafeMenu = await request(app.getHttpServer())
      .get('/api/v1/guest/menus')
      .query({ unit: 'CAFE', page: 1, pageSize: 1 })
      .set('X-Guest-Access-Token', token)
      .expect(200);
    const oldRequest = await request(app.getHttpServer())
      .post('/api/v1/guest/requests')
      .set('X-Guest-Access-Token', token)
      .send({
        clientRequestId: randomUUID(),
        items: [{ menuItemId: cafeMenu.body.items[0].id, quantity: 1 }],
      })
      .expect(201);

    await receptionist
      .post(`/api/v1/receptionist/guest-assignments/${firstAssignment.body.id}/checkout`)
      .expect(200);
    await assignRoom(receptionist, '203', 'Second Guest');

    const currentContext = await request(app.getHttpServer())
      .get('/api/v1/guest/context')
      .set('X-Guest-Access-Token', token)
      .expect(200);
    expect(currentContext.body.welcome.guestName).toBe('Second Guest');

    const currentRequests = await request(app.getHttpServer())
      .get('/api/v1/guest/requests')
      .set('X-Guest-Access-Token', token)
      .expect(200);
    expect(currentRequests.body).toMatchObject({ total: 0, items: [] });

    await request(app.getHttpServer())
      .get(`/api/v1/guest/requests/${oldRequest.body.id}`)
      .set('X-Guest-Access-Token', token)
      .expect(404);

    await receptionist
      .post(`/api/v1/receptionist/rooms/${roomIdForNumber('203')}/guest-access-token/revoke`)
      .expect(200);
    await request(app.getHttpServer())
      .get('/api/v1/guest/context')
      .set('X-Guest-Access-Token', token)
      .expect(401);
  });
});
