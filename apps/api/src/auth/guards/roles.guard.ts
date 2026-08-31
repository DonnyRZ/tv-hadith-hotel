import { Reflector } from '@nestjs/core';
import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';

import { ApiException } from '../api-exception';
import type { StaffRequest } from '../auth.types';
import { REQUIRED_ROLES_KEY } from '../decorators/require-roles.decorator';
import type { RoleCode } from '../../rbac/rbac.types';

@Injectable()
export class RolesGuard implements CanActivate {
  public constructor(private readonly reflector: Reflector) {}

  public canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<RoleCode[]>(REQUIRED_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (requiredRoles === undefined || requiredRoles.length === 0) {
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

    if (!requiredRoles.some((role) => staffUser.roles.includes(role))) {
      throw new ApiException(HttpStatus.FORBIDDEN, {
        code: 'FORBIDDEN',
        message: 'The authenticated staff role cannot access this resource.',
      });
    }

    return true;
  }
}
