import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AuthModule } from './auth/auth.module';
import { BoutiqueModule } from './boutique/boutique.module';
import { validateRuntimeConfig } from './config/runtime-config';
import { GuestModule } from './guest/guest.module';
import { HealthModule } from './health/health.module';
import { ManagementModule } from './management/management.module';
import { MediaModule } from './media/media.module';
import { MenuModule } from './menu/menu.module';
import { ReceptionistModule } from './receptionist/receptionist.module';
import { RealtimeModule } from './realtime/realtime.module';
import { RequestModule } from './requests/request.module';
import { TvModule } from './tv/tv.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateRuntimeConfig }),
    AuthModule,
    BoutiqueModule,
    GuestModule,
    HealthModule,
    ManagementModule,
    MediaModule,
    MenuModule,
    ReceptionistModule,
    RealtimeModule,
    RequestModule,
    TvModule,
  ],
})
export class AppModule {}
