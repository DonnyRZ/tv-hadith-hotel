import { hash, argon2id } from 'argon2';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';

import { ApiException } from '../auth/api-exception';
import { STAFF_USER_REPOSITORY } from '../auth/auth.constants';
import { StaffUserEmailConflictError } from '../auth/in-memory-staff-user.repository';
import type { StaffUserRecord } from '../auth/auth.types';
import type {
  CreateStaffUserRecordInput,
  StaffUserRepository,
  UpdateStaffUserRecordInput,
} from '../auth/staff-user.repository';
import { PERMISSION_CODES, type PermissionCode } from '../rbac/rbac.types';
import type { CreateRoleDto } from './dto/create-role.dto';
import type { CreateStaffUserDto } from './dto/create-staff-user.dto';
import type { ResetStaffPasswordDto } from './dto/reset-staff-password.dto';
import type { UpdateStaffUserDto } from './dto/update-staff-user.dto';
import type { UpdateRoleDto as UpdateRoleInputDto } from './dto/update-role.dto';
import type {
  CreateManagedRoleInput,
  ManagedRoleRecord,
  UpdateManagedRoleInput,
} from './management.types';
import { ManagedRoleCodeConflictError, ROLE_REPOSITORY } from './role.repository';
import type { StaffRoleRepository } from './role.repository';

export interface ManagedUserResponse {
  id: string;
  email: string;
  displayName: string;
  roles: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ManagedRoleResponse extends ManagedRoleRecord {
  userCount: number;
}

function uniquePermissions(permissions: readonly PermissionCode[]): PermissionCode[] {
  return [...new Set(permissions)];
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof StaffUserEmailConflictError ||
    (typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === '23505')
  );
}

@Injectable()
export class ManagementService {
  public constructor(
    @Inject(STAFF_USER_REPOSITORY)
    private readonly staffUserRepository: StaffUserRepository,
    @Inject(ROLE_REPOSITORY)
    private readonly roleRepository: StaffRoleRepository,
  ) {}

  public async listUsers(): Promise<{ items: ManagedUserResponse[] }> {
    const users = await this.staffUserRepository.listAll();
    return { items: users.map((user) => this.toManagedUser(user)) };
  }

