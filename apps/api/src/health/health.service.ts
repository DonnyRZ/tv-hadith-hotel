import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';

export type DatabaseHealth = 'ok' | 'memory' | 'unavailable';

@Injectable()
export class HealthService implements OnModuleDestroy {
  private readonly databasePool: Pool | null;

  public constructor(config: ConfigService) {
    const store =
      config.get<string>('AUTH_STORE') ??
      (config.get<string>('NODE_ENV') === 'production' ? 'postgres' : 'memory');
    this.databasePool =
      store === 'postgres'
        ? new Pool({ connectionString: config.get<string>('DATABASE_URL') })
        : null;
  }

  public async checkDatabase(): Promise<DatabaseHealth> {
    if (this.databasePool === null) return 'memory';
    await this.databasePool.query('SELECT 1');
    return 'ok';
  }

  public async onModuleDestroy(): Promise<void> {
    await this.databasePool?.end();
  }
}
