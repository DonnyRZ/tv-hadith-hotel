import { Global, Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { RealtimeState } from './realtime.state';
import { StaffRealtimeGateway } from './staff-realtime.gateway';
import { StaffRealtimePublisher } from './staff-realtime.publisher';

@Global()
@Module({
  imports: [AuthModule],
  providers: [RealtimeState, StaffRealtimeGateway, StaffRealtimePublisher],
  exports: [RealtimeState, StaffRealtimeGateway, StaffRealtimePublisher],
})
export class RealtimeModule {}
