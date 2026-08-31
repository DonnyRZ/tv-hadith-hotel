import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AuthModule } from '../auth/auth.module';
import { MenuModule } from '../menu/menu.module';
import { ReceptionistModule } from '../receptionist/receptionist.module';
import { RequestModule } from '../requests/request.module';
import { TvModule } from '../tv/tv.module';
import {
  InMemoryGuestQrTokenRepository,
  GUEST_QR_TOKEN_REPOSITORY,
  PostgresGuestQrTokenRepository,
} from './guest-qr.repository';
import { GuestContextGuard } from './guest-context.guard';
import { GuestContextResolver } from './guest-context.resolver';
import { GuestController, GuestQrBatchController, GuestQrController } from './guest.controller';
import { readGuestDevelopmentFixture } from './guest-dev-fixtures';
import { GuestQrService } from './guest-qr.service';
import { GuestService } from './guest.service';

@Module({
  imports: [ConfigModule, AuthModule, MenuModule, ReceptionistModule, RequestModule, TvModule],
  controllers: [GuestController, GuestQrController, GuestQrBatchController],
  providers: [
    {
      provide: GUEST_QR_TOKEN_REPOSITORY,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const store =
          config.get<string>('AUTH_STORE') ??
          (config.get<string>('NODE_ENV') === 'production' ? 'postgres' : 'memory');
        return store === 'postgres'
          ? new PostgresGuestQrTokenRepository(config)
          : new InMemoryGuestQrTokenRepository(readGuestDevelopmentFixture(config));
      },
    },
    GuestContextResolver,
    GuestContextGuard,
    GuestQrService,
    GuestService,
  ],
  exports: [GuestContextResolver, GuestContextGuard, GuestQrService, GUEST_QR_TOKEN_REPOSITORY],
})
export class GuestModule {}
