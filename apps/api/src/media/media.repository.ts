import { randomUUID } from 'node:crypto';

import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';

import type { MediaObjectRecord } from './media.types';

export const MEDIA_REPOSITORY = Symbol('MEDIA_REPOSITORY');

export interface MediaRepository {
  create(input: Omit<MediaObjectRecord, 'id' | 'createdAt'>): Promise<MediaObjectRecord>;
  findById(id: string): Promise<MediaObjectRecord | null>;
}

function now(): string {
  return new Date().toISOString();
}

function clone(record: MediaObjectRecord): MediaObjectRecord {
  return { ...record };
}

@Injectable()
export class InMemoryMediaRepository implements MediaRepository {
  private readonly records = new Map<string, MediaObjectRecord>();

  public async create(
    input: Omit<MediaObjectRecord, 'id' | 'createdAt'>,
  ): Promise<MediaObjectRecord> {
    const record: MediaObjectRecord = {
      ...input,
      id: randomUUID(),
      createdAt: now(),
    };
    this.records.set(record.id, record);
    return clone(record);
  }

  public async findById(id: string): Promise<MediaObjectRecord | null> {
    const record = this.records.get(id);
    return record === undefined ? null : clone(record);
  }
}

interface MediaObjectRow {
  id: string;
  object_key: string;
  content_type: string;
  file_name: string;
  byte_size: number | string;
  created_at: Date | string;
}

@Injectable()
export class PostgresMediaRepository implements MediaRepository, OnModuleDestroy {
  private readonly pool: Pool;
  private initialization?: Promise<void>;

  public constructor(config: ConfigService) {
    const connectionString = config.get<string>('DATABASE_URL');
    if (connectionString === undefined || connectionString.trim().length === 0) {
      throw new Error('DATABASE_URL is required when AUTH_STORE=postgres');
    }
    this.pool = new Pool({ connectionString });
  }

  public async create(
    input: Omit<MediaObjectRecord, 'id' | 'createdAt'>,
  ): Promise<MediaObjectRecord> {
    await this.ensureInitialized();
    const result = await this.pool.query<MediaObjectRow>(
      `INSERT INTO media_objects (id, object_key, content_type, file_name, byte_size)
       VALUES ($1::uuid, $2, $3, $4, $5)
       RETURNING id, object_key, content_type, file_name, byte_size, created_at`,
      [randomUUID(), input.objectKey, input.contentType, input.fileName, input.byteSize],
    );
    return this.toRecord(result.rows[0] as MediaObjectRow);
  }

  public async findById(id: string): Promise<MediaObjectRecord | null> {
    await this.ensureInitialized();
    const result = await this.pool.query<MediaObjectRow>(
      `SELECT id, object_key, content_type, file_name, byte_size, created_at
         FROM media_objects WHERE id::text = $1 LIMIT 1`,
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
      CREATE TABLE IF NOT EXISTS media_objects (
        id uuid PRIMARY KEY,
        object_key text NOT NULL UNIQUE,
        content_type text NOT NULL,
        file_name text NOT NULL,
        byte_size integer NOT NULL CHECK (byte_size >= 0),
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  private toRecord(row: MediaObjectRow): MediaObjectRecord {
    return {
      id: row.id,
      objectKey: row.object_key,
      contentType: row.content_type,
      fileName: row.file_name,
      byteSize: Number(row.byte_size),
      createdAt:
        row.created_at instanceof Date
          ? row.created_at.toISOString()
          : new Date(row.created_at).toISOString(),
    };
  }
}
