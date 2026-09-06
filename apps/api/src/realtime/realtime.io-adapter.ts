import type { INestApplication } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import type { RequestHandler } from 'express';
import type { Server as SocketIoServer, ServerOptions } from 'socket.io';

import { RealtimeState } from './realtime.state';

type RedisClient = ReturnType<typeof createClient>;

export function readBoolean(value: string | undefined): boolean {
  return value === '1' || value?.toLowerCase() === 'true' || value?.toLowerCase() === 'yes';
}

export function realtimeEnabled(config: ConfigService): boolean {
  const configured = config.get<string>('STAFF_REALTIME_ENABLED')?.trim();
  if (configured !== undefined && configured.length > 0) return readBoolean(configured);
  return config.get<string>('NODE_ENV') !== 'test';
}

export class RealtimeIoAdapter extends IoAdapter {
  private adapterFactory: ReturnType<typeof createAdapter> | null = null;
  private publisher: RedisClient | null = null;
  private subscriber: RedisClient | null = null;

  public constructor(
    app: INestApplication,
    private readonly config: ConfigService,
    private readonly state: RealtimeState,
    private readonly staffSessionMiddleware: RequestHandler,
  ) {
    super(app);
  }

  public async initialize(): Promise<void> {
    const enabled = realtimeEnabled(this.config);
    this.state.configure(enabled);
    if (!enabled) return;

    const redisUrl = this.config.get<string>('REDIS_URL')?.trim();
    const production = this.config.get<string>('NODE_ENV') === 'production';
    if (redisUrl === undefined || redisUrl.length === 0) {
      if (production) throw new Error('REDIS_URL is required when Staff realtime is enabled');
      this.state.setHealth('memory');
      return;
    }

    const publisher = createClient({
      url: redisUrl,
      socket: { connectTimeout: 5_000, reconnectStrategy: () => false },
    });
    const subscriber = publisher.duplicate();
    const markRedisUnavailable = () => {
      if (production) this.state.setHealth('unavailable');
    };
    publisher.on('error', markRedisUnavailable);
    subscriber.on('error', markRedisUnavailable);
    this.publisher = publisher;
    this.subscriber = subscriber;

    try {
      await Promise.all([publisher.connect(), subscriber.connect()]);
      this.adapterFactory = createAdapter(publisher, subscriber);
      this.state.setHealth('ok');
    } catch (error) {
      publisher.destroy();
      subscriber.destroy();
      this.publisher = null;
      this.subscriber = null;
      this.state.setHealth('unavailable');
      if (production) {
        throw new Error(
          `Redis is required for Staff realtime in production: ${
            error instanceof Error ? error.message : 'connection failed'
          }`,
          { cause: error },
        );
      }
      this.state.setHealth('memory');
    }
  }

  public override createIOServer(port: number, options?: ServerOptions): SocketIoServer {
    const server = super.createIOServer(port, options) as SocketIoServer;

    if (this.adapterFactory !== null) server.adapter(this.adapterFactory);
    server.engine.use(
      this.staffSessionMiddleware as unknown as Parameters<typeof server.engine.use>[0],
    );
    return server;
  }

  public override async close(): Promise<void> {
    await Promise.allSettled([
      this.publisher?.isOpen === true ? this.publisher.quit() : Promise.resolve(),
      this.subscriber?.isOpen === true ? this.subscriber.quit() : Promise.resolve(),
    ]);
    this.publisher = null;
    this.subscriber = null;
  }
}
