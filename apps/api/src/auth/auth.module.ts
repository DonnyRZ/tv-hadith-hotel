import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AuthController } from './auth.controller';
import { STAFF_USER_REPOSITORY } from './auth.constants';
import { AuthService } from './auth.service';
import { InMemoryStaffUserRepository } from './in-memory-staff-user.repository';
import { PermissionsGuard } from './guards/permissions.guard';
import { RolesGuard } from './guards/roles.guard';
import { StaffSessionGuard } from './guards/staff-session.guard';
import { PostgresStaffUserRepository } from './postgres-staff-user.repository';
import type { StaffUserRepository } from './staff-user.repository';

@Module({
  imports: [ConfigModule],
  controllers: [AuthController],
  providers: [
    {
      provide: STAFF_USER_REPOSITORY,
      inject: [ConfigService],
      useFactory: (config: ConfigService): StaffUserRepository => {
        const store =
          config.get<string>('AUTH_STORE') ??
          (config.get<string>('NODE_ENV') === 'production' ? 'postgres' : 'memory');
        return store === 'postgres'
          ? new PostgresStaffUserRepository(config)
          : new InMemoryStaffUserRepository(config);
      },
    },
    AuthService,
    StaffSessionGuard,
    PermissionsGuard,
    RolesGuard,
  ],
  exports: [AuthService, StaffSessionGuard, PermissionsGuard, RolesGuard, STAFF_USER_REPOSITORY],
})
export class AuthModule {}
