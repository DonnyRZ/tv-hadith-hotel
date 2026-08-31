import { createHash, randomBytes, randomUUID } from 'node:crypto';

import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, type PoolClient } from 'pg';

import { RECEPTIONIST_ROOM_CATALOG } from '../receptionist/receptionist.types';
import type { GuestQrTokenRecord, IssuedGuestQrToken } from './guest.types';
import { readGuestDevelopmentFixture, type GuestDevelopmentFixture } from './guest-dev-fixtures';

export const GUEST_QR_TOKEN_REPOSITORY = Symbol('GUEST_QR_TOKEN_REPOSITORY');

export class GuestQrRoomNotFoundError extends Error {
  public constructor() {
    super('The requested guest room does not exist.');
    this.name = 'GuestQrRoomNotFoundError';
  }
}

export interface GuestQrTokenRepository {
  issueForRoom(roomId: string): Promise<IssuedGuestQrToken>;
  findActiveByToken(token: string): Promise<GuestQrTokenRecord | null>;
  revokeForRoom(roomId: string): Promise<GuestQrTokenRecord | null>;
}

export function hashGuestAccessToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

function now(): string {
  return new Date().toISOString();
}

function cloneRecord(record: GuestQrTokenRecord): GuestQrTokenRecord {
  return { ...record };
}

function roomForId(roomId: string) {
  return RECEPTIONIST_ROOM_CATALOG.find((room) => room.id === roomId);
}

function roomForNumber(roomNumber: string) {
  return RECEPTIONIST_ROOM_CATALOG.find((room) => room.number === roomNumber);
}

@Injectable()
export class InMemoryGuestQrTokenRepository implements GuestQrTokenRepository {
  private readonly records = new Map<string, GuestQrTokenRecord>();

  public constructor(fixture?: GuestDevelopmentFixture | null) {
    if (fixture === undefined || fixture === null) return;
    const room = roomForNumber(fixture.roomNumber);
    if (room === undefined)
      throw new Error(`Unknown guest development fixture room: ${fixture.roomNumber}`);

    const createdAt = now();
    const record: GuestQrTokenRecord = {
      id: randomUUID(),
      roomId: room.id,
      tokenHash: hashGuestAccessToken(fixture.token),
      active: true,
      createdAt,
      revokedAt: null,
    };
    this.records.set(record.id, record);
  }

  public async issueForRoom(roomId: string): Promise<IssuedGuestQrToken> {
    const room = roomForId(roomId);
    if (room === undefined) throw new GuestQrRoomNotFoundError();

    const issuedAt = now();
    for (const record of this.records.values()) {
      if (record.roomId === room.id && record.active) {
        record.active = false;
        record.revokedAt = issuedAt;
      }
    }

    const token = randomBytes(32).toString('base64url');
    const record: GuestQrTokenRecord = {
      id: randomUUID(),
      roomId: room.id,
      tokenHash: hashGuestAccessToken(token),
      active: true,
      createdAt: issuedAt,
      revokedAt: null,
    };
    this.records.set(record.id, record);
    return { record: cloneRecord(record), token };
  }

  public async findActiveByToken(token: string): Promise<GuestQrTokenRecord | null> {
    const tokenHash = hashGuestAccessToken(token);
    const record = [...this.records.values()].find(
      (candidate) => candidate.active && candidate.tokenHash === tokenHash,
    );
    return record === undefined ? null : cloneRecord(record);
  }

  public async revokeForRoom(roomId: string): Promise<GuestQrTokenRecord | null> {
    const revokedAt = now();
    const record = [...this.records.values()].find(
      (candidate) => candidate.roomId === roomId && candidate.active,
    );
    if (record === undefined) return null;
    record.active = false;
    record.revokedAt = revokedAt;
    return cloneRecord(record);
  }
}

interface GuestQrTokenRow {
  id: string;
  room_id: string;
  token_hash: string;
  active: boolean;
  created_at: Date | string;
  revoked_at: Date | string | null;
}

@Injectable()
export class PostgresGuestQrTokenRepository implements GuestQrTokenRepository, OnModuleDestroy {
  private readonly pool: Pool;
  private initialization?: Promise<void>;
  private readonly developmentFixture: GuestDevelopmentFixture | null;

  public constructor(config: ConfigService) {
    const connectionString = config.get<string>('DATABASE_URL');
    if (connectionString === undefined || connectionString.trim().length === 0) {
      throw new Error('DATABASE_URL is required when AUTH_STORE=postgres');
    }
    this.pool = new Pool({ connectionString });
    this.developmentFixture = readGuestDevelopmentFixture(config);
  }

