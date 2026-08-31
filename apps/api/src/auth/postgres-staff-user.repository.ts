import { randomUUID } from 'node:crypto';

import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';

import type { StaffUserRecord } from './auth.types';
import { buildStaffUserRecord, loadSeedUsers } from './seed-users';
import type {
  CreateStaffUserRecordInput,
  StaffUserRepository,
  UpdateStaffUserRecordInput,
} from './staff-user.repository';
import {
  isPermissionCode,
  isRoleCode,
  mergeRolePermissions,
  type PermissionCode,
  type RoleCode,
} from '../rbac/rbac.types';

interface StaffUserRow {
  id: string;
  email: string;
  display_name: string;
  password_hash: string;
  roles: string[];
  permissions: string[];
  is_active: boolean;
  created_at: Date | string;
  updated_at: Date | string;
}

@Injectable()
export class PostgresStaffUserRepository implements StaffUserRepository, OnModuleDestroy {
  private readonly pool: Pool;

  private initialization?: Promise<void>;

  public constructor(private readonly config: ConfigService) {
    const connectionString = config.get<string>('DATABASE_URL');

    if (connectionString === undefined || connectionString.trim().length === 0) {
      throw new Error('DATABASE_URL is required when AUTH_STORE=postgres');
    }

    this.pool = new Pool({ connectionString });
  }

  public async findByEmail(email: string): Promise<StaffUserRecord | null> {
    await this.ensureInitialized();
    const result = await this.pool.query<StaffUserRow>(
      `
        SELECT id, email, display_name, password_hash, roles, permissions, is_active, created_at, updated_at
        FROM staff_users
        WHERE email = $1 AND is_active = true
        LIMIT 1
      `,
      [email.trim().toLowerCase()],
    );

    return result.rows[0] === undefined ? null : this.toRecord(result.rows[0]);
  }

  public async findById(id: string): Promise<StaffUserRecord | null> {
    await this.ensureInitialized();
    const result = await this.pool.query<StaffUserRow>(
      `
        SELECT id, email, display_name, password_hash, roles, permissions, is_active, created_at, updated_at
        FROM staff_users
        WHERE id = $1 AND is_active = true
        LIMIT 1
      `,
      [id],
    );

    return result.rows[0] === undefined ? null : this.toRecord(result.rows[0]);
  }

  public async listAll(): Promise<StaffUserRecord[]> {
    await this.ensureInitialized();
    const result = await this.pool.query<StaffUserRow>(
      `
        SELECT id, email, display_name, password_hash, roles, permissions, is_active, created_at, updated_at
        FROM staff_users
        ORDER BY display_name ASC, email ASC
      `,
    );

    return result.rows.map((row) => this.toRecord(row));
  }

  public async findByIdForManagement(id: string): Promise<StaffUserRecord | null> {
    await this.ensureInitialized();
    const result = await this.pool.query<StaffUserRow>(
      `
        SELECT id, email, display_name, password_hash, roles, permissions, is_active, created_at, updated_at
        FROM staff_users
        WHERE id = $1
        LIMIT 1
      `,
      [id],
    );

    return result.rows[0] === undefined ? null : this.toRecord(result.rows[0]);
  }

  public async createUser(input: CreateStaffUserRecordInput): Promise<StaffUserRecord> {
    await this.ensureInitialized();
    const id = randomUUID();
    const result = await this.pool.query<StaffUserRow>(
      `
        INSERT INTO staff_users
          (id, email, display_name, password_hash, roles, permissions, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, email, display_name, password_hash, roles, permissions, is_active, created_at, updated_at
      `,
      [
        id,
        input.email.trim().toLowerCase(),
        input.displayName.trim(),
        input.passwordHash,
        input.roles,
        input.permissions,
        input.active,
      ],
    );

    return this.toRecord(result.rows[0] as StaffUserRow);
  }

  public async updateUser(
    id: string,
    input: UpdateStaffUserRecordInput,
  ): Promise<StaffUserRecord | null> {
    await this.ensureInitialized();
    const current = await this.findByIdForManagement(id);
    if (current === null) {
      return null;
    }

    const result = await this.pool.query<StaffUserRow>(
      `
        UPDATE staff_users
        SET email = $2,
            display_name = $3,
            roles = $4,
            permissions = $5,
            is_active = $6,
            updated_at = now()
        WHERE id = $1
        RETURNING id, email, display_name, password_hash, roles, permissions, is_active, created_at, updated_at
      `,
      [
        id,
        input.email?.trim().toLowerCase() ?? current.email,
        input.displayName?.trim() ?? current.displayName,
        input.roles ?? current.roles,
        input.permissions ?? current.permissions,
        input.active ?? current.active,
      ],
    );

    return result.rows[0] === undefined ? null : this.toRecord(result.rows[0]);
  }

  public async setUserActive(id: string, active: boolean): Promise<StaffUserRecord | null> {
    return this.updateUser(id, { active });
  }

  public async updatePassword(id: string, passwordHash: string): Promise<StaffUserRecord | null> {
    await this.ensureInitialized();
    const result = await this.pool.query<StaffUserRow>(
      `
        UPDATE staff_users
        SET password_hash = $2, updated_at = now()
        WHERE id = $1
        RETURNING id, email, display_name, password_hash, roles, permissions, is_active, created_at, updated_at
      `,
      [id, passwordHash],
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
      CREATE TABLE IF NOT EXISTS staff_users (
        id uuid PRIMARY KEY,
        email text NOT NULL UNIQUE,
        display_name text NOT NULL,
        password_hash text NOT NULL,
        roles text[] NOT NULL,
        permissions text[] NOT NULL DEFAULT '{}',
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    const seeds = loadSeedUsers(this.config);

    for (const seed of seeds) {
      const user = await buildStaffUserRecord(seed);
      await this.pool.query(
        `
          INSERT INTO staff_users
            (id, email, display_name, password_hash, roles, permissions, is_active)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (email) DO NOTHING
        `,
        [
          user.id,
          user.email,
          user.displayName,
          user.passwordHash,
          user.roles,
          user.permissions,
          user.active,
        ],
      );
    }
  }

  private toRecord(row: StaffUserRow): StaffUserRecord {
    const roles = row.roles.filter(
      (role): role is string => typeof role === 'string' && role.length > 0,
    );
    const permissions = row.permissions.filter(isPermissionCode);

    if (roles.length !== row.roles.length) {
      throw new Error(`Staff user ${row.id} contains an invalid role`);
    }

    if (permissions.length !== row.permissions.length) {
      throw new Error(`Staff user ${row.id} contains an invalid permission`);
    }

    return {
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      passwordHash: row.password_hash,
      roles,
      permissions: mergeRolePermissions(
        roles.filter(isRoleCode) as RoleCode[],
        permissions as PermissionCode[],
      ),
      active: row.is_active,
      createdAt: this.toIsoString(row.created_at),
      updatedAt: this.toIsoString(row.updated_at),
    };
  }

  private toIsoString(value: Date | string): string {
    return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
  }
}
