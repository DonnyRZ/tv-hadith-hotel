import { Reflector } from '@nestjs/core';
import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';

import { ApiException } from '../api-exception';
import type { StaffRequest } from '../auth.types';
import { REQUIRED_PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import type { PermissionCode } from '../../rbac/rbac.types';

@Injectable()
export class PermissionsGuard implements CanActivate {
  public constructor(private readonly reflector: Reflector) {}

  public canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<PermissionCode[]>(
      REQUIRED_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (requiredPermissions === undefined || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<StaffRequest>();
    const staffUser = request.staffUser;

    if (staffUser === undefined) {
      throw new ApiException(HttpStatus.UNAUTHORIZED, {
        code: 'UNAUTHORIZED',
        message: 'Staff session is missing or invalid.',
      });
    }

    const hasAllPermissions = requiredPermissions.every((permission) =>
      staffUser.permissions.includes(permission),
    );

    if (!hasAllPermissions) {
      throw new ApiException(HttpStatus.FORBIDDEN, {
        code: 'FORBIDDEN',
        message: 'The authenticated staff role cannot access this resource.',
      });
    }

    return true;
  }
}
