import type { PermissionCode } from '../rbac/rbac.types';

export interface ManagedRoleRecord {
  id: string;
  code: string;
  name: string;
  description: string;
  system: boolean;
  permissions: PermissionCode[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateManagedRoleInput {
  code: string;
  name: string;
  description: string;
  permissions: PermissionCode[];
}

export interface UpdateManagedRoleInput {
  name?: string;
  description?: string;
  permissions?: PermissionCode[];
}
