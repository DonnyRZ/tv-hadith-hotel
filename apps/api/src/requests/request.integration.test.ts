import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApplication } from '../main';
import { REQUEST_REPOSITORY } from './request.repository';
import type { RequestRepository } from './request.repository';
import type { UnitCode } from '../rbac/rbac.types';

describe('department request API', () => {
  let app: INestApplication;
  let repository: RequestRepository;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.AUTH_STORE = 'memory';
    process.env.SESSION_STORE = 'memory';
    process.env.SESSION_SECRET = 'request-test-session-secret-that-is-long-enough';

    app = await createApplication();
    await app.init();
    repository = app.get<RequestRepository>(REQUEST_REPOSITORY);
  });

  afterAll(async () => {
    await app.close();
  });

  async function login(email: string, password: string) {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/api/v1/auth/staff/login').send({ email, password }).expect(200);
    return agent;
  }

  async function createCafeRequest(roomNumber: string) {
    return repository.create({
      clientRequestId: randomUUID(),
      department: 'CAFE',
      unit: 'CAFE',
      room: { id: randomUUID(), number: roomNumber },
      items: [
        {
          menuItemId: randomUUID(),
          unit: 'CAFE',
          kind: 'PRODUCT',
          name: 'Iced Americano',
          localizedName: { uz: 'Iced Americano', ru: 'Iced Americano', en: 'Iced Americano' },
          quantity: 2,
          note: null,
          unitPrice: null,
          currency: null,
        },
      ],
      guestNote: null,
    });
  }

  async function createFoodAndBeverageRequest(
    unit: Extract<UnitCode, 'RESTAURANT' | 'LOUNGE'>,
    roomNumber: string,
  ) {
    return repository.create({
      clientRequestId: randomUUID(),
      department: 'FOOD_AND_BEVERAGES',
      unit,
      room: { id: randomUUID(), number: roomNumber },
      items: [
        {
          menuItemId: randomUUID(),
          unit,
          kind: 'PRODUCT',
          name: unit === 'RESTAURANT' ? 'Nasi Goreng' : 'Lounge platter',
          localizedName: {
            uz: unit === 'RESTAURANT' ? 'Nasi Goreng' : 'Lounge platter',
            ru: unit === 'RESTAURANT' ? 'Наси горенг' : 'Lounge platter',
            en: unit === 'RESTAURANT' ? 'Nasi Goreng' : 'Lounge platter',
          },
          quantity: 1,
          note: null,
          unitPrice: null,
          currency: null,
        },
      ],
      guestNote: null,
    });
  }

  it('returns an empty operational queue without fabricating orders', async () => {
    const cafe = await login('cafe@hadith-hotel.com', 'password');
    const roomNumber = `empty-${randomUUID().slice(0, 8)}`;

    const response = await cafe
      .get('/api/v1/department/requests')
      .query({ unit: 'CAFE', room: roomNumber, page: 1, pageSize: 10 })
      .expect(200);

    expect(response.body).toMatchObject({ items: [], page: 1, pageSize: 10, total: 0 });
  });

  it('lists Cafe requests and enforces NEW to IN_PROCESS to COMPLETED', async () => {
    const cafe = await login('cafe@hadith-hotel.com', 'password');
    const created = await createCafeRequest('503');

    const queue = await cafe
      .get('/api/v1/department/requests')
      .query({ unit: 'CAFE', room: '503', page: 1, pageSize: 10 })
      .expect(200);

    expect(queue.body).toMatchObject({ page: 1, pageSize: 10, total: 1 });
    expect(queue.body.items[0]).toMatchObject({
      id: created.id,
      department: 'CAFE',
      unit: 'CAFE',
      room: { number: '503' },
      status: 'NEW',
    });
    expect(queue.body.items[0]).not.toHaveProperty('orderCount');

    const confirmed = await cafe
      .post(`/api/v1/department/requests/${created.id}/confirm`)
      .expect(200);
    expect(confirmed.body).toMatchObject({ id: created.id, status: 'IN_PROCESS' });
    expect(confirmed.body.confirmedAt).toEqual(expect.any(String));

    const completed = await cafe.post(`/api/v1/department/requests/${created.id}/done`).expect(200);
    expect(completed.body).toMatchObject({ id: created.id, status: 'COMPLETED' });
    expect(completed.body.completedAt).toEqual(expect.any(String));

    await cafe.post(`/api/v1/department/requests/${created.id}/done`).expect(409);

    const history = await cafe
      .get('/api/v1/department/requests')
      .query({ unit: 'CAFE', room: '503', status: 'COMPLETED' })
      .expect(200);
    expect(history.body).toMatchObject({
      total: 1,
      items: [{ id: created.id, status: 'COMPLETED' }],
    });
  });

  it('does not expose another unit to Cafe or request-less staff', async () => {
    const cafe = await login('cafe@hadith-hotel.com', 'password');
    const restaurantRequest = await repository.create({
      clientRequestId: randomUUID(),
      department: 'FOOD_AND_BEVERAGES',
      unit: 'RESTAURANT',
      room: { id: randomUUID(), number: '504' },
      items: [
        {
          menuItemId: randomUUID(),
          unit: 'RESTAURANT',
          kind: 'PRODUCT',
          name: 'Nasi Goreng',
          localizedName: { uz: 'Nasi Goreng', ru: 'Наси горенг', en: 'Nasi Goreng' },
          quantity: 1,
          note: null,
          unitPrice: null,
          currency: null,
        },
      ],
      guestNote: null,
    });

    await cafe.get('/api/v1/department/requests').query({ unit: 'RESTAURANT' }).expect(403);
    await cafe.get(`/api/v1/department/requests/${restaurantRequest.id}`).expect(404);

    const receptionist = await login('receptionist@hadith-hotel.com', 'password');
    await receptionist.get('/api/v1/department/requests').expect(403);
  });

  it('allows each operational department role to view its own queue', async () => {
    const departmentAccounts = [
      { email: 'spa@hadith-hotel.com', unit: 'SPA' },
      { email: 'beauty-and-salon@hadith-hotel.com', unit: 'BEAUTY_AND_SALON' },
      { email: 'housekeeping@hadith-hotel.com', unit: 'HOUSEKEEPING' },
    ] as const;

    for (const account of departmentAccounts) {
      const department = await login(account.email, 'password');
      const response = await department
        .get('/api/v1/department/requests')
        .query({ unit: account.unit, page: 1, pageSize: 10 })
        .expect(200);

      expect(response.body).toMatchObject({ items: [], page: 1, pageSize: 10, total: 0 });
    }
  });

  it('keeps Restaurant and Lounge dashboards isolated', async () => {
    const restaurant = await login('restaurant@hadith-hotel.com', 'password');
    const lounge = await login('lounge@hadith-hotel.com', 'password');
    const restaurantRoom = `restaurant-${randomUUID().slice(0, 8)}`;
    const loungeRoom = `lounge-${randomUUID().slice(0, 8)}`;
    const restaurantRequest = await createFoodAndBeverageRequest('RESTAURANT', restaurantRoom);
    const loungeRequest = await createFoodAndBeverageRequest('LOUNGE', loungeRoom);

    await restaurant
      .get('/api/v1/department/requests')
      .query({ unit: 'RESTAURANT', room: restaurantRoom })
      .expect(200)
      .then((response) =>
        expect(response.body.items).toEqual([
          expect.objectContaining({ id: restaurantRequest.id }),
        ]),
      );
    await restaurant.get('/api/v1/department/requests').query({ unit: 'LOUNGE' }).expect(403);
    await restaurant.get(`/api/v1/department/requests/${loungeRequest.id}`).expect(404);

    await lounge
      .get('/api/v1/department/requests')
      .query({ unit: 'LOUNGE', room: loungeRoom })
      .expect(200)
      .then((response) =>
        expect(response.body.items).toEqual([expect.objectContaining({ id: loungeRequest.id })]),
      );
    await lounge.get('/api/v1/department/requests').query({ unit: 'RESTAURANT' }).expect(403);
    await lounge.get(`/api/v1/department/requests/${restaurantRequest.id}`).expect(404);
  });
});
