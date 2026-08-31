import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApplication } from '../main';

describe('Superadmin management API', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.AUTH_STORE = 'memory';
    process.env.SESSION_STORE = 'memory';
    process.env.SESSION_SECRET = 'management-test-session-secret-that-is-long-enough';

    app = await createApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('keeps user and role management restricted to Superadmin', async () => {
    const receptionist = request.agent(app.getHttpServer());
    await receptionist
      .post('/api/v1/auth/staff/login')
      .send({ email: 'receptionist@hadith-hotel.com', password: 'password' })
      .expect(200);

    await receptionist.get('/api/v1/management/users').expect(403);
    await receptionist.get('/api/v1/management/roles').expect(403);
  });

  it('supports the user lifecycle and custom role lifecycle', async () => {
    const superadmin = request.agent(app.getHttpServer());
    await superadmin
      .post('/api/v1/auth/staff/login')
      .send({ email: 'superadmin@hadith-hotel.com', password: 'password' })
      .expect(200);

    const users = await superadmin.get('/api/v1/management/users').expect(200);
    expect(users.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ email: 'superadmin@hadith-hotel.com', active: true }),
      ]),
    );
    expect(users.body.items[0].passwordHash).toBeUndefined();

    const systemRoles = await superadmin.get('/api/v1/management/roles').expect(200);
    expect(systemRoles.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'RESTAURANT', system: true }),
        expect.objectContaining({ code: 'LOUNGE', system: true }),
      ]),
    );
    expect(systemRoles.body.items).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'FOOD_AND_BEVERAGES' })]),
    );

    const createdRole = await superadmin
      .post('/api/v1/management/roles')
      .send({
        code: 'API_TEST_ROLE',
        name: 'API test role',
        description: 'Role used for the management API test.',
        permissions: ['request:view'],
      })
      .expect(201);
    expect(createdRole.body).toMatchObject({
      code: 'API_TEST_ROLE',
      system: false,
      userCount: 0,
    });

    const createdUser = await superadmin
      .post('/api/v1/management/users')
      .send({
        email: 'management-api-test@hadith-hotel.com',
        displayName: 'Management API Test',
        roles: ['API_TEST_ROLE'],
        password: 'initial-pass-123',
      })
      .expect(201);
    expect(createdUser.body).toMatchObject({
      email: 'management-api-test@hadith-hotel.com',
      roles: ['API_TEST_ROLE'],
      active: true,
    });
    expect(createdUser.body.passwordHash).toBeUndefined();

    const roleWithAssignment = await superadmin.get('/api/v1/management/roles').expect(200);
    expect(roleWithAssignment.body.items).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'API_TEST_ROLE', userCount: 1 })]),
    );

    const updatedRole = await superadmin
      .patch(`/api/v1/management/roles/${createdRole.body.id}`)
      .send({
        name: 'API test role updated',
        description: 'Updated management API test role.',
        permissions: ['request:view', 'request:history'],
      })
      .expect(200);
    expect(updatedRole.body.name).toBe('API test role updated');

    const updatedUser = await superadmin
      .patch(`/api/v1/management/users/${createdUser.body.id}`)
      .send({
        email: 'management-api-test@hadith-hotel.com',
        displayName: 'Management API Test Updated',
        roles: ['CAFE'],
      })
      .expect(200);
    expect(updatedUser.body.roles).toEqual(['CAFE']);

    const resetUser = await superadmin
      .post(`/api/v1/management/users/${createdUser.body.id}/reset-password`)
      .send({ password: 'reset-pass-456' })
      .expect(200);
    expect(resetUser.body.password).toBeUndefined();

    const deactivated = await superadmin
      .post(`/api/v1/management/users/${createdUser.body.id}/deactivate`)
      .expect(200);
    expect(deactivated.body.active).toBe(false);
    const reactivated = await superadmin
      .post(`/api/v1/management/users/${createdUser.body.id}/reactivate`)
      .expect(200);
    expect(reactivated.body.active).toBe(true);

    const createdUserAgent = request.agent(app.getHttpServer());
    await createdUserAgent
      .post('/api/v1/auth/staff/login')
      .send({ email: 'management-api-test@hadith-hotel.com', password: 'reset-pass-456' })
      .expect(200);

    await superadmin.delete(`/api/v1/management/roles/${createdRole.body.id}`).expect(200);
  });

  it('protects the last active Superadmin from self lockout', async () => {
    const superadmin = request.agent(app.getHttpServer());
    const login = await superadmin
      .post('/api/v1/auth/staff/login')
      .send({ email: 'superadmin@hadith-hotel.com', password: 'password' })
      .expect(200);

    await superadmin.post(`/api/v1/management/users/${login.body.user.id}/deactivate`).expect(409);
  });
});
