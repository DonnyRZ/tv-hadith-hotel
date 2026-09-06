import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AuthModule } from '../auth/auth.module';
import { BoutiqueModule } from '../boutique/boutique.module';
import {
  BoutiqueReservationExpiryController,
  RequestController,
  RoomManagerRequestController,
} from './request.controller';
import {
  InMemoryRequestRepository,
  PostgresRequestRepository,
  REQUEST_REPOSITORY,
} from './request.repository';
import { RequestService } from './request.service';
import { BoutiqueReservationExpiryWorker } from './boutique-reservation-expiry.worker';
import { InternalWorkerGuard } from './internal-worker.guard';

@Module({
  imports: [AuthModule, ConfigModule, BoutiqueModule],
  controllers: [
    RequestController,
    BoutiqueReservationExpiryController,
    RoomManagerRequestController,
  ],
  providers: [
    RequestService,
    BoutiqueReservationExpiryWorker,
    InternalWorkerGuard,
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
