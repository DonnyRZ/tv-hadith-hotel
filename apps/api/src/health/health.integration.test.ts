import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApplication } from '../main';

describe('health API', () => {
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

  it('returns an uncached liveness response without authentication', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health').expect(200);

    expect(response.body).toEqual({
      status: 'ok',
      service: 'room-service-api',
    });
    expect(response.headers['cache-control']).toBe('no-store');
  });
});
