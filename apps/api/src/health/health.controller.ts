import { Controller, Get, Header, HttpStatus, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { MediaService } from '../media/media.service';
import { runtimeEnvironment, runtimeReleaseId } from '../config/runtime-config';
import { RealtimeState, type RealtimeHealth } from '../realtime/realtime.state';
import { HealthService, type DatabaseHealth } from './health.service';

@Controller('health')
export class HealthController {
  public constructor(
    private readonly mediaService: MediaService,
    private readonly healthService: HealthService,
    private readonly realtimeState: RealtimeState,
    private readonly config: ConfigService,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  public async getHealth() {
    let database: DatabaseHealth = 'unavailable';
    let mediaStorage: 'ok' | 'unavailable' = 'unavailable';
    let realtime: RealtimeHealth = this.realtimeState.getHealth();

    try {
      database = await this.healthService.checkDatabase();
      await this.mediaService.checkStorage();
      mediaStorage = 'ok';
      realtime = this.realtimeState.getHealth();
      if (realtime === 'unavailable') {
        throw new Error('Realtime dependency is unavailable');
      }
      return {
        status: 'ok',
        service: 'room-service-api',
        environment: runtimeEnvironment(this.config),
        releaseId: runtimeReleaseId(this.config),
        dependencies: { database, mediaStorage, redis: realtime, realtime },
      };
    } catch (error) {
      throw new ServiceUnavailableException({
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        code: 'DEPENDENCY_UNAVAILABLE',
        error: 'Service Unavailable',
        message: 'A required service dependency is unavailable.',
        service: 'room-service-api',
        environment: runtimeEnvironment(this.config),
        releaseId: runtimeReleaseId(this.config),
        dependencies: { database, mediaStorage, redis: realtime, realtime },
        cause: error instanceof Error ? error.name : 'Unknown dependency error',
      });
    }
  }
}
