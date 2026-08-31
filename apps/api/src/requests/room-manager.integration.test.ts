import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApplication } from '../main';
import { REQUEST_REPOSITORY } from './request.repository';
import type { RequestRepository } from './request.repository';
import type { DepartmentCode, RequestItemKind } from './request.types';
import type { UnitCode } from '../rbac/rbac.types';

describe('Room Manager request API', () => {
  let app: INestApplication;
  let repository: RequestRepository;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.AUTH_STORE = 'memory';
    process.env.SESSION_STORE = 'memory';
    process.env.SESSION_SECRET = 'room-manager-test-session-secret-that-is-long-enough';

    app = await createApplication();
    await app.init();
    repository = app.get<RequestRepository>(REQUEST_REPOSITORY);
  });

  afterAll(async () => {
    await app.close();
  });

  async function login(email: string) {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/api/v1/auth/staff/login').send({ email, password: 'password' }).expect(200);
    return agent;
  }

  async function createRequest(department: DepartmentCode, unit: UnitCode, roomNumber: string) {
    const kind: RequestItemKind = unit === 'HOUSEKEEPING' ? 'SERVICE' : 'PRODUCT';
    return repository.create({
      clientRequestId: randomUUID(),
      department,
      unit,
      room: { id: randomUUID(), number: roomNumber },
      items: [
        {
          menuItemId: randomUUID(),
          unit,
          kind,
          name: unit === 'HOUSEKEEPING' ? 'Room cleaning' : `${unit} request`,
          localizedName: {
            uz: unit === 'HOUSEKEEPING' ? 'Room cleaning' : `${unit} request`,
            ru: unit === 'HOUSEKEEPING' ? 'Уборка номера' : `${unit} request`,
            en: unit === 'HOUSEKEEPING' ? 'Room cleaning' : `${unit} request`,
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

  it('lists only monitored units as read-only activity', async () => {
    const roomManager = await login('room-manager@hadith-hotel.com');
    const spaRequest = await createRequest('SPA', 'SPA', '601');
    const restaurantRequest = await createRequest('FOOD_AND_BEVERAGES', 'RESTAURANT', '602');
    const housekeepingRequest = await createRequest('HOUSEKEEPING', 'HOUSEKEEPING', '603');
    const beautyRequest = await createRequest('BEAUTY_AND_SALON', 'BEAUTY_AND_SALON', '604');
    const cafeRequest = await createRequest('CAFE', 'CAFE', '605');

    const response = await roomManager
      .get('/api/v1/room-manager/requests')
      .query({ page: 1, pageSize: 10 })
      .expect(200);

    expect(response.body).toMatchObject({ page: 1, pageSize: 10, total: 3 });
    expect(response.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: spaRequest.id, unit: 'SPA' }),
        expect.objectContaining({ id: restaurantRequest.id, unit: 'RESTAURANT' }),
        expect.objectContaining({ id: housekeepingRequest.id, unit: 'HOUSEKEEPING' }),
      ]),
    );
    expect(response.body.items).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: beautyRequest.id }),
        expect.objectContaining({ id: cafeRequest.id }),
      ]),
    );

    await roomManager
      .get('/api/v1/room-manager/requests')
      .query({ unit: 'SPA', room: '601' })
      .expect(200)
      .then((filtered) => {
        expect(filtered.body).toMatchObject({ total: 1, items: [{ id: spaRequest.id }] });
      });

    await roomManager.get(`/api/v1/room-manager/requests/${spaRequest.id}`).expect(200);
    await roomManager.get(`/api/v1/room-manager/requests/${beautyRequest.id}`).expect(404);
    await roomManager.get(`/api/v1/room-manager/requests/${cafeRequest.id}`).expect(404);
    await roomManager.get('/api/v1/room-manager/requests').query({ unit: 'CAFE' }).expect(400);
  });

  it('rejects monitoring access for non Room Manager staff', async () => {
    const cafe = await login('cafe@hadith-hotel.com');
    await cafe.get('/api/v1/room-manager/requests').expect(403);
  });
});
