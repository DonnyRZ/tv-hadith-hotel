import { randomBytes, randomUUID } from 'node:crypto';

import { ConflictException, Injectable, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, type PoolClient } from 'pg';

import { RECEPTIONIST_ROOM_CATALOG } from '../receptionist/receptionist.types';
import { hashTvSecret } from './in-memory-tv-device.repository';
import {
  TvDeviceRoomConflictError,
  TvDeviceRoomNotFoundError,
  type TvDeviceRepository,
} from './tv-device.repository';
import type {
  CreatedTvDevice,
  ListTvDevicesInput,
  PairTvDeviceInput,
  StartTvProvisioningInput,
  TvDeviceRecord,
  TvProvisioningStatus,
} from './tv.types';

function createPairingCode(): string {
  return randomBytes(3).readUIntBE(0, 3).toString(10).padStart(6, '0').slice(-6);
}

function createDeviceCredential(): string {
  return `tv_${randomBytes(32).toString('base64url')}`;
}

interface TvDeviceRow {
  id: string;
  installation_id: string;
  device_code: string;
  pairing_code_hash: string;
  pairing_expires_at: Date | string;
  credential_hash: string;
  credential: string | null;
  status: string;
  room_id: string | null;
  room_number?: string | null;
  device_model: string;
  app_version: string;
  android_api_level: number;
  created_at: Date | string;
  paired_at: Date | string | null;
  claimed_at: Date | string | null;
  revoked_at: Date | string | null;
}

@Injectable()
export class PostgresTvDeviceRepository implements TvDeviceRepository, OnModuleDestroy {
  private readonly pool: Pool;
  private initialization?: Promise<void>;

  public constructor(config: ConfigService) {
    const connectionString = config.get<string>('DATABASE_URL');
    if (connectionString === undefined || connectionString.trim().length === 0) {
      throw new Error('DATABASE_URL is required when AUTH_STORE=postgres');
    }
    this.pool = new Pool({ connectionString });
  }

