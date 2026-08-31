import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AuthModule } from '../auth/auth.module';
import {
  InMemoryReceptionistRepository,
  PostgresReceptionistRepository,
  RECEPTIONIST_REPOSITORY,
} from './receptionist.repository';
import { ReceptionistController } from './receptionist.controller';
import { ReceptionistService } from './receptionist.service';
import { RoomAssignmentEventBus } from './room-assignment-events';

@Module({
  imports: [AuthModule, ConfigModule],
  controllers: [ReceptionistController],
  providers: [
    RoomAssignmentEventBus,
    ReceptionistService,
    {
      provide: RECEPTIONIST_REPOSITORY,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const store =
          config.get<string>('AUTH_STORE') ??
          (config.get<string>('NODE_ENV') === 'production' ? 'postgres' : 'memory');
        return store === 'postgres'
          ? new PostgresReceptionistRepository(config)
          : new InMemoryReceptionistRepository();
      },
    },
  ],
  exports: [RECEPTIONIST_REPOSITORY, ReceptionistService, RoomAssignmentEventBus],
})
export class ReceptionistModule {}
