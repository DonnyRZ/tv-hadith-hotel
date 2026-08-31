import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AuthModule } from './auth/auth.module';
import { GuestModule } from './guest/guest.module';
import { HealthModule } from './health/health.module';
import { ManagementModule } from './management/management.module';
import { MenuModule } from './menu/menu.module';
import { ReceptionistModule } from './receptionist/receptionist.module';
import { RequestModule } from './requests/request.module';
import { TvModule } from './tv/tv.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    GuestModule,
    HealthModule,
    ManagementModule,
    MenuModule,
    ReceptionistModule,
    RequestModule,
    TvModule,
  ],
})
export class AppModule {}
