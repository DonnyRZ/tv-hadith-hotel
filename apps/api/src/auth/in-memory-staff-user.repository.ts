import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { StaffUserRecord } from './auth.types';
import { buildStaffUserRecord, loadSeedUsers } from './seed-users';
import type {
  CreateStaffUserRecordInput,
  StaffUserRepository,
  UpdateStaffUserRecordInput,
} from './staff-user.repository';

export class StaffUserEmailConflictError extends Error {
  public constructor() {
    super('A staff user with this email already exists.');
    this.name = 'StaffUserEmailConflictError';
  }
}

@Injectable()
export class InMemoryStaffUserRepository implements StaffUserRepository {
  private users: StaffUserRecord[] = [];

  private initialization?: Promise<void>;

  public constructor(private readonly config: ConfigService) {}

  public async findByEmail(email: string): Promise<StaffUserRecord | null> {
    await this.ensureInitialized();
    const normalizedEmail = email.trim().toLowerCase();

    return this.users.find((user) => user.email === normalizedEmail && user.active) ?? null;
  }

  public async findById(id: string): Promise<StaffUserRecord | null> {
    await this.ensureInitialized();

    return this.users.find((user) => user.id === id && user.active) ?? null;
  }

  public async listAll(): Promise<StaffUserRecord[]> {
    await this.ensureInitialized();
    return this.users.map((user) => this.clone(user));
  }

  public async findByIdForManagement(id: string): Promise<StaffUserRecord | null> {
    await this.ensureInitialized();
    const user = this.users.find((candidate) => candidate.id === id);
    return user === undefined ? null : this.clone(user);
  }

  public async createUser(input: CreateStaffUserRecordInput): Promise<StaffUserRecord> {
    await this.ensureInitialized();
    const normalizedEmail = input.email.trim().toLowerCase();

    if (this.users.some((user) => user.email === normalizedEmail)) {
      throw new StaffUserEmailConflictError();
    }

    const now = new Date().toISOString();
    const user: StaffUserRecord = {
      id: randomUUID(),
      email: normalizedEmail,
      displayName: input.displayName.trim(),
      passwordHash: input.passwordHash,
      roles: [...input.roles],
      permissions: [...input.permissions],
      active: input.active,
      createdAt: now,
      updatedAt: now,
    };
    this.users.push(user);
    return this.clone(user);
  }

  public async updateUser(
    id: string,
    input: UpdateStaffUserRecordInput,
  ): Promise<StaffUserRecord | null> {
    await this.ensureInitialized();
    const user = this.users.find((candidate) => candidate.id === id);

    if (user === undefined) {
      return null;
    }

    const normalizedEmail = input.email?.trim().toLowerCase();
    if (
      normalizedEmail !== undefined &&
      this.users.some((candidate) => candidate.id !== id && candidate.email === normalizedEmail)
    ) {
      throw new StaffUserEmailConflictError();
    }

    if (normalizedEmail !== undefined) user.email = normalizedEmail;
    if (input.displayName !== undefined) user.displayName = input.displayName.trim();
    if (input.roles !== undefined) user.roles = [...input.roles];
    if (input.permissions !== undefined) user.permissions = [...input.permissions];
    if (input.active !== undefined) user.active = input.active;
    user.updatedAt = new Date().toISOString();

    return this.clone(user);
  }

  public async setUserActive(id: string, active: boolean): Promise<StaffUserRecord | null> {
    return this.updateUser(id, { active });
  }

  public async updatePassword(id: string, passwordHash: string): Promise<StaffUserRecord | null> {
    await this.ensureInitialized();
    const user = this.users.find((candidate) => candidate.id === id);

    if (user === undefined) {
      return null;
    }

    user.passwordHash = passwordHash;
    user.updatedAt = new Date().toISOString();
    return this.clone(user);
  }

  private async ensureInitialized(): Promise<void> {
    this.initialization ??= this.initialize();
    await this.initialization;
  }

  private async initialize(): Promise<void> {
    const seeds = loadSeedUsers(this.config);
    this.users = await Promise.all(seeds.map((seed) => buildStaffUserRecord(seed)));
  }

  private clone(user: StaffUserRecord): StaffUserRecord {
    return {
      ...user,
      roles: [...user.roles],
      permissions: [...user.permissions],
    };
  }
}
