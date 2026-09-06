import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AuthController } from './auth.controller';
import { STAFF_SESSION_MIDDLEWARE, STAFF_USER_REPOSITORY } from './auth.constants';
import { AuthService } from './auth.service';
import { InMemoryStaffUserRepository } from './in-memory-staff-user.repository';
import { PermissionsGuard } from './guards/permissions.guard';
import { RolesGuard } from './guards/roles.guard';
import { StaffSessionGuard } from './guards/staff-session.guard';
import { PostgresStaffUserRepository } from './postgres-staff-user.repository';
import type { StaffUserRepository } from './staff-user.repository';
import { createStaffSessionMiddleware } from './session.middleware';

@Module({
  imports: [ConfigModule],
  controllers: [AuthController],
  providers: [
    {
      provide: STAFF_SESSION_MIDDLEWARE,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => createStaffSessionMiddleware(config),
    },
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
  exports: [
    AuthService,
    StaffSessionGuard,
    PermissionsGuard,
    RolesGuard,
    STAFF_USER_REPOSITORY,
    STAFF_SESSION_MIDDLEWARE,
  ],
})
export class AuthModule {}
