import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApplication } from '../main';
import { roomIdForNumber } from '../receptionist/receptionist.types';

type TestAgent = ReturnType<typeof request.agent>;

const localized = (value: string) => ({
  uz: value,
  ru: value,
  en: value,
});

describe('Butik Indonesia catalog and order API', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.AUTH_STORE = 'memory';
    process.env.SESSION_STORE = 'memory';
    process.env.SESSION_SECRET = 'butik-test-session-secret-that-is-long-enough';
    process.env.GUEST_WEB_URL = 'http://localhost:5173';
    process.env.INTERNAL_WORKER_SECRET = 'butik-test-internal-worker-secret';

    app = await createApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  async function login(email: string, password = 'password'): Promise<TestAgent> {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/api/v1/auth/staff/login').send({ email, password }).expect(200);
    return agent;
  }

  async function issueGuestToken(receptionist: TestAgent, roomNumber: string): Promise<string> {
    const response = await receptionist
      .post(`/api/v1/receptionist/rooms/${roomIdForNumber(roomNumber)}/guest-access-token`)
      .expect(200);
    const url = new URL(response.body.qrUrl as string);
    const token = url.searchParams.get('access_token');
    expect(token).toEqual(expect.any(String));
    return token as string;
  }

  it('keeps the catalog scoped, exposes variants to guests, and maintains stock through the order lifecycle', async () => {
    const superadmin = await login('superadmin@hadith-hotel.com');
    const staffEmail = `butik-${randomUUID()}@hadith-hotel.com`;
    const createdStaff = await superadmin
      .post('/api/v1/management/users')
      .send({
        email: staffEmail,
        displayName: 'Butik Indonesia Test',
        roles: ['BUTIK_INDONESIA'],
        password: 'butik-password-123',
      })
      .expect(201);
    expect(createdStaff.body).toMatchObject({ roles: ['BUTIK_INDONESIA'], active: true });

    const butik = await login(staffEmail, 'butik-password-123');
    const receptionist = await login('receptionist@hadith-hotel.com');
    const roomManager = await login('room-manager@hadith-hotel.com');

    await request(app.getHttpServer())
      .post('/api/v1/internal/boutique/reservations/expire')
      .expect(403);
    const expiryRun = await request(app.getHttpServer())
      .post('/api/v1/internal/boutique/reservations/expire')
      .set('X-Internal-Worker-Secret', 'butik-test-internal-worker-secret')
      .expect(200);
    expect(expiryRun.body.expired).toBeTypeOf('number');

    await receptionist.get('/api/v1/management/boutique/categories').expect(403);
    await roomManager.get('/api/v1/management/boutique/categories').expect(403);
    await superadmin
      .get('/api/v1/department/requests')
      .query({ unit: 'BUTIK_INDONESIA' })
      .expect(403);

    const category = await butik
      .post('/api/v1/management/boutique/categories')
      .send({
        localizedName: localized('Test Accessories'),
        localizedDescription: localized('Products for an API test.'),
      })
      .expect(201);
    const product = await butik
      .post('/api/v1/management/boutique/products')
      .send({
        localizedName: localized('Test Batik Shawl'),
        localizedDescription: localized('A test product with a flexible variant.'),
        categoryId: category.body.id,
        available: true,
        variants: [
          {
            sku: 'TEST-BATIK-OS',
            options: [
              {
                code: 'size',
                label: localized('Size'),
                value: localized('One size'),
              },
            ],
            price: 125000,
            currency: 'IDR',
            stockOnHand: 2,
          },
        ],
      })
      .expect(201);
    const variantId = product.body.variants[0].id as string;
    expect(product.body).toMatchObject({
      categoryId: category.body.id,
      item: { unit: 'BUTIK_INDONESIA', kind: 'PRODUCT' },
      variants: [{ sku: 'TEST-BATIK-OS', availableQuantity: 2 }],
    });

    const productList = await butik.get('/api/v1/management/boutique/products').expect(200);
    expect(productList.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ item: expect.objectContaining({ id: product.body.item.id }) }),
      ]),
    );

    const roomNumber = '208';
    const token = await issueGuestToken(receptionist, roomNumber);
    await receptionist
      .post(`/api/v1/receptionist/rooms/${roomIdForNumber(roomNumber)}/guest-assignment`)
      .send({ guestName: 'Butik Guest', stayDays: 2 })
      .expect(201);

    const context = await request(app.getHttpServer())
      .get('/api/v1/guest/context')
      .set('X-Guest-Access-Token', token)
      .expect(200);
    expect(context.body.availableUnits).toContain('BUTIK_INDONESIA');

    const menu = await request(app.getHttpServer())
      .get('/api/v1/guest/menus')
      .query({ unit: 'BUTIK_INDONESIA', categoryId: category.body.id })
      .set('X-Guest-Access-Token', token)
      .expect(200);
    expect(menu.body.items).toEqual([
      expect.objectContaining({
        id: product.body.item.id,
        categoryId: category.body.id,
        variants: [
          expect.objectContaining({ id: variantId, sku: 'TEST-BATIK-OS', availableQuantity: 2 }),
        ],
      }),
    ]);

    const firstClientRequestId = randomUUID();
    const firstOrder = await request(app.getHttpServer())
      .post('/api/v1/guest/requests')
      .set('X-Guest-Access-Token', token)
      .send({
        clientRequestId: firstClientRequestId,
        items: [{ menuItemId: product.body.item.id, variantId, quantity: 1 }],
      })
      .expect(201);
    expect(firstOrder.body).toMatchObject({
      unit: 'BUTIK_INDONESIA',
      status: 'NEW',
      reservationExpiresAt: expect.any(String),
      items: [{ variantId, sku: 'TEST-BATIK-OS', unitPrice: 125000, quantity: 1 }],
    });
    expect(firstOrder.body).not.toHaveProperty('guestName');

    const internalOrder = await butik
      .get(`/api/v1/department/requests/${firstOrder.body.id}`)
      .expect(200);
    expect(internalOrder.body).toMatchObject({
      room: { number: roomNumber },
      guestName: 'Butik Guest',
    });

    const retry = await request(app.getHttpServer())
      .post('/api/v1/guest/requests')
      .set('X-Guest-Access-Token', token)
      .send({
        clientRequestId: firstClientRequestId,
        items: [{ menuItemId: product.body.item.id, variantId, quantity: 1 }],
      })
      .expect(201);
    expect(retry.body.id).toBe(firstOrder.body.id);

    await request(app.getHttpServer())
      .post('/api/v1/guest/requests')
      .set('X-Guest-Access-Token', token)
      .send({
        clientRequestId: randomUUID(),
        items: [{ menuItemId: product.body.item.id, variantId, quantity: 2 }],
      })
      .expect(409);

    const cancelled = await butik
      .post(`/api/v1/department/requests/${firstOrder.body.id}/cancel`)
      .send({ reason: 'Guest selected another item.' })
      .expect(200);
    expect(cancelled.body).toMatchObject({
      status: 'CANCELLED',
      cancellationReason: 'Guest selected another item.',
      cancellationSource: 'STAFF',
      cancelledAt: expect.any(String),
    });

    const secondOrder = await request(app.getHttpServer())
      .post('/api/v1/guest/requests')
      .set('X-Guest-Access-Token', token)
      .send({
        clientRequestId: randomUUID(),
        items: [{ menuItemId: product.body.item.id, variantId, quantity: 2 }],
      })
      .expect(201);
    await butik.post(`/api/v1/department/requests/${secondOrder.body.id}/confirm`).expect(200);
    const completed = await butik
      .post(`/api/v1/department/requests/${secondOrder.body.id}/done`)
      .expect(200);
    expect(completed.body.status).toBe('COMPLETED');

    const finalProduct = await butik
      .get(`/api/v1/management/boutique/products/${product.body.item.id}`)
      .expect(200);
    expect(finalProduct.body.variants[0]).toMatchObject({
      stockOnHand: 0,
      reservedQuantity: 0,
      availableQuantity: 0,
    });
  });
});
