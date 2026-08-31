import { randomUUID } from 'node:crypto';

import { argon2id, hash } from 'argon2';
import type { ConfigService } from '@nestjs/config';

import type { StaffUserRecord } from './auth.types';
import {
  isPermissionCode,
  isRoleCode,
  mergeRolePermissions,
  type PermissionCode,
  type RoleCode,
} from '../rbac/rbac.types';

export interface SeedStaffUser {
  id?: string;
  email: string;
  displayName: string;
  roles: RoleCode[];
  password?: string;
  passwordHash?: string;
  permissions?: PermissionCode[];
  active?: boolean;
}

const TEST_SEED_USERS: readonly SeedStaffUser[] = [
  {
    email: 'superadmin@hadith-hotel.com',
    displayName: 'Donny',
    roles: ['SUPERADMIN'],
    password: 'password',
  },
  {
    email: 'room-manager@hadith-hotel.com',
    displayName: 'Rina Room Manager',
    roles: ['ROOM_MANAGER'],
    password: 'password',
  },
  {
    email: 'receptionist@hadith-hotel.com',
    displayName: 'Siti Receptionist',
    roles: ['RECEPTIONIST'],
    password: 'password',
  },
  {
    email: 'spa@hadith-hotel.com',
    displayName: 'Dewi SPA',
    roles: ['SPA'],
    password: 'password',
  },
  {
    email: 'restaurant@hadith-hotel.com',
    displayName: 'Restaurant Team',
    roles: ['RESTAURANT'],
    password: 'password',
  },
  {
    email: 'lounge@hadith-hotel.com',
    displayName: 'Lounge Team',
    roles: ['LOUNGE'],
    password: 'password',
  },
  {
    email: 'housekeeping@hadith-hotel.com',
    displayName: 'Agus Housekeeping',
    roles: ['HOUSEKEEPING'],
    password: 'password',
  },
  {
    email: 'beauty-and-salon@hadith-hotel.com',
    displayName: 'Maya Beauty & Salon',
    roles: ['BEAUTY_AND_SALON'],
    password: 'password',
  },
  {
    email: 'cafe@hadith-hotel.com',
    displayName: 'Rafi Cafe',
    roles: ['CAFE'],
    password: 'password',
  },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readRequiredString(value: unknown, field: string, index: number): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`STAFF_SEED_USERS_JSON[${index}].${field} must be a non-empty string`);
  }

  return value.trim();
}

function readRequiredEmail(value: unknown, index: number): string {
  const email = readRequiredString(value, 'email', index);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error(`STAFF_SEED_USERS_JSON[${index}].email must be a valid email address`);
  }

  return email.toLowerCase();
}

function readRoles(value: unknown, index: number): RoleCode[] {
  if (!Array.isArray(value) || value.length === 0 || value.some((role) => !isRoleCode(role))) {
    throw new Error(`STAFF_SEED_USERS_JSON[${index}].roles contains an invalid role`);
  }

  return [...new Set(value)] as RoleCode[];
}

function readPermissions(value: unknown, index: number): PermissionCode[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value) || value.some((permission) => !isPermissionCode(permission))) {
    throw new Error(`STAFF_SEED_USERS_JSON[${index}].permissions contains an invalid permission`);
  }

  return [...new Set(value)] as PermissionCode[];
}

function parseConfiguredUsers(raw: string): SeedStaffUser[] {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error('STAFF_SEED_USERS_JSON must contain valid JSON');
  }

  if (!Array.isArray(parsed)) {
    throw new Error('STAFF_SEED_USERS_JSON must be an array');
  }

  return parsed.map((value, index) => {
    if (!isRecord(value)) {
      throw new Error(`STAFF_SEED_USERS_JSON[${index}] must be an object`);
    }

    const password = typeof value.password === 'string' ? value.password : undefined;
    const passwordHash = typeof value.passwordHash === 'string' ? value.passwordHash : undefined;

    if (password === undefined && passwordHash === undefined) {
      throw new Error(`STAFF_SEED_USERS_JSON[${index}] requires password or passwordHash`);
    }

    if (password !== undefined && password.length === 0) {
      throw new Error(`STAFF_SEED_USERS_JSON[${index}].password must not be empty`);
    }

    const seed: SeedStaffUser = {
      email: readRequiredEmail(value.email, index),
      displayName: readRequiredString(value.displayName, 'displayName', index),
      roles: readRoles(value.roles, index),
      active: value.active === undefined ? true : value.active === true,
    };

    if (typeof value.id === 'string') {
      seed.id = value.id;
    }
    if (password !== undefined) {
      seed.password = password;
    }
    if (passwordHash !== undefined) {
      seed.passwordHash = passwordHash;
    }

    const permissions = readPermissions(value.permissions, index);
    if (permissions !== undefined) {
      seed.permissions = permissions;
    }

    return seed;
  });
}

export function loadSeedUsers(config: ConfigService): readonly SeedStaffUser[] {
  const configuredUsers = config.get<string>('STAFF_SEED_USERS_JSON');

  if (configuredUsers !== undefined && configuredUsers.trim().length > 0) {
    return parseConfiguredUsers(configuredUsers);
  }

  if (config.get<string>('NODE_ENV') === 'test') {
    return TEST_SEED_USERS;
  }

  return [];
}

export async function buildStaffUserRecord(seed: SeedStaffUser): Promise<StaffUserRecord> {
  const passwordHash =
    seed.passwordHash ?? (await hash(seed.password as string, { type: argon2id }));
  const now = new Date().toISOString();

  return {
    id: seed.id ?? randomUUID(),
    email: seed.email.toLowerCase(),
    displayName: seed.displayName,
    passwordHash,
    roles: seed.roles,
    permissions: mergeRolePermissions(seed.roles, seed.permissions),
    active: seed.active ?? true,
    createdAt: now,
    updatedAt: now,
  };
}
