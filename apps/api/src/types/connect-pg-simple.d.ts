declare module 'connect-pg-simple' {
  import type { Store } from 'express-session';
  import type { Pool } from 'pg';

  interface ConnectPgSimpleOptions {
    pool: Pool;
    tableName?: string;
    createTableIfMissing?: boolean;
  }

  type SessionStoreConstructor = new (options: ConnectPgSimpleOptions) => Store;

  function connectPgSimple(
    sessionMiddleware: typeof import('express-session'),
  ): SessionStoreConstructor;

  export = connectPgSimple;
}
