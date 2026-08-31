import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AuthModule } from '../auth/auth.module';
import { ManagementController } from './management.controller';
import { ManagementService } from './management.service';
import {
  InMemoryStaffRoleRepository,
  PostgresStaffRoleRepository,
  ROLE_REPOSITORY,
} from './role.repository';

@Module({
  imports: [AuthModule, ConfigModule],
  controllers: [ManagementController],
  providers: [
    ManagementService,
    {
      provide: ROLE_REPOSITORY,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const store =
          config.get<string>('AUTH_STORE') ??
          (config.get<string>('NODE_ENV') === 'production' ? 'postgres' : 'memory');
        return store === 'postgres'
          ? new PostgresStaffRoleRepository(config)
          : new InMemoryStaffRoleRepository();
      },
    },
  ],
})
export class ManagementModule {}
