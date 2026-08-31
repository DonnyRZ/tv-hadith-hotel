import { randomUUID } from 'node:crypto';

import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';

import {
  isPermissionCode,
  ROLE_CODES,
  ROLE_PERMISSIONS,
  type PermissionCode,
} from '../rbac/rbac.types';
import type {
  CreateManagedRoleInput,
  ManagedRoleRecord,
  UpdateManagedRoleInput,
} from './management.types';

export const ROLE_REPOSITORY = Symbol('ROLE_REPOSITORY');

export class ManagedRoleCodeConflictError extends Error {
  public constructor() {
    super('A role with this code already exists.');
    this.name = 'ManagedRoleCodeConflictError';
  }
}

export class ManagedRoleNotFoundError extends Error {
  public constructor() {
    super('The requested role does not exist.');
    this.name = 'ManagedRoleNotFoundError';
  }
}

export interface StaffRoleRepository {
  listAll(): Promise<ManagedRoleRecord[]>;
  findById(id: string): Promise<ManagedRoleRecord | null>;
  findByCode(code: string): Promise<ManagedRoleRecord | null>;
  create(input: CreateManagedRoleInput): Promise<ManagedRoleRecord>;
  update(id: string, input: UpdateManagedRoleInput): Promise<ManagedRoleRecord | null>;
  delete(id: string): Promise<ManagedRoleRecord | null>;
}

interface SystemRoleMetadata {
  description: string;
  name: string;
}

export const SYSTEM_ROLE_METADATA: Readonly<
  Record<(typeof ROLE_CODES)[number], SystemRoleMetadata>
> = {
  SUPERADMIN: {
    name: 'Superadmin',
    description: 'Manages staff access, users, and role definitions.',
  },
  ROOM_MANAGER: {
    name: 'Room Manager',
    description: 'Monitors service requests across approved hotel units.',
  },
  RECEPTIONIST: {
    name: 'Receptionist',
    description: 'Manages guest-room assignment, checkout, and TV pairing.',
  },
  SPA: {
    name: 'SPA',
    description: 'Handles SPA service requests and manages the service catalog.',
  },
  RESTAURANT: {
    name: 'Restaurant',
    description: 'Handles restaurant service requests and menu operations.',
  },
  LOUNGE: {
    name: 'Lounge',
    description: 'Handles lounge service requests and menu operations.',
  },
  HOUSEKEEPING: {
    name: 'Housekeeping',
    description: 'Handles housekeeping service requests.',
  },
  BEAUTY_AND_SALON: {
    name: 'Beauty & Salon',
    description: 'Handles beauty and salon requests and manages the service catalog.',
  },
  CAFE: {
    name: 'Cafe',
    description: 'Handles cafe service requests and menu operations.',
  },
};

function now(): string {
  return new Date().toISOString();
}

function cloneRole(role: ManagedRoleRecord): ManagedRoleRecord {
  return { ...role, permissions: [...role.permissions] };
}

function buildSystemRoles(): ManagedRoleRecord[] {
  const timestamp = now();

  return ROLE_CODES.map((code) => ({
    id: code,
    code,
    name: SYSTEM_ROLE_METADATA[code].name,
    description: SYSTEM_ROLE_METADATA[code].description,
    system: true,
    permissions: [...ROLE_PERMISSIONS[code]],
    createdAt: timestamp,
    updatedAt: timestamp,
  }));
}

@Injectable()
export class InMemoryStaffRoleRepository implements StaffRoleRepository {
  private roles: ManagedRoleRecord[] = buildSystemRoles();

  public async listAll(): Promise<ManagedRoleRecord[]> {
    return this.roles.map(cloneRole);
  }

  public async findById(id: string): Promise<ManagedRoleRecord | null> {
    const role = this.roles.find((candidate) => candidate.id === id);
    return role === undefined ? null : cloneRole(role);
  }

  public async findByCode(code: string): Promise<ManagedRoleRecord | null> {
    const normalizedCode = code.trim().toUpperCase();
    const role = this.roles.find((candidate) => candidate.code === normalizedCode);
    return role === undefined ? null : cloneRole(role);
  }

  public async create(input: CreateManagedRoleInput): Promise<ManagedRoleRecord> {
    const code = input.code.trim().toUpperCase();
    if (this.roles.some((role) => role.code === code)) {
      throw new ManagedRoleCodeConflictError();
    }

    const timestamp = now();
    const role: ManagedRoleRecord = {
      id: randomUUID(),
      code,
      name: input.name.trim(),
      description: input.description.trim(),
      system: false,
      permissions: [...input.permissions],
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.roles.push(role);
    return cloneRole(role);
  }

  public async update(
    id: string,
    input: UpdateManagedRoleInput,
  ): Promise<ManagedRoleRecord | null> {
    const role = this.roles.find((candidate) => candidate.id === id);
    if (role === undefined) {
      return null;
    }
    if (role.system) {
      throw new ManagedRoleNotFoundError();
    }

    if (input.name !== undefined) role.name = input.name.trim();
    if (input.description !== undefined) role.description = input.description.trim();
    if (input.permissions !== undefined) role.permissions = [...input.permissions];
    role.updatedAt = now();
    return cloneRole(role);
  }

  public async delete(id: string): Promise<ManagedRoleRecord | null> {
    const index = this.roles.findIndex((candidate) => candidate.id === id);
    if (index < 0) {
      return null;
    }

    const [role] = this.roles.splice(index, 1);
    if (role === undefined || role.system) {
      if (role !== undefined) this.roles.splice(index, 0, role);
      throw new ManagedRoleNotFoundError();
    }
    return cloneRole(role);
  }
}

export function isPermissionList(value: readonly string[]): value is PermissionCode[] {
  return value.every(isPermissionCode);
}

interface StaffRoleRow {
  id: string;
  code: string;
  name: string;
  description: string;
  is_system: boolean;
  permissions: string[];
  created_at: Date | string;
  updated_at: Date | string;
}

@Injectable()
export class PostgresStaffRoleRepository implements StaffRoleRepository, OnModuleDestroy {
  private readonly pool: Pool;

