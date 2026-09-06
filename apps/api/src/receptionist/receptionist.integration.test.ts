import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApplication } from '../main';
import { RECEPTIONIST_ROOM_CATALOG, roomIdForNumber } from './receptionist.types';

describe('receptionist guest assignment API', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.AUTH_STORE = 'memory';
    process.env.SESSION_STORE = 'memory';
    process.env.SESSION_SECRET = 'receptionist-test-session-secret-that-is-long-enough';

    app = await createApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  async function login() {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/v1/auth/staff/login')
      .send({ email: 'receptionist@hadith-hotel.com', password: 'password' })
      .expect(200);
    return agent;
  }

  it('requires receptionist access and exposes exactly the confirmed 114-room inventory', async () => {
    await request(app.getHttpServer()).get('/api/v1/receptionist/rooms').expect(401);

    const receptionist = await login();
    const response = await receptionist
      .get('/api/v1/receptionist/rooms')
      .query({ page: 1, pageSize: 100 })
      .expect(200);

    expect(response.body).toMatchObject({ page: 1, pageSize: 100, total: 114 });
    expect(response.body.items).toHaveLength(100);
    expect(response.body.items[0]).toMatchObject({
      room: { number: '201' },
      roomStatus: 'VACANT',
      activeAssignment: null,
    });
    expect(response.body.items[99]).toMatchObject({ room: { number: '424' } });
    expect(RECEPTIONIST_ROOM_CATALOG).toHaveLength(114);
  });

  it('assigns, searches, edits, checks out, and safely reassigns a room', async () => {
    const receptionist = await login();
    const roomId = roomIdForNumber('401');

    const assigned = await receptionist
      .post(`/api/v1/receptionist/rooms/${roomId}/guest-assignment`)
      .send({ guestName: '  Ahmad   Fauzan  ', stayDays: 3 })
      .expect(201);

    expect(assigned.body).toMatchObject({
      room: { id: roomId, number: '401' },
      guestName: 'Ahmad Fauzan',
      stayDays: 3,
      status: 'ACTIVE',
      checkedOutAt: null,
      assignedBy: { displayName: 'Siti Receptionist', role: 'RECEPTIONIST' },
    });
    expect(assigned.body.id).toEqual(expect.any(String));
    expect(assigned.body.assignedAt).toEqual(expect.any(String));

    await receptionist
      .post(`/api/v1/receptionist/rooms/${roomId}/guest-assignment`)
      .send({ guestName: 'Another Guest', stayDays: 3 })
      .expect(409);

    const assignmentId = assigned.body.id as string;
    const search = await receptionist
      .get('/api/v1/receptionist/rooms')
      .query({ search: 'ahmad', page: 1, pageSize: 10 })
      .expect(200);
    expect(search.body).toMatchObject({ total: 1, items: [{ room: { number: '401' } }] });
    expect(search.body.items[0]).toMatchObject({
      roomStatus: 'OCCUPIED',
      activeAssignment: {
        id: assignmentId,
        guestName: 'Ahmad Fauzan',
        stayDays: 3,
        status: 'ACTIVE',
      },
    });

    const updated = await receptionist
      .patch(`/api/v1/receptionist/guest-assignments/${assignmentId}`)
      .send({ guestName: 'Ahmad F. Fauzan', stayDays: 4 })
      .expect(200);
    expect(updated.body).toMatchObject({
      id: assignmentId,
      guestName: 'Ahmad F. Fauzan',
      stayDays: 4,
    });

    const checkedOut = await receptionist
      .post(`/api/v1/receptionist/guest-assignments/${assignmentId}/checkout`)
      .expect(200);
    expect(checkedOut.body).toMatchObject({
      id: assignmentId,
      status: 'CHECKED_OUT',
      checkedOutAt: expect.any(String),
    });

    const vacant = await receptionist.get(`/api/v1/receptionist/rooms/${roomId}`).expect(200);
    expect(vacant.body).toMatchObject({
      room: { id: roomId, number: '401' },
      roomStatus: 'VACANT',
      activeAssignment: null,
    });

    await receptionist
      .post(`/api/v1/receptionist/guest-assignments/${assignmentId}/checkout`)
      .expect(409);

    const reassigned = await receptionist
      .post(`/api/v1/receptionist/rooms/${roomId}/guest-assignment`)
      .send({ guestName: 'New Guest', stayDays: 2 })
      .expect(201);
    expect(reassigned.body).toMatchObject({
      room: { number: '401' },
      guestName: 'New Guest',
      stayDays: 2,
    });
  });

  it('rejects malformed input, unknown rooms, and non-receptionist roles', async () => {
    const receptionist = await login();
    const validationRoomId = roomIdForNumber('402');

    await receptionist
      .post(`/api/v1/receptionist/rooms/${validationRoomId}/guest-assignment`)
      .send({ guestName: 'Missing stay length' })
      .expect(400);

    await receptionist
      .post(`/api/v1/receptionist/rooms/${validationRoomId}/guest-assignment`)
      .send({ guestName: 'Invalid stay length', stayDays: 0 })
      .expect(400);

    await receptionist
      .post(`/api/v1/receptionist/rooms/${validationRoomId}/guest-assignment`)
      .send({ guestName: 'Invalid stay length', stayDays: 366 })
      .expect(400);

    await receptionist
      .post(`/api/v1/receptionist/rooms/${validationRoomId}/guest-assignment`)
      .send({ guestName: '   ', stayDays: 1 })
      .expect(400);

    await receptionist
      .post('/api/v1/receptionist/rooms/00000000-0000-5000-8000-000000000000/guest-assignment')
      .send({ guestName: 'Guest', stayDays: 1 })
      .expect(404);

    const cafe = request.agent(app.getHttpServer());
    await cafe
      .post('/api/v1/auth/staff/login')
      .send({ email: 'cafe@hadith-hotel.com', password: 'password' })
      .expect(200);
    await cafe.get('/api/v1/receptionist/rooms').expect(403);
    await cafe
      .post(`/api/v1/receptionist/rooms/${roomIdForNumber('402')}/guest-assignment`)
      .send({ guestName: 'Guest', stayDays: 1 })
      .expect(403);
  });

  it('returns a read-only all-unit folio and isolates it from past and future assignments', async () => {
    const receptionist = await login();
    const roomNumber = '404';
    const roomId = roomIdForNumber(roomNumber);
    const qr = await receptionist
      .post(`/api/v1/receptionist/rooms/${roomId}/guest-access-token`)
      .expect(200);
    const guestToken = new URL(qr.body.qrUrl as string).searchParams.get('access_token');
    expect(guestToken).toEqual(expect.any(String));

    const assigned = await receptionist
      .post(`/api/v1/receptionist/rooms/${roomId}/guest-assignment`)
      .send({ guestName: 'Folio Guest', stayDays: 3 })
      .expect(201);
    const assignmentId = assigned.body.id as string;

    const cafeMenu = await request(app.getHttpServer())
      .get('/api/v1/guest/menus')
      .query({ unit: 'CAFE', page: 1, pageSize: 1 })
      .set('X-Guest-Access-Token', guestToken as string)
      .expect(200);
    const restaurantMenu = await request(app.getHttpServer())
      .get('/api/v1/guest/menus')
      .query({ unit: 'RESTAURANT', page: 1, pageSize: 1 })
      .set('X-Guest-Access-Token', guestToken as string)
      .expect(200);

    const cafeOrder = await request(app.getHttpServer())
      .post('/api/v1/guest/requests')
      .set('X-Guest-Access-Token', guestToken as string)
      .send({
        clientRequestId: randomUUID(),
        items: [{ menuItemId: cafeMenu.body.items[0].id, quantity: 2 }],
      })
      .expect(201);
    const restaurantOrder = await request(app.getHttpServer())
      .post('/api/v1/guest/requests')
      .set('X-Guest-Access-Token', guestToken as string)
      .send({
        clientRequestId: randomUUID(),
        items: [{ menuItemId: restaurantMenu.body.items[0].id, quantity: 1 }],
      })
      .expect(201);

    const folio = await receptionist.get(`/api/v1/receptionist/rooms/${roomId}/folio`).expect(200);
    expect(folio.body).toMatchObject({
      room: { id: roomId, number: roomNumber },
      assignment: { id: assignmentId, guestName: 'Folio Guest', status: 'ACTIVE' },
      total: 2,
      summary: {
        orderCount: 2,
        openOrderCount: 2,
        itemCount: 3,
        statusCounts: { NEW: 2, IN_PROCESS: 0, COMPLETED: 0, CANCELLED: 0 },
      },
    });
    expect(folio.body.orders).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: cafeOrder.body.id,
          unit: 'CAFE',
          guestAssignmentId: assignmentId,
        }),
        expect.objectContaining({
          id: restaurantOrder.body.id,
          unit: 'RESTAURANT',
          guestAssignmentId: assignmentId,
        }),
      ]),
    );

    const cafe = request.agent(app.getHttpServer());
    await cafe
      .post('/api/v1/auth/staff/login')
      .send({ email: 'cafe@hadith-hotel.com', password: 'password' })
      .expect(200);
    await cafe.get(`/api/v1/receptionist/rooms/${roomId}/folio`).expect(403);

    await receptionist
      .post(`/api/v1/receptionist/guest-assignments/${assignmentId}/checkout`)
      .expect(200);
    const history = await receptionist
      .get(`/api/v1/receptionist/rooms/${roomId}/folio/history`)
      .expect(200);
    expect(history.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          assignment: expect.objectContaining({ id: assignmentId, guestName: 'Folio Guest' }),
        }),
      ]),
    );
    const historical = await receptionist
      .get(`/api/v1/receptionist/rooms/${roomId}/folio/history/${assignmentId}`)
      .expect(200);
    expect(historical.body).toMatchObject({
      assignment: { id: assignmentId, status: 'CHECKED_OUT' },
      summary: { orderCount: 2 },
    });

    const reassigned = await receptionist
      .post(`/api/v1/receptionist/rooms/${roomId}/guest-assignment`)
      .send({ guestName: 'New Folio Guest', stayDays: 2 })
      .expect(201);
    const newFolio = await receptionist
      .get(`/api/v1/receptionist/rooms/${roomId}/folio`)
      .expect(200);
    expect(reassigned.body.id).not.toBe(assignmentId);
    expect(newFolio.body).toMatchObject({
      assignment: { id: reassigned.body.id, guestName: 'New Folio Guest' },
      orders: [],
      total: 0,
      summary: { orderCount: 0, itemCount: 0 },
    });
  });

  it('keeps the TV context authoritative after assignment and checkout', async () => {
    const receptionist = await login();
    const roomId = roomIdForNumber('403');
    const installationId = 'receptionist-assignment-tv-test';
    const start = await request(app.getHttpServer())
      .post('/api/v1/tv/provisioning/start')
      .send({
        installationId,
        appVersion: '0.1.0-test',
        deviceModel: 'Reference Google TV',
        androidApiLevel: 36,
      })
      .expect(200);

    await receptionist
      .post('/api/v1/receptionist/tv-devices/pair')
      .send({
        pairingCode: start.body.pairingCode,
        roomId,
        roomNumber: '403',
      })
      .expect(200);
    const claim = await request(app.getHttpServer())
      .post('/api/v1/tv/provisioning/claim')
      .send({ pairingCode: start.body.pairingCode, installationId })
      .expect(200);

    const beforeAssignment = await request(app.getHttpServer())
      .get('/api/v1/tv/context')
      .set('X-Device-Credential', claim.body.credential)
      .expect(200);
    expect(beforeAssignment.body).toMatchObject({ roomStatus: 'VACANT' });

    const assigned = await receptionist
      .post(`/api/v1/receptionist/rooms/${roomId}/guest-assignment`)
      .send({ guestName: 'TV Guest', stayDays: 2 })
      .expect(201);
    const assignmentId = assigned.body.id as string;

    const occupiedContext = await request(app.getHttpServer())
      .get('/api/v1/tv/context')
      .set('X-Device-Credential', claim.body.credential)
      .expect(200);
    expect(occupiedContext.body).toMatchObject({
      roomStatus: 'OCCUPIED',
      welcome: { guestName: 'TV Guest', personalized: true, message: 'Welcome, TV Guest' },
      stay: {
        checkInAt: expect.any(String),
        checkOutAt: expect.any(String),
        totalDays: 2,
        timeZone: 'Asia/Tashkent',
      },
    });

    await receptionist
      .post(`/api/v1/receptionist/guest-assignments/${assignmentId}/checkout`)
      .expect(200);
    const afterCheckout = await request(app.getHttpServer())
      .get('/api/v1/tv/context')
      .set('X-Device-Credential', claim.body.credential)
      .expect(200);
    expect(afterCheckout.body).toMatchObject({
      roomStatus: 'VACANT',
      welcome: { guestName: null, personalized: false, message: 'Welcome' },
      stay: null,
    });
  });
});
