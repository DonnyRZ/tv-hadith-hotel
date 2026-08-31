import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AuthModule } from '../auth/auth.module';
import { ReceptionistModule } from '../receptionist/receptionist.module';
import { InMemoryTvDeviceRepository } from './in-memory-tv-device.repository';
import { PostgresTvDeviceRepository } from './postgres-tv-device.repository';
import { TV_DEVICE_REPOSITORY } from './tv-device.repository';
import { ReceptionistTvDevicesController, TvController } from './tv.controller';
import { TvRealtimeGateway } from './tv.realtime.gateway';
import { TvService } from './tv.service';
import { TvAssignmentEventBridge } from './tv.assignment-event-bridge';

@Module({
  imports: [ConfigModule, AuthModule, ReceptionistModule],
  controllers: [TvController, ReceptionistTvDevicesController],
  providers: [
    {
      provide: TV_DEVICE_REPOSITORY,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const store =
          config.get<string>('AUTH_STORE') ??
          (config.get<string>('NODE_ENV') === 'production' ? 'postgres' : 'memory');
        return store === 'postgres'
          ? new PostgresTvDeviceRepository(config)
          : new InMemoryTvDeviceRepository();
      },
    },
    TvService,
    TvRealtimeGateway,
    TvAssignmentEventBridge,
  ],
  exports: [TvService, TvRealtimeGateway],
})
export class TvModule {}