  public async createPending(
    input: StartTvProvisioningInput,
    ttlSeconds: number,
  ): Promise<CreatedTvDevice> {
    await this.ensureInitialized();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const existingResult = await client.query<TvDeviceRow>(
        `
          SELECT d.id, d.installation_id, d.device_code, d.pairing_code_hash,
                 d.pairing_expires_at, d.credential_hash, d.credential, d.status,
                 d.room_id, r.room_number, d.device_model, d.app_version,
                 d.android_api_level, d.created_at, d.paired_at, d.claimed_at,
                 d.revoked_at
          FROM hotel_tv_devices d
          LEFT JOIN hotel_rooms r ON r.id = d.room_id
          WHERE d.installation_id = $1 AND d.status <> 'REVOKED'
          ORDER BY d.created_at DESC, d.id DESC
          LIMIT 1
          FOR UPDATE OF d
        `,
        [input.installationId],
      );

      const pairingCode = await this.createUniquePairingCode(client, existingResult.rows[0]?.id);
      const credential = createDeviceCredential();
      const issuedAt = new Date();
      const expiresAt = new Date(issuedAt.getTime() + ttlSeconds * 1000).toISOString();
      const existing = existingResult.rows[0];

      const result =
        existing === undefined
          ? await client.query<TvDeviceRow>(
              `
                INSERT INTO hotel_tv_devices
                  (id, installation_id, device_code, pairing_code_hash, pairing_expires_at,
                   credential_hash, credential, status, room_id, device_model, app_version,
                   android_api_level, created_at, paired_at, claimed_at, revoked_at)
                VALUES ($1::uuid, $2, $3, $4, $5::timestamptz, $6, $7, 'PENDING', NULL,
                        $8, $9, $10::integer, $5::timestamptz, NULL, NULL, NULL)
                RETURNING id, installation_id, device_code, pairing_code_hash,
                          pairing_expires_at, credential_hash, credential, status, room_id,
                          device_model, app_version, android_api_level, created_at,
                          paired_at, claimed_at, revoked_at
              `,
              [
                randomUUID(),
                input.installationId,
                `device_${randomBytes(6).toString('base64url')}`,
                hashTvSecret(pairingCode),
                expiresAt,
                hashTvSecret(credential),
                credential,
                input.deviceModel,
                input.appVersion,
                input.androidApiLevel,
              ],
            )
          : await client.query<TvDeviceRow>(
              `
                UPDATE hotel_tv_devices
                SET pairing_code_hash = $2,
                    pairing_expires_at = $3::timestamptz,
                    credential_hash = $4,
                    credential = $5,
                    status = 'PENDING',
                    room_id = NULL,
                    device_model = $6,
                    app_version = $7,
                    android_api_level = $8::integer,
                    paired_at = NULL,
                    claimed_at = NULL,
                    revoked_at = NULL
                WHERE id = $1::uuid
                RETURNING id, installation_id, device_code, pairing_code_hash,
                          pairing_expires_at, credential_hash, credential, status, room_id,
                          device_model, app_version, android_api_level, created_at,
                          paired_at, claimed_at, revoked_at
              `,
              [
                existing.id,
                hashTvSecret(pairingCode),
                expiresAt,
                hashTvSecret(credential),
                credential,
                input.deviceModel,
                input.appVersion,
                input.androidApiLevel,
              ],
            );

      await client.query('COMMIT');
      const row = result.rows[0] as TvDeviceRow;
      return { record: this.toRecord(row), pairingCode };
    } catch (error) {
      await this.rollback(client);
      throw error;
    } finally {
      client.release();
    }
  }

  public async list(input: ListTvDevicesInput) {
    await this.ensureInitialized();
    const result = await this.pool.query<TvDeviceRow>(
      `
        SELECT d.id, d.installation_id, d.device_code, d.pairing_code_hash,
               d.pairing_expires_at, d.credential_hash, d.credential, d.status,
               d.room_id, r.room_number, d.device_model, d.app_version,
               d.android_api_level, d.created_at, d.paired_at, d.claimed_at,
               d.revoked_at, COUNT(*) OVER() AS total_count
        FROM hotel_tv_devices d
        LEFT JOIN hotel_rooms r ON r.id = d.room_id
        WHERE ($1::uuid IS NULL OR d.room_id = $1::uuid)
          AND ($2::text IS NULL OR d.status = $2::text)
        ORDER BY CASE d.status
                   WHEN 'CLAIMED' THEN 0
                   WHEN 'PAIRED' THEN 1
                   WHEN 'PENDING' THEN 2
                   ELSE 3
                 END,
                 d.created_at DESC, d.id DESC
        LIMIT $3 OFFSET $4
      `,
      [
        input.roomId ?? null,
        input.status ?? null,
        input.pageSize,
        (input.page - 1) * input.pageSize,
      ],
    );

    const firstRow = result.rows[0] as
      (TvDeviceRow & { total_count?: number | string }) | undefined;
    return {
      items: result.rows.map((row) => this.toRecord(row)),
      total: firstRow === undefined ? 0 : Number(firstRow.total_count ?? 0),
    };
  }

  public async findByPairingCode(pairingCode: string): Promise<TvDeviceRecord | null> {
    await this.ensureInitialized();
    const result = await this.pool.query<TvDeviceRow>(this.selectBy('pairing_code_hash'), [
      hashTvSecret(pairingCode),
    ]);
    return result.rows[0] === undefined ? null : this.toRecord(result.rows[0]);
  }

  public async findByInstallationId(installationId: string): Promise<TvDeviceRecord | null> {
    await this.ensureInitialized();
    const result = await this.pool.query<TvDeviceRow>(
      `${this.selectColumns()}
       FROM hotel_tv_devices d
       LEFT JOIN hotel_rooms r ON r.id = d.room_id
       WHERE d.installation_id = $1
       ORDER BY d.created_at DESC, d.id DESC
       LIMIT 1`,
      [installationId],
    );
    return result.rows[0] === undefined ? null : this.toRecord(result.rows[0]);
  }

  public async pair(
    recordId: string,
    input: PairTvDeviceInput,
    pairedAt: string,
  ): Promise<TvDeviceRecord> {
    await this.ensureInitialized();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const currentResult = await client.query<TvDeviceRow>(
        `${this.selectColumns()}
         FROM hotel_tv_devices d
         LEFT JOIN hotel_rooms r ON r.id = d.room_id
         WHERE d.id = $1::uuid
         FOR UPDATE OF d`,
        [recordId],
      );
      const current = currentResult.rows[0];
      if (current === undefined) throw new NotFoundException('TV device does not exist.');
      if (current.status !== 'PENDING') {
        throw new ConflictException('TV pairing code has already been used.');
      }

      const roomResult = await client.query<{ id: string; room_number: string }>(
        'SELECT id, room_number FROM hotel_rooms WHERE id = $1::uuid FOR SHARE',
        [input.roomId],
      );
      const room = roomResult.rows[0];
      if (room === undefined) throw new TvDeviceRoomNotFoundError();
      if (room.room_number !== input.roomNumber) throw new TvDeviceRoomNotFoundError();

      const activeDeviceResult = await client.query<{ id: string }>(
        `
          SELECT id
          FROM hotel_tv_devices
          WHERE room_id = $1::uuid
            AND id <> $2::uuid
            AND status IN ('PAIRED', 'CLAIMED')
          FOR UPDATE
        `,
        [input.roomId, recordId],
      );
      if (activeDeviceResult.rows[0] !== undefined) {
        throw new TvDeviceRoomConflictError();
      }

      await client.query(
        `
          UPDATE hotel_tv_devices
          SET room_id = $2::uuid, status = 'PAIRED', paired_at = $3::timestamptz,
              claimed_at = NULL, revoked_at = NULL
          WHERE id = $1::uuid
        `,
        [recordId, input.roomId, pairedAt],
      );
      const paired = await client.query<TvDeviceRow>(
        `${this.selectColumns()}
         FROM hotel_tv_devices d
         LEFT JOIN hotel_rooms r ON r.id = d.room_id
         WHERE d.id = $1::uuid`,
        [recordId],
      );
      await client.query('COMMIT');
      return this.toRecord(paired.rows[0] as TvDeviceRow);
    } catch (error) {
      await this.rollback(client);
      if (this.isUniqueViolation(error)) throw new TvDeviceRoomConflictError();
      throw error;
    } finally {
      client.release();
    }
  }

  public async claim(recordId: string, claimedAt: string): Promise<TvDeviceRecord> {
    await this.ensureInitialized();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const currentResult = await client.query<TvDeviceRow>(
        `${this.selectColumns()}
         FROM hotel_tv_devices d
         LEFT JOIN hotel_rooms r ON r.id = d.room_id
         WHERE d.id = $1::uuid
         FOR UPDATE OF d`,
        [recordId],
      );
      const current = currentResult.rows[0];
      if (current === undefined) throw new NotFoundException('TV device does not exist.');
      if (current.status !== 'PAIRED' && current.status !== 'CLAIMED') {
        throw new ConflictException('TV device is not paired yet.');
      }
      await client.query(
        `
          UPDATE hotel_tv_devices
          SET status = 'CLAIMED', claimed_at = COALESCE(claimed_at, $2::timestamptz)
          WHERE id = $1::uuid
        `,
        [recordId, claimedAt],
      );
      const claimed = await client.query<TvDeviceRow>(
        `${this.selectColumns()}
         FROM hotel_tv_devices d
         LEFT JOIN hotel_rooms r ON r.id = d.room_id
         WHERE d.id = $1::uuid`,
        [recordId],
      );
      await client.query('COMMIT');
      return this.toRecord(claimed.rows[0] as TvDeviceRow);
    } catch (error) {
      await this.rollback(client);
      throw error;
    } finally {
      client.release();
    }
  }

  public async findByCredential(credential: string): Promise<TvDeviceRecord | null> {
    await this.ensureInitialized();
    const result = await this.pool.query<TvDeviceRow>(
      `${this.selectColumns()}
       FROM hotel_tv_devices d
       LEFT JOIN hotel_rooms r ON r.id = d.room_id
       WHERE d.credential_hash = $1
         AND d.status IN ('PAIRED', 'CLAIMED')
       LIMIT 1`,
      [hashTvSecret(credential)],
    );
    return result.rows[0] === undefined ? null : this.toRecord(result.rows[0]);
  }

  public async revoke(recordId: string, revokedAt: string): Promise<TvDeviceRecord> {
    await this.ensureInitialized();
    const result = await this.pool.query<TvDeviceRow>(
      `
        UPDATE hotel_tv_devices
        SET status = 'REVOKED', revoked_at = $2::timestamptz
        WHERE id = $1::uuid
        RETURNING id, installation_id, device_code, pairing_code_hash,
                  pairing_expires_at, credential_hash, credential, status, room_id,
                  device_model, app_version, android_api_level, created_at,
                  paired_at, claimed_at, revoked_at
      `,
      [recordId, revokedAt],
    );
    const row = result.rows[0];
    if (row === undefined) throw new NotFoundException('TV device does not exist.');
    return this.toRecord(await this.withRoomNumber(row));
  }

  public async reset(
    recordId: string,
    ttlSeconds: number,
    resetAt: string,
  ): Promise<CreatedTvDevice> {
    await this.ensureInitialized();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const existingResult = await client.query<TvDeviceRow>(
        `SELECT id FROM hotel_tv_devices WHERE id = $1::uuid FOR UPDATE`,
        [recordId],
      );
      if (existingResult.rows[0] === undefined) {
        throw new NotFoundException('TV device does not exist.');
      }
      const pairingCode = await this.createUniquePairingCode(client, recordId);
      const credential = createDeviceCredential();
      const expiresAt = new Date(Date.parse(resetAt) + ttlSeconds * 1000).toISOString();
      const result = await client.query<TvDeviceRow>(
        `
          UPDATE hotel_tv_devices
          SET pairing_code_hash = $2,
              pairing_expires_at = $3::timestamptz,
              credential_hash = $4,
              credential = $5,
              status = 'PENDING',
              room_id = NULL,
              paired_at = NULL,
              claimed_at = NULL,
              revoked_at = NULL
          WHERE id = $1::uuid
          RETURNING id, installation_id, device_code, pairing_code_hash,
                    pairing_expires_at, credential_hash, credential, status, room_id,
                    device_model, app_version, android_api_level, created_at,
                    paired_at, claimed_at, revoked_at
        `,
        [recordId, hashTvSecret(pairingCode), expiresAt, hashTvSecret(credential), credential],
      );
      await client.query('COMMIT');
      return { record: this.toRecord(result.rows[0] as TvDeviceRow), pairingCode };
    } catch (error) {
      await this.rollback(client);
      throw error;
    } finally {
      client.release();
    }
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
      CREATE TABLE IF NOT EXISTS hotel_tv_devices (
        id uuid PRIMARY KEY,
        installation_id text NOT NULL,
        device_code text NOT NULL UNIQUE,
        pairing_code_hash text NOT NULL UNIQUE,
        pairing_expires_at timestamptz NOT NULL,
        credential_hash text NOT NULL,
        credential text,
        status text NOT NULL CHECK (status IN ('PENDING', 'PAIRED', 'CLAIMED', 'REVOKED')),
        room_id uuid REFERENCES hotel_rooms(id) ON DELETE SET NULL,
        device_model text NOT NULL,
        app_version text NOT NULL,
        android_api_level integer NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        paired_at timestamptz,
        claimed_at timestamptz,
        revoked_at timestamptz
      )
    `);
    await this.pool.query(
      'CREATE INDEX IF NOT EXISTS hotel_tv_devices_installation_idx ON hotel_tv_devices (installation_id, created_at DESC)',
    );
    await this.pool.query(
      'CREATE INDEX IF NOT EXISTS hotel_tv_devices_status_idx ON hotel_tv_devices (status, created_at DESC)',
    );
    await this.pool.query(
      'CREATE INDEX IF NOT EXISTS hotel_tv_devices_room_idx ON hotel_tv_devices (room_id, created_at DESC)',
    );
    await this.pool.query(
      "CREATE UNIQUE INDEX IF NOT EXISTS hotel_tv_devices_one_active_room_idx ON hotel_tv_devices (room_id) WHERE status IN ('PAIRED', 'CLAIMED')",
    );
  }

  private selectColumns(): string {
    return `SELECT d.id, d.installation_id, d.device_code, d.pairing_code_hash,
                   d.pairing_expires_at, d.credential_hash, d.credential, d.status,
                   d.room_id, r.room_number, d.device_model, d.app_version,
                   d.android_api_level, d.created_at, d.paired_at, d.claimed_at,
                   d.revoked_at`;
  }

  private selectBy(column: 'pairing_code_hash'): string {
    return `${this.selectColumns()}
            FROM hotel_tv_devices d
            LEFT JOIN hotel_rooms r ON r.id = d.room_id
            WHERE d.${column} = $1
            LIMIT 1`;
  }

  private async withRoomNumber(row: TvDeviceRow): Promise<TvDeviceRow> {
    if (row.room_id === null) return row;
    const result = await this.pool.query<{ room_number: string }>(
      'SELECT room_number FROM hotel_rooms WHERE id = $1::uuid',
      [row.room_id],
    );
    return { ...row, room_number: result.rows[0]?.room_number ?? null };
  }

  private async createUniquePairingCode(
    client: PoolClient,
    excludeRecordId?: string,
  ): Promise<string> {
    let pairingCode = createPairingCode();
    while (true) {
      const result = await client.query(
        `
          SELECT 1
          FROM hotel_tv_devices
          WHERE pairing_code_hash = $1
            AND ($2::uuid IS NULL OR id <> $2::uuid)
          LIMIT 1
        `,
        [hashTvSecret(pairingCode), excludeRecordId ?? null],
      );
      if (result.rows[0] === undefined) return pairingCode;
      pairingCode = createPairingCode();
    }
  }

  private toRecord(row: TvDeviceRow): TvDeviceRecord {
    if (!this.isProvisioningStatus(row.status)) {
      throw new Error(`TV device ${row.id} contains an invalid status`);
    }
    return {
      id: row.id,
      installationId: row.installation_id,
      deviceCode: row.device_code,
      pairingCodeHash: row.pairing_code_hash,
      pairingExpiresAt: this.toIsoString(row.pairing_expires_at),
      credentialHash: row.credential_hash,
      credential: row.credential,
      status: row.status,
      room:
        row.room_id === null
          ? null
          : { id: row.room_id, number: row.room_number ?? 'Unknown room' },
      deviceModel: row.device_model,
      appVersion: row.app_version,
      androidApiLevel: row.android_api_level,
      createdAt: this.toIsoString(row.created_at),
      pairedAt: row.paired_at === null ? null : this.toIsoString(row.paired_at),
      claimedAt: row.claimed_at === null ? null : this.toIsoString(row.claimed_at),
      revokedAt: row.revoked_at === null ? null : this.toIsoString(row.revoked_at),
    };
  }

  private isProvisioningStatus(value: string): value is TvProvisioningStatus {
    return value === 'PENDING' || value === 'PAIRED' || value === 'CLAIMED' || value === 'REVOKED';
  }

  private toIsoString(value: Date | string): string {
    return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === '23505'
    );
  }

  private async rollback(client: PoolClient): Promise<void> {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Preserve the original mutation error.
    }
  }
}
