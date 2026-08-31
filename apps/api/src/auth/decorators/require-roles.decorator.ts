import { SetMetadata } from '@nestjs/common';

import type { RoleCode } from '../../rbac/rbac.types';

export const REQUIRED_ROLES_KEY = Symbol('required_roles');

export const RequireRoles = (...roles: RoleCode[]) => SetMetadata(REQUIRED_ROLES_KEY, roles);
