import { describe, expect, it } from 'vitest';

import { validateRuntimeConfig } from './runtime-config';

describe('production runtime configuration', () => {
  it('rejects memory stores and missing deployment identity', () => {
    expect(() =>
      validateRuntimeConfig({
        NODE_ENV: 'production',
        AUTH_STORE: 'memory',
        SESSION_STORE: 'memory',
      }),
    ).toThrow(
      "AUTH_STORE must be 'postgres'; SESSION_STORE must be 'postgres'; DATABASE_URL is required; SESSION_SECRET must contain at least 32 characters; RELEASE_ID is required; REDIS_URL is required when STAFF_REALTIME_ENABLED is true",
    );
  });

  it('accepts a complete PostgreSQL production configuration', () => {
    const config = {
      NODE_ENV: 'production',
      APP_ENVIRONMENT: 'production',
      AUTH_STORE: 'postgres',
      SESSION_STORE: 'postgres',
      DATABASE_URL: 'postgresql://api:secret@example.test:5432/room_service',
      SESSION_SECRET: 'a-session-secret-that-is-longer-than-thirty-two-characters',
      RELEASE_ID: 'api-test-release',
      REDIS_URL: 'redis://redis.example.test:6379',
      TV_PAIRING_TTL_SECONDS: '600',
    };

    expect(validateRuntimeConfig(config)).toBe(config);
  });

  it('does not force PostgreSQL for development and test adapters', () => {
    expect(validateRuntimeConfig({ NODE_ENV: 'development', AUTH_STORE: 'memory' })).toMatchObject({
      NODE_ENV: 'development',
    });
    expect(validateRuntimeConfig({ NODE_ENV: 'test', AUTH_STORE: 'memory' })).toMatchObject({
      NODE_ENV: 'test',
    });
  });

  it('rejects an enabled TV update feed without a complete immutable artifact contract', () => {
    expect(() =>
      validateRuntimeConfig({
        NODE_ENV: 'production',
        APP_ENVIRONMENT: 'production',
        AUTH_STORE: 'postgres',
        SESSION_STORE: 'postgres',
        DATABASE_URL: 'postgresql://api:secret@example.test:5432/room_service',
        SESSION_SECRET: 'a-session-secret-that-is-longer-than-thirty-two-characters',
        RELEASE_ID: 'api-test-release',
        REDIS_URL: 'redis://redis.example.test:6379',
        TV_UPDATE_ENABLED: 'true',
        TV_UPDATE_VERSION_CODE: '11',
        TV_UPDATE_VERSION_NAME: '0.4.7',
        TV_UPDATE_APK_URL: 'http://updates.example.com/app.apk',
        TV_UPDATE_SHA256: 'not-a-sha256',
        TV_UPDATE_CERTIFICATE_SHA256: 'not-a-sha256',
      }),
    ).toThrow(
      'TV_UPDATE_APK_URL must be an absolute HTTPS URL when TV_UPDATE_ENABLED is true; ' +
        'TV_UPDATE_SHA256 must be a 64-character SHA-256 value when TV_UPDATE_ENABLED is true; ' +
        'TV_UPDATE_CERTIFICATE_SHA256 must be a 64-character SHA-256 value when TV_UPDATE_ENABLED is true',
    );
  });

  it('rejects expiring or signed query-string APK URLs', () => {
    expect(() =>
      validateRuntimeConfig({
        NODE_ENV: 'production',
        APP_ENVIRONMENT: 'production',
        AUTH_STORE: 'postgres',
        SESSION_STORE: 'postgres',
        DATABASE_URL: 'postgresql://api:secret@example.test:5432/room_service',
        SESSION_SECRET: 'a-session-secret-that-is-longer-than-thirty-two-characters',
        RELEASE_ID: 'api-test-release',
        REDIS_URL: 'redis://redis.example.test:6379',
        TV_UPDATE_ENABLED: 'true',
        TV_UPDATE_VERSION_CODE: '11',
        TV_UPDATE_VERSION_NAME: '0.4.7',
        TV_UPDATE_APK_URL: 'https://updates.example.com/app.apk?signature=temporary',
        TV_UPDATE_SHA256: 'a'.repeat(64),
        TV_UPDATE_CERTIFICATE_SHA256: 'b'.repeat(64),
      }),
    ).toThrow('TV_UPDATE_APK_URL must be an absolute HTTPS URL when TV_UPDATE_ENABLED is true');
  });

  it('rejects an update signed by a different certificate', () => {
    expect(() =>
      validateRuntimeConfig({
        NODE_ENV: 'production',
        APP_ENVIRONMENT: 'production',
        AUTH_STORE: 'postgres',
        SESSION_STORE: 'postgres',
        DATABASE_URL: 'postgresql://api:secret@example.test:5432/room_service',
        SESSION_SECRET: 'a-session-secret-that-is-longer-than-thirty-two-characters',
        RELEASE_ID: 'api-test-release',
        REDIS_URL: 'redis://redis.example.test:6379',
        TV_UPDATE_ENABLED: 'true',
        TV_UPDATE_VERSION_CODE: '11',
        TV_UPDATE_VERSION_NAME: '0.4.7',
        TV_UPDATE_APK_URL: 'https://updates.example.com/egi-tv/11/app-release.apk',
        TV_UPDATE_SHA256: 'a'.repeat(64),
        TV_UPDATE_CERTIFICATE_SHA256: 'b'.repeat(64),
      }),
    ).toThrow('TV_UPDATE_CERTIFICATE_SHA256 must match the existing production TV certificate');
  });

  it('keeps the update feed disabled by default', () => {
    const config = {
      NODE_ENV: 'production',
      APP_ENVIRONMENT: 'production',
      AUTH_STORE: 'postgres',
      SESSION_STORE: 'postgres',
      DATABASE_URL: 'postgresql://api:secret@example.test:5432/room_service',
      SESSION_SECRET: 'a-session-secret-that-is-longer-than-thirty-two-characters',
      RELEASE_ID: 'api-test-release',
      REDIS_URL: 'redis://redis.example.test:6379',
    };

    expect(validateRuntimeConfig(config)).toBe(config);
  });
});
