import { SetMetadata } from '@nestjs/common';

import type { PermissionCode } from '../../rbac/rbac.types';

export const REQUIRED_PERMISSIONS_KEY = Symbol('required_permissions');

export const RequirePermissions = (...permissions: PermissionCode[]) =>
  SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions);
