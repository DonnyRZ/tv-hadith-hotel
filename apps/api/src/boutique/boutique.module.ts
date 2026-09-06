import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AuthModule } from '../auth/auth.module';
import { MenuModule } from '../menu/menu.module';
import { MENU_REPOSITORY } from '../menu/menu.repository';
import type { MenuRepository } from '../menu/menu.repository';
import { BoutiqueController } from './boutique.controller';
import {
  BOUTIQUE_REPOSITORY,
  InMemoryBoutiqueRepository,
  PostgresBoutiqueRepository,
} from './boutique.repository';
import { BoutiqueService } from './boutique.service';

@Module({
  imports: [AuthModule, ConfigModule, MenuModule],
  controllers: [BoutiqueController],
  providers: [
    BoutiqueService,
    {
      provide: BOUTIQUE_REPOSITORY,
      inject: [ConfigService, MENU_REPOSITORY],
      useFactory: (config: ConfigService, menuRepository: MenuRepository) => {
        const store =
          config.get<string>('AUTH_STORE') ??
          (config.get<string>('NODE_ENV') === 'production' ? 'postgres' : 'memory');
        return store === 'postgres'
          ? new PostgresBoutiqueRepository(config, menuRepository)
          : new InMemoryBoutiqueRepository(menuRepository);
      },
    },
  ],
  exports: [BoutiqueService, BOUTIQUE_REPOSITORY],
})
export class BoutiqueModule {}
