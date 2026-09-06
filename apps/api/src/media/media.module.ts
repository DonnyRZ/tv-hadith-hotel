import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AuthModule } from '../auth/auth.module';
import { MediaController } from './media.controller';
import {
  InMemoryMediaRepository,
  MEDIA_REPOSITORY,
  PostgresMediaRepository,
} from './media.repository';
import type { MediaRepository } from './media.repository';
import { MediaService } from './media.service';

@Module({
  imports: [AuthModule, ConfigModule],
  controllers: [MediaController],
  providers: [
    MediaService,
    {
      provide: MEDIA_REPOSITORY,
      inject: [ConfigService],
      useFactory: (config: ConfigService): MediaRepository => {
        const store =
          config.get<string>('AUTH_STORE') ??
          (config.get<string>('NODE_ENV') === 'production' ? 'postgres' : 'memory');
        return store === 'postgres'
          ? new PostgresMediaRepository(config)
          : new InMemoryMediaRepository();
      },
    },
  ],
  exports: [MediaService, MEDIA_REPOSITORY],
})
export class MediaModule {}
