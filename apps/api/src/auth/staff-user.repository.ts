import type { StaffUserRecord } from './auth.types';
import type { PermissionCode } from '../rbac/rbac.types';

export interface CreateStaffUserRecordInput {
  email: string;
  displayName: string;
  passwordHash: string;
  roles: string[];
  permissions: PermissionCode[];
  active: boolean;
}

export interface UpdateStaffUserRecordInput {
  email?: string;
  displayName?: string;
  roles?: string[];
  permissions?: PermissionCode[];
  active?: boolean;
}

export interface StaffUserRepository {
  findByEmail(email: string): Promise<StaffUserRecord | null>;
  findById(id: string): Promise<StaffUserRecord | null>;
  listAll(): Promise<StaffUserRecord[]>;
  findByIdForManagement(id: string): Promise<StaffUserRecord | null>;
  createUser(input: CreateStaffUserRecordInput): Promise<StaffUserRecord>;
  updateUser(id: string, input: UpdateStaffUserRecordInput): Promise<StaffUserRecord | null>;
  setUserActive(id: string, active: boolean): Promise<StaffUserRecord | null>;
  updatePassword(id: string, passwordHash: string): Promise<StaffUserRecord | null>;
}
