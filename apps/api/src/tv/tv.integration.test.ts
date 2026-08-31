import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApplication } from '../main';

describe('Smart TV provisioning API', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.AUTH_STORE = 'memory';
    process.env.SESSION_STORE = 'memory';
    process.env.SESSION_SECRET = 'test-session-secret-that-is-long-enough';
    process.env.TV_PAIRING_TTL_SECONDS = '600';

    app = await createApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates a short-lived one-time pairing code without accepting a room number', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/tv/provisioning/start')
      .send({
        installationId: 'installation-302-unique',
        appVersion: '0.1.0-debug',
        deviceModel: 'Reference Google TV',
        androidApiLevel: 36,
      })
      .expect(200);

    expect(response.body).toMatchObject({
      deviceId: expect.any(String),
      deviceCode: expect.stringMatching(/^device_/),
      pairingCode: expect.stringMatching(/^\d{6}$/),
      expiresAt: expect.any(String),
    });
    expect(response.body.roomId).toBeUndefined();
  });

  it('requires the receptionist pairing permission and completes the TV context flow', async () => {
    const startResponse = await request(app.getHttpServer())
      .post('/api/v1/tv/provisioning/start')
      .send({
        installationId: 'installation-417-unique',
        appVersion: '0.1.0-debug',
        deviceModel: 'Reference Google TV',
        androidApiLevel: 36,
      })
      .expect(200);
    const pairingCode = startResponse.body.pairingCode as string;

    await request(app.getHttpServer())
      .post('/api/v1/receptionist/tv-devices/pair')
      .send({
        pairingCode,
        roomId: 'c3a4b6d6-5a58-4dd8-a4c5-2d4606c8a1e4',
        roomNumber: '417',
      })
      .expect(401);

    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/v1/auth/staff/login')
      .send({ email: 'receptionist@hadith-hotel.com', password: 'password' })
      .expect(200);

    const pairResponse = await agent
      .post('/api/v1/receptionist/tv-devices/pair')
      .send({
        pairingCode,
        roomId: 'c3a4b6d6-5a58-4dd8-a4c5-2d4606c8a1e4',
        roomNumber: '417',
      })
      .expect(200);

    expect(pairResponse.body.device.room).toEqual({
      id: 'c3a4b6d6-5a58-4dd8-a4c5-2d4606c8a1e4',
      number: '417',
    });

    await agent
      .post('/api/v1/receptionist/tv-devices/pair')
      .send({
        pairingCode,
        roomId: 'c3a4b6d6-5a58-4dd8-a4c5-2d4606c8a1e4',
        roomNumber: '417',
      })
      .expect(409);

    const claimResponse = await request(app.getHttpServer())
      .post('/api/v1/tv/provisioning/claim')
      .send({ pairingCode, installationId: 'installation-417-unique' })
      .expect(200);

    expect(claimResponse.body.credential).toEqual(expect.stringMatching(/^tv_/));

    const contextResponse = await request(app.getHttpServer())
      .get('/api/v1/tv/context')
      .set('X-Device-Credential', claimResponse.body.credential as string)
      .expect(200);

    expect(contextResponse.body).toMatchObject({
      device: {
        room: {
          number: '417',
        },
      },
      roomStatus: 'VACANT',
      welcome: {
        personalized: false,
      },
    });
  });

  it('rejects an invalid device credential and revokes a paired device', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/tv/context')
      .set('X-Device-Credential', 'tv_invalid')
      .expect(401);

    const startResponse = await request(app.getHttpServer())
      .post('/api/v1/tv/provisioning/start')
      .send({
        installationId: 'installation-215-unique',
        appVersion: '0.1.0-debug',
        deviceModel: 'Reference Google TV',
        androidApiLevel: 36,
      })
      .expect(200);
    const pairingCode = startResponse.body.pairingCode as string;
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/v1/auth/staff/login')
      .send({ email: 'receptionist@hadith-hotel.com', password: 'password' })
      .expect(200);
    await agent
      .post('/api/v1/receptionist/tv-devices/pair')
      .send({
        pairingCode,
        roomId: 'f0a4b6d6-5a58-4dd8-a4c5-2d4606c8a1e4',
        roomNumber: '215',
      })
      .expect(200);
    const claimResponse = await request(app.getHttpServer())
      .post('/api/v1/tv/provisioning/claim')
      .send({ pairingCode, installationId: 'installation-215-unique' })
      .expect(200);

    await agent
      .post(`/api/v1/receptionist/tv-devices/${startResponse.body.deviceId as string}/revoke`)
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/v1/tv/context')
      .set('X-Device-Credential', claimResponse.body.credential as string)
      .expect(401);
  });

  it('resets a device by revoking its credential and opening a fresh pairing session', async () => {
    const installationId = 'installation-reset-unique';
    const roomId = 'a1a4b6d6-5a58-4dd8-a4c5-2d4606c8a1e4';
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/v1/auth/staff/login')
      .send({ email: 'receptionist@hadith-hotel.com', password: 'password' })
      .expect(200);

    const startResponse = await request(app.getHttpServer())
      .post('/api/v1/tv/provisioning/start')
      .send({
        installationId,
        appVersion: '0.1.0-debug',
        deviceModel: 'Reference Google TV',
        androidApiLevel: 36,
      })
      .expect(200);

    await agent
      .post('/api/v1/receptionist/tv-devices/pair')
      .send({
        pairingCode: startResponse.body.pairingCode as string,
        roomId,
        roomNumber: '501',
      })
      .expect(200);
    const claimResponse = await request(app.getHttpServer())
      .post('/api/v1/tv/provisioning/claim')
      .send({
        pairingCode: startResponse.body.pairingCode as string,
        installationId,
      })
      .expect(200);

    const resetResponse = await agent
      .post(`/api/v1/receptionist/tv-devices/${startResponse.body.deviceId as string}/reset`)
      .expect(200);
    expect(resetResponse.body).toMatchObject({
      deviceId: startResponse.body.deviceId,
      status: 'PENDING',
      pairingExpiresAt: expect.any(String),
    });

    await request(app.getHttpServer())
      .get('/api/v1/tv/context')
      .set('X-Device-Credential', claimResponse.body.credential as string)
      .expect(401);

    const restarted = await request(app.getHttpServer())
      .post('/api/v1/tv/provisioning/start')
      .send({
        installationId,
        appVersion: '0.1.0-debug',
        deviceModel: 'Reference Google TV',
        androidApiLevel: 36,
      })
      .expect(200);
    expect(restarted.body.pairingCode).toEqual(expect.stringMatching(/^\d{6}$/));
  });

  it('lists paired devices without returning device credentials or secret hashes', async () => {
    const installationId = 'installation-list-unique';
    const roomId = randomUUID();
    const roomNumber = '418';
    const startResponse = await request(app.getHttpServer())
      .post('/api/v1/tv/provisioning/start')
      .send({
        installationId,
        appVersion: '0.1.0-debug',
        deviceModel: 'Reference Google TV',
        androidApiLevel: 36,
      })
      .expect(200);
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/v1/auth/staff/login')
      .send({ email: 'receptionist@hadith-hotel.com', password: 'password' })
      .expect(200);
    await agent
      .post('/api/v1/receptionist/tv-devices/pair')
      .send({
        pairingCode: startResponse.body.pairingCode as string,
        roomId,
        roomNumber,
      })
      .expect(200);

    const response = await agent
      .get('/api/v1/receptionist/tv-devices')
      .query({ roomId, page: 1, pageSize: 10 })
      .expect(200);
    expect(response.body).toMatchObject({ page: 1, pageSize: 10, total: 1 });
    expect(response.body.items[0]).toMatchObject({
      id: startResponse.body.deviceId,
      deviceCode: startResponse.body.deviceCode,
      status: 'PAIRED',
      room: { id: roomId, number: roomNumber },
    });
    expect(response.body.items[0]).not.toHaveProperty('credential');
    expect(response.body.items[0]).not.toHaveProperty('credentialHash');
    expect(response.body.items[0]).not.toHaveProperty('pairingCodeHash');
  });
});
