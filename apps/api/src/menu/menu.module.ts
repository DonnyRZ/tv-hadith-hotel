import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AuthModule } from '../auth/auth.module';
import { MenuController } from './menu.controller';
import { InMemoryMenuRepository, MENU_REPOSITORY, PostgresMenuRepository } from './menu.repository';
import { MenuService } from './menu.service';

@Module({
  imports: [AuthModule, ConfigModule],
  controllers: [MenuController],
  providers: [
    MenuService,
    {
      provide: MENU_REPOSITORY,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const store =
          config.get<string>('AUTH_STORE') ??
          (config.get<string>('NODE_ENV') === 'production' ? 'postgres' : 'memory');
        return store === 'postgres'
          ? new PostgresMenuRepository(config)
          : new InMemoryMenuRepository();
      },
    },
  ],
  exports: [MenuService, MENU_REPOSITORY],
})
export class MenuModule {}