  private initialization?: Promise<void>;

  public constructor(config: ConfigService) {
    const connectionString = config.get<string>('DATABASE_URL');

    if (connectionString === undefined || connectionString.trim().length === 0) {
      throw new Error('DATABASE_URL is required when AUTH_STORE=postgres');
    }

    this.pool = new Pool({ connectionString });
  }

  public async listAll(): Promise<ManagedRoleRecord[]> {
    await this.ensureInitialized();
    const result = await this.pool.query<StaffRoleRow>(
      `
        SELECT id, code, name, description, is_system, permissions, created_at, updated_at
        FROM staff_roles
        ORDER BY is_system DESC, name ASC
      `,
    );
    return result.rows.map((row) => this.toRecord(row));
  }

  public async findById(id: string): Promise<ManagedRoleRecord | null> {
    await this.ensureInitialized();
    const result = await this.pool.query<StaffRoleRow>(
      `
        SELECT id, code, name, description, is_system, permissions, created_at, updated_at
        FROM staff_roles
        WHERE id::text = $1
        LIMIT 1
      `,
      [id],
    );
    return result.rows[0] === undefined ? null : this.toRecord(result.rows[0]);
  }

  public async findByCode(code: string): Promise<ManagedRoleRecord | null> {
    await this.ensureInitialized();
    const result = await this.pool.query<StaffRoleRow>(
      `
        SELECT id, code, name, description, is_system, permissions, created_at, updated_at
        FROM staff_roles
        WHERE code = $1
        LIMIT 1
      `,
      [code.trim().toUpperCase()],
    );
    return result.rows[0] === undefined ? null : this.toRecord(result.rows[0]);
  }

  public async create(input: CreateManagedRoleInput): Promise<ManagedRoleRecord> {
    await this.ensureInitialized();
    const result = await this.pool.query<StaffRoleRow>(
      `
        INSERT INTO staff_roles (id, code, name, description, is_system, permissions)
        VALUES ($1, $2, $3, $4, false, $5)
        RETURNING id, code, name, description, is_system, permissions, created_at, updated_at
      `,
      [
        randomUUID(),
        input.code.trim().toUpperCase(),
        input.name.trim(),
        input.description.trim(),
        input.permissions,
      ],
    );
    return this.toRecord(result.rows[0] as StaffRoleRow);
  }

  public async update(
    id: string,
    input: UpdateManagedRoleInput,
  ): Promise<ManagedRoleRecord | null> {
    await this.ensureInitialized();
    const current = await this.findById(id);
    if (current === null) return null;

    const result = await this.pool.query<StaffRoleRow>(
      `
        UPDATE staff_roles
        SET name = $2,
            description = $3,
            permissions = $4,
            updated_at = now()
        WHERE id::text = $1 AND is_system = false
        RETURNING id, code, name, description, is_system, permissions, created_at, updated_at
      `,
      [
        id,
        input.name ?? current.name,
        input.description ?? current.description,
        input.permissions ?? current.permissions,
      ],
    );
    return result.rows[0] === undefined ? null : this.toRecord(result.rows[0]);
  }

  public async delete(id: string): Promise<ManagedRoleRecord | null> {
    await this.ensureInitialized();
    const result = await this.pool.query<StaffRoleRow>(
      `
        DELETE FROM staff_roles
        WHERE id::text = $1 AND is_system = false
        RETURNING id, code, name, description, is_system, permissions, created_at, updated_at
      `,
      [id],
    );
    return result.rows[0] === undefined ? null : this.toRecord(result.rows[0]);
  }

  public async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }

  private async ensureInitialized(): Promise<void> {
    this.initialization ??= this.initialize();
    await this.initialization;
  }

  private async initialize(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS staff_roles (
        id uuid PRIMARY KEY,
        code text NOT NULL UNIQUE,
        name text NOT NULL,
        description text NOT NULL,
        is_system boolean NOT NULL DEFAULT false,
        permissions text[] NOT NULL DEFAULT '{}',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    for (const role of buildSystemRoles()) {
      await this.pool.query(
        `
          INSERT INTO staff_roles (id, code, name, description, is_system, permissions, created_at, updated_at)
          VALUES ($1, $2, $3, $4, true, $5, $6, $6)
          ON CONFLICT (code) DO NOTHING
        `,
        [randomUUID(), role.code, role.name, role.description, role.permissions, role.createdAt],
      );
    }
  }

  private toRecord(row: StaffRoleRow): ManagedRoleRecord {
    const permissions = row.permissions.filter(isPermissionCode);
    if (permissions.length !== row.permissions.length) {
      throw new Error(`Staff role ${row.id} contains an invalid permission`);
    }

    return {
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description,
      system: row.is_system,
      permissions,
      createdAt: this.toIsoString(row.created_at),
      updatedAt: this.toIsoString(row.updated_at),
    };
  }

  private toIsoString(value: Date | string): string {
    return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
  }
}
