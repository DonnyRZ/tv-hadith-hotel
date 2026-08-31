import { ConfigService } from '@nestjs/config';
import connectPgSimple from 'connect-pg-simple';
import { Pool } from 'pg';
import session from 'express-session';

import { STAFF_SESSION_COOKIE, STAFF_SESSION_TTL_MS } from './auth.constants';

const PgSessionStore = connectPgSimple(session);

function isProduction(config: ConfigService): boolean {
  return config.get<string>('NODE_ENV') === 'production';
}

export function createStaffSessionMiddleware(config: ConfigService): ReturnType<typeof session> {
  const production = isProduction(config);
  const storeMode = config.get<string>('SESSION_STORE') ?? (production ? 'postgres' : 'memory');
  const secret = config.get<string>('SESSION_SECRET');

  if (secret === undefined || secret.trim().length < 32) {
    if (production) {
      throw new Error('SESSION_SECRET must be at least 32 characters in production');
    }
  }

  const options: session.SessionOptions = {
    name: STAFF_SESSION_COOKIE,
    secret: secret ?? 'local-development-session-secret-change-me',
    resave: false,
    saveUninitialized: false,
    rolling: false,
    proxy: production,
    cookie: {
      httpOnly: true,
      secure: production,
      sameSite: 'lax',
      maxAge: STAFF_SESSION_TTL_MS,
      path: '/',
    },
  };

  if (storeMode === 'postgres') {
    const databaseUrl = config.get<string>('DATABASE_URL');

    if (databaseUrl === undefined || databaseUrl.trim().length === 0) {
      throw new Error('DATABASE_URL is required when SESSION_STORE=postgres');
    }

    options.store = new PgSessionStore({
      pool: new Pool({ connectionString: databaseUrl }),
      tableName: 'staff_sessions',
      createTableIfMissing: true,
    });
  }

  return session(options);
}

export function staffSessionCookieOptions(config: ConfigService): {
  httpOnly: true;
  secure: boolean;
  sameSite: 'lax';
  path: '/';
} {
  return {
    httpOnly: true,
    secure: isProduction(config),
    sameSite: 'lax',
    path: '/',
  };
}