  public async issueForRoom(roomId: string): Promise<IssuedGuestQrToken> {
    await this.ensureInitialized();
    const room = roomForId(roomId);
    if (room === undefined) throw new GuestQrRoomNotFoundError();

    const token = randomBytes(32).toString('base64url');
    const tokenHash = hashGuestAccessToken(token);
    const issuedAt = new Date().toISOString();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `
          UPDATE guest_room_qr_tokens
          SET active = false, revoked_at = $2::timestamptz
          WHERE room_id = $1::uuid AND active = true
        `,
        [room.id, issuedAt],
      );
      const result = await client.query<GuestQrTokenRow>(
        `
          INSERT INTO guest_room_qr_tokens
            (id, room_id, token_hash, active, created_at, revoked_at)
          VALUES ($1::uuid, $2::uuid, $3, true, $4::timestamptz, NULL)
          RETURNING id, room_id, token_hash, active, created_at, revoked_at
        `,
        [randomUUID(), room.id, tokenHash, issuedAt],
      );
      await client.query('COMMIT');
      return { record: this.toRecord(result.rows[0] as GuestQrTokenRow), token };
    } catch (error) {
      await this.rollback(client);
      throw error;
    } finally {
      client.release();
    }
  }

  public async findActiveByToken(token: string): Promise<GuestQrTokenRecord | null> {
    await this.ensureInitialized();
    const result = await this.pool.query<GuestQrTokenRow>(
      `
        SELECT id, room_id, token_hash, active, created_at, revoked_at
        FROM guest_room_qr_tokens
        WHERE token_hash = $1 AND active = true
        LIMIT 1
      `,
      [hashGuestAccessToken(token)],
    );
    return result.rows[0] === undefined ? null : this.toRecord(result.rows[0]);
  }

  public async revokeForRoom(roomId: string): Promise<GuestQrTokenRecord | null> {
    await this.ensureInitialized();
    const result = await this.pool.query<GuestQrTokenRow>(
      `
        UPDATE guest_room_qr_tokens
        SET active = false, revoked_at = now()
        WHERE room_id = $1::uuid AND active = true
        RETURNING id, room_id, token_hash, active, created_at, revoked_at
      `,
      [roomId],
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
      CREATE TABLE IF NOT EXISTS hotel_rooms (
        id uuid PRIMARY KEY,
        room_number text NOT NULL UNIQUE,
        floor integer NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    for (const room of RECEPTIONIST_ROOM_CATALOG) {
      await this.pool.query(
        `
          INSERT INTO hotel_rooms (id, room_number, floor)
          VALUES ($1::uuid, $2, $3::integer)
          ON CONFLICT (room_number) DO NOTHING
        `,
        [room.id, room.number, room.floor],
      );
    }
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS guest_room_qr_tokens (
        id uuid PRIMARY KEY,
        room_id uuid NOT NULL REFERENCES hotel_rooms(id),
        token_hash text NOT NULL UNIQUE,
        active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        revoked_at timestamptz
      )
    `);
    await this.pool.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS guest_room_qr_tokens_one_active_idx ON guest_room_qr_tokens (room_id) WHERE active = true',
    );
    if (this.developmentFixture !== null) {
      const room = roomForNumber(this.developmentFixture.roomNumber);
      if (room === undefined) {
        throw new Error(
          `Unknown guest development fixture room: ${this.developmentFixture.roomNumber}`,
        );
      }
      await this.pool.query(
        `
          UPDATE guest_room_qr_tokens
          SET active = false, revoked_at = now()
          WHERE room_id = $1::uuid AND active = true
        `,
        [room.id],
      );
      await this.pool.query(
        `
          INSERT INTO guest_room_qr_tokens (id, room_id, token_hash, active, created_at, revoked_at)
          VALUES ($1::uuid, $2::uuid, $3, true, now(), NULL)
          ON CONFLICT (token_hash) DO UPDATE
          SET room_id = EXCLUDED.room_id, active = true, revoked_at = NULL
        `,
        [randomUUID(), room.id, hashGuestAccessToken(this.developmentFixture.token)],
      );
    }
  }

  private toRecord(row: GuestQrTokenRow): GuestQrTokenRecord {
    return {
      id: row.id,
      roomId: row.room_id,
      tokenHash: row.token_hash,
      active: row.active,
      createdAt: this.toIsoString(row.created_at),
      revokedAt: row.revoked_at === null ? null : this.toIsoString(row.revoked_at),
    };
  }

  private toIsoString(value: Date | string): string {
    return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
  }

  private async rollback(client: PoolClient): Promise<void> {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Preserve the original mutation error.
    }
  }
}