  public async createUser(input: CreateStaffUserDto): Promise<ManagedUserResponse> {
    const roles = await this.resolveRoles(input.roles);
    const passwordHash = await hash(input.password, { type: argon2id });
    const recordInput: CreateStaffUserRecordInput = {
      email: input.email,
      displayName: input.displayName,
      passwordHash,
      roles: roles.map((role) => role.code),
      permissions: uniquePermissions(roles.flatMap((role) => role.permissions)),
      active: input.active ?? true,
    };

    try {
      const created = await this.staffUserRepository.createUser(recordInput);
      return this.toManagedUser(created);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ApiException(HttpStatus.CONFLICT, {
          code: 'STAFF_EMAIL_CONFLICT',
          message: 'A staff user with this email already exists.',
        });
      }
      throw error;
    }
  }

  public async updateUser(
    id: string,
    input: UpdateStaffUserDto,
    actorId: string,
  ): Promise<ManagedUserResponse> {
    const existing = await this.requireUser(id);
    const roles = input.roles === undefined ? undefined : await this.resolveRoles(input.roles);
    const nextRoles = roles?.map((role) => role.code) ?? existing.roles;
    const nextActive = input.active ?? existing.active;
    this.assertNoSelfLockout(existing, nextRoles, nextActive, actorId);
    await this.assertSuperadminContinuity(existing, nextRoles, nextActive);

    const update: UpdateStaffUserRecordInput = {
      ...(input.email === undefined ? {} : { email: input.email }),
      ...(input.displayName === undefined ? {} : { displayName: input.displayName }),
      ...(roles === undefined
        ? {}
        : {
            roles: nextRoles,
            permissions: uniquePermissions(roles.flatMap((role) => role.permissions)),
          }),
      ...(input.active === undefined ? {} : { active: input.active }),
    };

    try {
      const updated = await this.staffUserRepository.updateUser(id, update);
      if (updated === null) {
        throw this.notFound('STAFF_USER_NOT_FOUND', 'The requested staff user does not exist.');
      }
      return this.toManagedUser(updated);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ApiException(HttpStatus.CONFLICT, {
          code: 'STAFF_EMAIL_CONFLICT',
          message: 'A staff user with this email already exists.',
        });
      }
      throw error;
    }
  }

  public async setUserActive(
    id: string,
    active: boolean,
    actorId: string,
  ): Promise<ManagedUserResponse> {
    const existing = await this.requireUser(id);
    this.assertNoSelfLockout(existing, existing.roles, active, actorId);
    await this.assertSuperadminContinuity(existing, existing.roles, active);
    const updated = await this.staffUserRepository.setUserActive(id, active);
    if (updated === null) {
      throw this.notFound('STAFF_USER_NOT_FOUND', 'The requested staff user does not exist.');
    }
    return this.toManagedUser(updated);
  }

  public async resetPassword(
    id: string,
    input: ResetStaffPasswordDto,
  ): Promise<ManagedUserResponse> {
    await this.requireUser(id);
    const passwordHash = await hash(input.password, { type: argon2id });
    const updated = await this.staffUserRepository.updatePassword(id, passwordHash);
    if (updated === null) {
      throw this.notFound('STAFF_USER_NOT_FOUND', 'The requested staff user does not exist.');
    }
    return this.toManagedUser(updated);
  }

  public async listRoles(): Promise<{ items: ManagedRoleResponse[] }> {
    const [roles, users] = await Promise.all([
      this.roleRepository.listAll(),
      this.staffUserRepository.listAll(),
    ]);
    return {
      items: roles.map((role) => this.toManagedRole(role, users)),
    };
  }

  public async createRole(input: CreateRoleDto): Promise<ManagedRoleResponse> {
    const roleInput: CreateManagedRoleInput = {
      code: input.code,
      name: input.name,
      description: input.description,
      permissions: this.normalizePermissions(input.permissions),
    };

    try {
      const role = await this.roleRepository.create(roleInput);
      return this.toManagedRole(role, await this.staffUserRepository.listAll());
    } catch (error) {
      if (error instanceof ManagedRoleCodeConflictError || isUniqueViolation(error)) {
        throw new ApiException(HttpStatus.CONFLICT, {
          code: 'ROLE_CODE_CONFLICT',
          message: 'A role with this code already exists.',
        });
      }
      throw error;
    }
  }

  public async updateRole(id: string, input: UpdateRoleInputDto): Promise<ManagedRoleResponse> {
    const existing = await this.roleRepository.findById(id);
    if (existing === null) {
      throw this.notFound('ROLE_NOT_FOUND', 'The requested role does not exist.');
    }
    if (existing.system) {
      throw new ApiException(HttpStatus.CONFLICT, {
        code: 'SYSTEM_ROLE_PROTECTED',
        message: 'System roles are protected and cannot be edited.',
      });
    }

    const update: UpdateManagedRoleInput = {
      ...(input.name === undefined ? {} : { name: input.name }),
      ...(input.description === undefined ? {} : { description: input.description }),
      ...(input.permissions === undefined
        ? {}
        : { permissions: this.normalizePermissions(input.permissions) }),
    };
    const updated = await this.roleRepository.update(id, update);
    if (updated === null) {
      throw this.notFound('ROLE_NOT_FOUND', 'The requested role does not exist.');
    }
    await this.recalculatePermissionsForRole(updated.code);
    return this.toManagedRole(updated, await this.staffUserRepository.listAll());
  }

  public async deleteRole(id: string): Promise<ManagedRoleResponse> {
    const existing = await this.roleRepository.findById(id);
    if (existing === null) {
      throw this.notFound('ROLE_NOT_FOUND', 'The requested role does not exist.');
    }
    if (existing.system) {
      throw new ApiException(HttpStatus.CONFLICT, {
        code: 'SYSTEM_ROLE_PROTECTED',
        message: 'System roles are protected and cannot be deleted.',
      });
    }

    const users = await this.staffUserRepository.listAll();
    if (users.some((user) => user.roles.includes(existing.code))) {
      throw new ApiException(HttpStatus.CONFLICT, {
        code: 'ROLE_ASSIGNED',
        message: 'The role cannot be deleted while it is assigned to a staff user.',
      });
    }
    const deleted = await this.roleRepository.delete(id);
    if (deleted === null) {
      throw this.notFound('ROLE_NOT_FOUND', 'The requested role does not exist.');
    }
    return this.toManagedRole(deleted, users);
  }

  private async requireUser(id: string): Promise<StaffUserRecord> {
    const user = await this.staffUserRepository.findByIdForManagement(id);
    if (user === null) {
      throw this.notFound('STAFF_USER_NOT_FOUND', 'The requested staff user does not exist.');
    }
    return user;
  }

  private async resolveRoles(roleCodes: readonly string[]): Promise<ManagedRoleRecord[]> {
    const normalizedCodes = [...new Set(roleCodes.map((role) => role.trim().toUpperCase()))];
    const roles = await Promise.all(
      normalizedCodes.map((code) => this.roleRepository.findByCode(code)),
    );
    const missingCodes = normalizedCodes.filter((_, index) => roles[index] === null);
    if (missingCodes.length > 0) {
      throw new ApiException(HttpStatus.BAD_REQUEST, {
        code: 'INVALID_ROLE_ASSIGNMENT',
        message: 'One or more selected roles do not exist.',
        details: missingCodes.map((code) => ({ field: 'roles', message: `Unknown role: ${code}` })),
      });
    }
    return roles.filter((role): role is ManagedRoleRecord => role !== null);
  }

  private normalizePermissions(permissions: readonly string[]): PermissionCode[] {
    const allowed = new Set<string>(PERMISSION_CODES);
    const normalized = [...new Set(permissions)];
    if (normalized.some((permission) => !allowed.has(permission))) {
      throw new ApiException(HttpStatus.BAD_REQUEST, {
        code: 'INVALID_PERMISSION',
        message: 'One or more selected permissions are not valid.',
      });
    }
    return normalized as PermissionCode[];
  }

  private async recalculatePermissionsForRole(roleCode: string): Promise<void> {
    const users = await this.staffUserRepository.listAll();
    for (const user of users.filter((candidate) => candidate.roles.includes(roleCode))) {
      const roles = await this.resolveRoles(user.roles);
      await this.staffUserRepository.updateUser(user.id, {
        permissions: uniquePermissions(roles.flatMap((role) => role.permissions)),
      });
    }
  }

  private async assertSuperadminContinuity(
    target: StaffUserRecord,
    nextRoles: readonly string[],
    nextActive: boolean,
  ): Promise<void> {
    if (!target.active || !target.roles.includes('SUPERADMIN')) {
      return;
    }
    const activeSuperadmins = (await this.staffUserRepository.listAll()).filter(
      (user) => user.active && user.roles.includes('SUPERADMIN'),
    );
    const remainsSuperadmin = nextActive && nextRoles.includes('SUPERADMIN');
    if (activeSuperadmins.length <= 1 && !remainsSuperadmin) {
      throw new ApiException(HttpStatus.CONFLICT, {
        code: 'LAST_SUPERADMIN',
        message: 'At least one active Superadmin must remain.',
      });
    }
  }

  private assertNoSelfLockout(
    target: StaffUserRecord,
    nextRoles: readonly string[],
    nextActive: boolean,
    actorId: string,
  ): void {
    if (target.id === actorId && (!nextActive || !nextRoles.includes('SUPERADMIN'))) {
      throw new ApiException(HttpStatus.CONFLICT, {
        code: 'SELF_LOCKOUT',
        message: 'You cannot remove your own active Superadmin access.',
      });
    }
  }

  private toManagedUser(user: StaffUserRecord): ManagedUserResponse {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      roles: [...user.roles],
      active: user.active,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private toManagedRole(
    role: ManagedRoleRecord,
    users: readonly StaffUserRecord[],
  ): ManagedRoleResponse {
    return {
      ...role,
      permissions: [...role.permissions],
      userCount: users.filter((user) => user.roles.includes(role.code)).length,
    };
  }

  private notFound(code: string, message: string): ApiException {
    return new ApiException(HttpStatus.NOT_FOUND, { code, message });
  }
}
