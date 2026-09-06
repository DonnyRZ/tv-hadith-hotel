import { Module } from '@nestjs/common';

import { ConfigModule } from '@nestjs/config';
import { MediaModule } from '../media/media.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  imports: [ConfigModule, MediaModule, RealtimeModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
