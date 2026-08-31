import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AuthModule } from '../auth/auth.module';
import { RequestController, RoomManagerRequestController } from './request.controller';
import {
  InMemoryRequestRepository,
  PostgresRequestRepository,
  REQUEST_REPOSITORY,
} from './request.repository';
import { RequestService } from './request.service';

@Module({
  imports: [AuthModule, ConfigModule],
  controllers: [RequestController, RoomManagerRequestController],
  providers: [
    RequestService,
    {
      provide: REQUEST_REPOSITORY,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const store =
          config.get<string>('AUTH_STORE') ??
          (config.get<string>('NODE_ENV') === 'production' ? 'postgres' : 'memory');
        return store === 'postgres'
          ? new PostgresRequestRepository(config)
          : new InMemoryRequestRepository();
      },
    },
  ],
  exports: [RequestService, REQUEST_REPOSITORY],
})
export class RequestModule {}
