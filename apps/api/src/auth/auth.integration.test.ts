import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApplication } from '../main';

describe('staff authentication API', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.AUTH_STORE = 'memory';
    process.env.SESSION_STORE = 'memory';
    process.env.SESSION_SECRET = 'test-session-secret-that-is-long-enough';

    app = await createApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects an unauthenticated current-user request', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);

    expect(response.body).toMatchObject({
      statusCode: 401,
      code: 'UNAUTHORIZED',
    });
    expect(response.body.timestamp).toEqual(expect.any(String));
  });

  it('validates the login payload', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/staff/login')
      .send({ email: 'receptionist@hadith-hotel.com' })
      .expect(400);

    expect(response.body).toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });
  });

  it('rejects a non-email login identifier', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/staff/login')
      .send({ email: 'receptionist', password: 'password' })
      .expect(400);
  });

  it('rejects invalid credentials without creating a session', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/staff/login')
      .send({ email: 'receptionist@hadith-hotel.com', password: 'wrong-password' })
      .expect(401);

    expect(response.body).toMatchObject({
      statusCode: 401,
      code: 'INVALID_CREDENTIALS',
    });
    expect(response.headers['set-cookie']).toBeUndefined();
  });

  it('creates a staff session, exposes RBAC identity, and invalidates logout', async () => {
    const agent = request.agent(app.getHttpServer());
    const loginResponse = await agent
      .post('/api/v1/auth/staff/login')
      .send({ email: 'receptionist@hadith-hotel.com', password: 'password' })
      .expect(200);

    expect(loginResponse.body.user).toMatchObject({
      displayName: 'Siti Receptionist',
      roles: ['RECEPTIONIST'],
    });
    expect(loginResponse.body.user.permissions).toEqual([
      'receptionist:guest:assign',
      'receptionist:guest:checkout',
      'receptionist:guest:update',
      'receptionist:rooms:view',
      'receptionist:tv:pair',
    ]);
    expect(loginResponse.body.expiresAt).toEqual(expect.any(String));
    const sessionCookie = loginResponse.headers['set-cookie']?.[0] ?? '';
    expect(sessionCookie).toContain('room_service_session=');
    expect(sessionCookie).toContain('HttpOnly');
    expect(sessionCookie).toContain('SameSite=Lax');

    const currentUserResponse = await agent.get('/api/v1/auth/me').expect(200);
    expect(currentUserResponse.body).toMatchObject({
      displayName: 'Siti Receptionist',
      roles: ['RECEPTIONIST'],
    });
    expect(currentUserResponse.body.password).toBeUndefined();

    await agent.post('/api/v1/auth/staff/logout').expect(204);
    await agent.get('/api/v1/auth/me').expect(401);
  });

  it('authenticates the superadmin with user and role management permissions', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/staff/login')
      .send({ email: 'superadmin@hadith-hotel.com', password: 'password' })
      .expect(200);

    expect(response.body.user).toMatchObject({
      displayName: 'Donny',
      roles: ['SUPERADMIN'],
      permissions: ['role:manage', 'user:manage'],
    });
  });

  it('authenticates every seeded role through the staff login contract', async () => {
    const accounts = [
      ['superadmin@hadith-hotel.com', 'SUPERADMIN'],
      ['room-manager@hadith-hotel.com', 'ROOM_MANAGER'],
      ['receptionist@hadith-hotel.com', 'RECEPTIONIST'],
      ['spa@hadith-hotel.com', 'SPA'],
      ['restaurant@hadith-hotel.com', 'RESTAURANT'],
      ['lounge@hadith-hotel.com', 'LOUNGE'],
      ['housekeeping@hadith-hotel.com', 'HOUSEKEEPING'],
      ['beauty-and-salon@hadith-hotel.com', 'BEAUTY_AND_SALON'],
      ['cafe@hadith-hotel.com', 'CAFE'],
    ] as const;

    for (const [email, role] of accounts) {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/staff/login')
        .send({ email, password: 'password' })
        .expect(200);

      expect(response.body.user.roles).toEqual([role]);
    }
  });

  it('seeds only the approved local hotel role accounts', async () => {
    const superadmin = request.agent(app.getHttpServer());
    await superadmin
      .post('/api/v1/auth/staff/login')
      .send({ email: 'superadmin@hadith-hotel.com', password: 'password' })
      .expect(200);

    const users = await superadmin.get('/api/v1/management/users').expect(200);
    const accounts = users.body.items as Array<{ email: string; roles: string[] }>;

    expect(accounts.map((account) => account.email).sort()).toEqual([
      'beauty-and-salon@hadith-hotel.com',
      'cafe@hadith-hotel.com',
      'housekeeping@hadith-hotel.com',
      'lounge@hadith-hotel.com',
      'receptionist@hadith-hotel.com',
      'restaurant@hadith-hotel.com',
      'room-manager@hadith-hotel.com',
      'spa@hadith-hotel.com',
      'superadmin@hadith-hotel.com',
    ]);
    expect(accounts.every((account) => account.email.endsWith('@hadith-hotel.com'))).toBe(true);
    expect(accounts).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ roles: ['FOOD_AND_BEVERAGES'] })]),
    );
  });
});
