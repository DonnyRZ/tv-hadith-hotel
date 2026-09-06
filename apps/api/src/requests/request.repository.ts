import { randomUUID } from 'node:crypto';

import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';

import { UNIT_CODES, type UnitCode } from '../rbac/rbac.types';
import type { LocalizedText } from '../menu/menu.types';
import {
  DEPARTMENT_CODES,
  REQUEST_STATUS_CODES,
  type CreateRequestRecordInput,
  type DepartmentCode,
  type RequestActor,
  type RequestItemKind,
  type RequestItemRecord,
  type RequestListFilter,
  type RequestListResult,
  type RequestRecord,
  type RequestStatus,
  type RequestStatusHistoryEntry,
  type RequestTransitionMetadata,
} from './request.types';

export const REQUEST_REPOSITORY = Symbol('REQUEST_REPOSITORY');

export class RequestClientIdConflictError extends Error {
  public constructor() {
    super('A request with this client id already exists for the room.');
    this.name = 'RequestClientIdConflictError';
  }
}

export interface RequestRepository {
  list(filter: RequestListFilter): Promise<RequestListResult>;
  listByGuestAssignmentIds(guestAssignmentIds: readonly string[]): Promise<RequestRecord[]>;
  listByClientRequestId(
    clientRequestId: string,
    guestAssignmentId?: string,
  ): Promise<RequestRecord[]>;
  findById(id: string): Promise<RequestRecord | null>;
  findByClientRequestId(
    clientRequestId: string,
    guestAssignmentId?: string,
  ): Promise<RequestRecord | null>;
  create(input: CreateRequestRecordInput): Promise<RequestRecord>;
  createBatch(inputs: readonly CreateRequestRecordInput[]): Promise<RequestRecord[]>;
  transition(
    id: string,
    expectedStatus: RequestStatus,
    nextStatus: RequestStatus,
    changedBy: RequestActor,
    metadata?: RequestTransitionMetadata,
  ): Promise<RequestRecord | null>;
  revertCompletion(id: string, changedBy: RequestActor): Promise<RequestRecord | null>;
  listExpiredReservations(before: string): Promise<RequestRecord[]>;
}

function now(): string {
  return new Date().toISOString();
}

function cloneActor(actor: RequestActor | null): RequestActor | null {
  return actor === null ? null : { ...actor };
}

function cloneRequest(request: RequestRecord): RequestRecord {
  return {
    ...request,
    guestAssignmentId: request.guestAssignmentId,
    room: { ...request.room },
    items: request.items.map((item) => ({
      ...item,
      localizedName: { ...item.localizedName },
    })),
    statusHistory: request.statusHistory.map((entry) => ({
      ...entry,
      changedBy: cloneActor(entry.changedBy),
    })),
  };
}

function createInitialRequest(input: CreateRequestRecordInput): RequestRecord {
  const timestamp = now();
  const requestedAt = input.requestedAt ?? timestamp;
  const initialHistory: RequestStatusHistoryEntry = {
    id: randomUUID(),
    fromStatus: null,
    toStatus: 'NEW',
    changedAt: requestedAt,
    changedBy: null,
  };

  return {
    id: randomUUID(),
    clientRequestId: input.clientRequestId,
    guestAssignmentId: input.guestAssignmentId ?? null,
    guestName: input.guestName?.trim() || null,
    department: input.department,
    unit: input.unit,
    room: { ...input.room },
    items: input.items.map((item) => ({ ...item })),
    guestNote: input.guestNote,
    status: 'NEW',
    requestedAt,
    confirmedAt: null,
    completedAt: null,
    reservationExpiresAt: input.reservationExpiresAt ?? null,
    cancelledAt: null,
    cancellationReason: null,
    cancellationSource: null,
    statusHistory: [initialHistory],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function isDateInRange(value: string, dateFrom?: string, dateTo?: string): boolean {
  const date = value.slice(0, 10);
  return (dateFrom === undefined || date >= dateFrom) && (dateTo === undefined || date <= dateTo);
}

function matchesFilter(request: RequestRecord, filter: RequestListFilter): boolean {
  if (!filter.units.includes(request.unit)) return false;
  if (
    filter.guestAssignmentId !== undefined &&
    request.guestAssignmentId !== filter.guestAssignmentId
  ) {
    return false;
  }
  if (filter.status !== undefined && request.status !== filter.status) return false;
  if (
    filter.room !== undefined &&
    request.room.number.toLocaleLowerCase() !== filter.room.toLocaleLowerCase()
  ) {
    return false;
  }
  return isDateInRange(request.requestedAt, filter.dateFrom, filter.dateTo);
}

@Injectable()
export class InMemoryRequestRepository implements RequestRepository {
  private readonly requests = new Map<string, RequestRecord>();

  public async list(filter: RequestListFilter): Promise<RequestListResult> {
    const filtered = [...this.requests.values()]
      .filter((request) => matchesFilter(request, filter))
      .sort(
        (left, right) =>
          right.requestedAt.localeCompare(left.requestedAt) || right.id.localeCompare(left.id),
      );
    const offset = (filter.page - 1) * filter.pageSize;

    return {
      items: filtered.slice(offset, offset + filter.pageSize).map(cloneRequest),
      total: filtered.length,
    };
  }

  public async listByGuestAssignmentIds(
    guestAssignmentIds: readonly string[],
  ): Promise<RequestRecord[]> {
    const ids = new Set(guestAssignmentIds);
    return [...this.requests.values()]
      .filter((request) => request.guestAssignmentId !== null && ids.has(request.guestAssignmentId))
      .sort(
        (left, right) =>
          right.requestedAt.localeCompare(left.requestedAt) || right.id.localeCompare(left.id),
      )
      .map(cloneRequest);
  }

  public async findById(id: string): Promise<RequestRecord | null> {
    const request = this.requests.get(id);
    return request === undefined ? null : cloneRequest(request);
  }

  public async findByClientRequestId(
    clientRequestId: string,
    guestAssignmentId?: string,
  ): Promise<RequestRecord | null> {
    const request = [...this.requests.values()].find(
      (candidate) =>
        candidate.clientRequestId === clientRequestId &&
        (guestAssignmentId === undefined || candidate.guestAssignmentId === guestAssignmentId),
    );
    return request === undefined ? null : cloneRequest(request);
  }

  public async listByClientRequestId(
    clientRequestId: string,
    guestAssignmentId?: string,
  ): Promise<RequestRecord[]> {
    return [...this.requests.values()]
      .filter(
        (request) =>
          request.clientRequestId === clientRequestId &&
          (guestAssignmentId === undefined || request.guestAssignmentId === guestAssignmentId),
      )
      .sort(
        (left, right) =>
          left.unit.localeCompare(right.unit) ||
          left.requestedAt.localeCompare(right.requestedAt) ||
          left.id.localeCompare(right.id),
      )
      .map(cloneRequest);
  }

  public async create(input: CreateRequestRecordInput): Promise<RequestRecord> {
    const [request] = await this.createBatch([input]);
    return request as RequestRecord;
  }

  public async createBatch(inputs: readonly CreateRequestRecordInput[]): Promise<RequestRecord[]> {
    if (inputs.length === 0) return [];

    const keys = new Set<string>();
    for (const input of inputs) {
      const scope =
        input.guestAssignmentId === undefined || input.guestAssignmentId === null
          ? `room:${input.room.id}`
          : `assignment:${input.guestAssignmentId}`;
      const key = `${scope}:${input.clientRequestId}:${input.unit}`;
      if (keys.has(key)) throw new RequestClientIdConflictError();
      keys.add(key);
      const exists = [...this.requests.values()].some(
        (request) =>
          request.clientRequestId === input.clientRequestId &&
          request.unit === input.unit &&
          (input.guestAssignmentId === undefined || input.guestAssignmentId === null
            ? request.guestAssignmentId === null && request.room.id === input.room.id
            : request.guestAssignmentId === input.guestAssignmentId),
      );
      if (exists) throw new RequestClientIdConflictError();
    }

    const requests = inputs.map(createInitialRequest);
    for (const request of requests) this.requests.set(request.id, request);
    return requests.map(cloneRequest);
  }

  public async transition(
    id: string,
    expectedStatus: RequestStatus,
    nextStatus: RequestStatus,
    changedBy: RequestActor,
    metadata?: RequestTransitionMetadata,
  ): Promise<RequestRecord | null> {
    const request = this.requests.get(id);
    if (request === undefined || request.status !== expectedStatus) return null;

    const changedAt = now();
    request.status = nextStatus;
    if (nextStatus === 'IN_PROCESS') request.confirmedAt = changedAt;
    if (nextStatus === 'COMPLETED') request.completedAt = changedAt;
    if (nextStatus === 'IN_PROCESS') request.reservationExpiresAt = null;
    if (nextStatus === 'CANCELLED') {
      request.cancelledAt = changedAt;
      request.cancellationReason = metadata?.cancellationReason ?? null;
      request.cancellationSource = metadata?.cancellationSource ?? 'STAFF';
      request.reservationExpiresAt = null;
    }
    request.updatedAt = changedAt;
    request.statusHistory.push({
      id: randomUUID(),
      fromStatus: expectedStatus,
      toStatus: nextStatus,
      changedAt,
      changedBy: cloneActor(changedBy),
    });

    return cloneRequest(request);
  }

  public async revertCompletion(
    id: string,
    changedBy: RequestActor,
  ): Promise<RequestRecord | null> {
    const request = this.requests.get(id);
    if (request === undefined || request.status !== 'COMPLETED') return null;

    const changedAt = now();
    request.status = 'IN_PROCESS';
    request.completedAt = null;
    request.reservationExpiresAt = null;
    request.updatedAt = changedAt;
    request.statusHistory.push({
      id: randomUUID(),
      fromStatus: 'COMPLETED',
      toStatus: 'IN_PROCESS',
      changedAt,
      changedBy: cloneActor(changedBy),
    });

    return cloneRequest(request);
  }

  public async listExpiredReservations(before: string): Promise<RequestRecord[]> {
    return [...this.requests.values()]
      .filter(
        (request) =>
          request.unit === 'BUTIK_INDONESIA' &&
          request.status === 'NEW' &&
          request.reservationExpiresAt !== null &&
          request.reservationExpiresAt <= before,
      )
      .map(cloneRequest);
  }
}

interface RequestRow {
  id: string;
  client_request_id: string;
  guest_assignment_id: string | null;
  guest_name: string | null;
  department: string;
  unit: string;
  room_id: string;
  room_number: string;
  items: unknown;
  guest_note: string | null;
  status: string;
  requested_at: Date | string;
  confirmed_at: Date | string | null;
  completed_at: Date | string | null;
  reservation_expires_at: Date | string | null;
  cancelled_at: Date | string | null;
  cancellation_reason: string | null;
  cancellation_source: string | null;
  status_history: unknown;
  created_at: Date | string;
  updated_at: Date | string;
  total_count?: number | string;
}

function isDepartmentCode(value: string): value is DepartmentCode {
  return (DEPARTMENT_CODES as readonly string[]).includes(value);
}

function isUnitCode(value: string): value is UnitCode {
  return (UNIT_CODES as readonly string[]).includes(value);
}

function isRequestStatus(value: string): value is RequestStatus {
  return (REQUEST_STATUS_CODES as readonly string[]).includes(value);
}

function isRequestItemKind(value: string): value is RequestItemKind {
  return value === 'PRODUCT' || value === 'SERVICE';
}

function parseItems(value: unknown, requestId: string): RequestItemRecord[] {
  if (!Array.isArray(value)) throw new Error(`Request ${requestId} contains invalid items`);
  return value.map((value) => {
    const item = value as RequestItemRecord & {
      localizedName?: LocalizedText;
      lineTotal?: unknown;
    };
    const { lineTotal: _legacyLineTotal, ...itemWithoutLegacyTotal } = item;
    void _legacyLineTotal;
    return {
      ...itemWithoutLegacyTotal,
      currency: item.currency ?? null,
      localizedName: isLocalizedText(item.localizedName)
        ? { ...item.localizedName }
        : { uz: item.name, ru: item.name, en: item.name },
    };
  });
}

function isLocalizedText(value: unknown): value is LocalizedText {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<LocalizedText>;
  return (
    typeof candidate.uz === 'string' &&
    typeof candidate.ru === 'string' &&
    typeof candidate.en === 'string'
  );
}

function parseStatusHistory(value: unknown, requestId: string): RequestStatusHistoryEntry[] {
  if (!Array.isArray(value)) {
    throw new Error(`Request ${requestId} contains invalid status history`);
  }
  return value as RequestStatusHistoryEntry[];
}

@Injectable()
export class PostgresRequestRepository implements RequestRepository, OnModuleDestroy {
  private readonly pool: Pool;

  private initialization?: Promise<void>;

  public constructor(config: ConfigService) {
    const connectionString = config.get<string>('DATABASE_URL');
    if (connectionString === undefined || connectionString.trim().length === 0) {
      throw new Error('DATABASE_URL is required when AUTH_STORE=postgres');
    }
    this.pool = new Pool({ connectionString });
  }

  public async list(filter: RequestListFilter): Promise<RequestListResult> {
    await this.ensureInitialized();
    const values: unknown[] = [filter.units];
    const clauses = ['unit = ANY($1::text[])'];

    if (filter.status !== undefined) {
      values.push(filter.status);
      clauses.push(`status = $${values.length}::text`);
    }
    if (filter.guestAssignmentId !== undefined) {
      values.push(filter.guestAssignmentId);
      clauses.push(`guest_assignment_id::text = $${values.length}::text`);
    }
    if (filter.room !== undefined) {
      values.push(filter.room);
      clauses.push(`LOWER(room_number) = LOWER($${values.length}::text)`);
    }
    if (filter.dateFrom !== undefined) {
      values.push(filter.dateFrom);
      clauses.push(`requested_at::date >= $${values.length}::date`);
    }
    if (filter.dateTo !== undefined) {
      values.push(filter.dateTo);
      clauses.push(`requested_at::date <= $${values.length}::date`);
    }

    const limitPosition = values.push(filter.pageSize);
    const offsetPosition = values.push((filter.page - 1) * filter.pageSize);
    const result = await this.pool.query<RequestRow>(
      `
        SELECT id, client_request_id, guest_assignment_id, department, unit, room_id, room_number,
               guest_name, items, guest_note, status, requested_at, confirmed_at, completed_at,
               reservation_expires_at, cancelled_at, cancellation_reason, cancellation_source,
               status_history, created_at, updated_at, COUNT(*) OVER() AS total_count
        FROM service_requests
        WHERE ${clauses.join(' AND ')}
        ORDER BY requested_at DESC, id DESC
        LIMIT $${limitPosition} OFFSET $${offsetPosition}
      `,
      values,
    );

    return {
      items: result.rows.map((row) => this.toRecord(row)),
      total: result.rows[0] === undefined ? 0 : Number(result.rows[0].total_count ?? 0),
    };
  }

  public async listByGuestAssignmentIds(
    guestAssignmentIds: readonly string[],
  ): Promise<RequestRecord[]> {
    await this.ensureInitialized();
    if (guestAssignmentIds.length === 0) return [];
    const result = await this.pool.query<RequestRow>(
      `
        SELECT id, client_request_id, guest_assignment_id, department, unit, room_id, room_number,
               guest_name, items, guest_note, status, requested_at, confirmed_at, completed_at,
               reservation_expires_at, cancelled_at, cancellation_reason, cancellation_source,
               status_history, created_at, updated_at
        FROM service_requests
        WHERE guest_assignment_id = ANY($1::uuid[])
        ORDER BY requested_at DESC, id DESC
      `,
      [guestAssignmentIds],
    );
    return result.rows.map((row) => this.toRecord(row));
  }

  public async findById(id: string): Promise<RequestRecord | null> {
    await this.ensureInitialized();
    const result = await this.pool.query<RequestRow>(
      `
        SELECT id, client_request_id, guest_assignment_id, department, unit, room_id, room_number,
               guest_name, items, guest_note, status, requested_at, confirmed_at, completed_at,
               reservation_expires_at, cancelled_at, cancellation_reason, cancellation_source,
               status_history, created_at, updated_at
        FROM service_requests
        WHERE id::text = $1
        LIMIT 1
      `,
      [id],
    );
    return result.rows[0] === undefined ? null : this.toRecord(result.rows[0]);
  }

  public async findByClientRequestId(
    clientRequestId: string,
    guestAssignmentId?: string,
  ): Promise<RequestRecord | null> {
    await this.ensureInitialized();
    const result = await this.pool.query<RequestRow>(
      `
        SELECT id, client_request_id, guest_assignment_id, department, unit, room_id, room_number,
               guest_name, items, guest_note, status, requested_at, confirmed_at, completed_at,
               reservation_expires_at, cancelled_at, cancellation_reason, cancellation_source,
               status_history, created_at, updated_at
        FROM service_requests
        WHERE client_request_id = $1::uuid
          AND ($2::uuid IS NULL OR guest_assignment_id = $2::uuid)
        ORDER BY created_at DESC, id DESC
        LIMIT 1
      `,
      [clientRequestId, guestAssignmentId ?? null],
    );
    return result.rows[0] === undefined ? null : this.toRecord(result.rows[0]);
  }

  public async listByClientRequestId(
    clientRequestId: string,
    guestAssignmentId?: string,
  ): Promise<RequestRecord[]> {
    await this.ensureInitialized();
    const result = await this.pool.query<RequestRow>(
      `
        SELECT id, client_request_id, guest_assignment_id, department, unit, room_id, room_number,
               guest_name, items, guest_note, status, requested_at, confirmed_at, completed_at,
               reservation_expires_at, cancelled_at, cancellation_reason, cancellation_source,
               status_history, created_at, updated_at
        FROM service_requests
        WHERE client_request_id = $1::uuid
          AND ($2::uuid IS NULL OR guest_assignment_id = $2::uuid)
        ORDER BY unit ASC, requested_at ASC, id ASC
      `,
      [clientRequestId, guestAssignmentId ?? null],
    );
    return result.rows.map((row) => this.toRecord(row));
  }

  public async create(input: CreateRequestRecordInput): Promise<RequestRecord> {
    const [request] = await this.createBatch([input]);
    return request as RequestRecord;
  }

  public async createBatch(inputs: readonly CreateRequestRecordInput[]): Promise<RequestRecord[]> {
    if (inputs.length === 0) return [];
    await this.ensureInitialized();
    const requests = inputs.map(createInitialRequest);
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const created: RequestRecord[] = [];
      for (const request of requests) {
        const result = await client.query<RequestRow>(
          `
            INSERT INTO service_requests
              (id, client_request_id, guest_assignment_id, department, unit, room_id, room_number, items,
              guest_name, guest_note, status, requested_at, confirmed_at, completed_at,
               reservation_expires_at, cancelled_at, cancellation_reason, cancellation_source,
               status_history, created_at, updated_at)
            VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6::uuid, $7, $8::jsonb,
                    $9, $10, $11, $12::timestamptz, $13::timestamptz, $14::timestamptz,
                    $15::timestamptz, $16::timestamptz, $17, $18,
                    $19::jsonb, $20::timestamptz, $21::timestamptz)
            RETURNING id, client_request_id, guest_assignment_id, department, unit, room_id, room_number,
                      guest_name, items, guest_note, status, requested_at, confirmed_at, completed_at,
                      reservation_expires_at, cancelled_at, cancellation_reason, cancellation_source,
                      status_history, created_at, updated_at
          `,
          [
            request.id,
            request.clientRequestId,
            request.guestAssignmentId,
            request.department,
            request.unit,
            request.room.id,
            request.room.number,
            JSON.stringify(request.items),
            request.guestName,
            request.guestNote,
            request.status,
            request.requestedAt,
            request.confirmedAt,
            request.completedAt,
            request.reservationExpiresAt,
            request.cancelledAt,
            request.cancellationReason,
            request.cancellationSource,
            JSON.stringify(request.statusHistory),
            request.createdAt,
            request.updatedAt,
          ],
        );
        created.push(this.toRecord(result.rows[0] as RequestRow));
      }
      await client.query('COMMIT');
      return created;
    } catch (error) {
      await client.query('ROLLBACK');
      if (isUniqueViolation(error)) throw new RequestClientIdConflictError();
      throw error;
    } finally {
      client.release();
    }
  }

  public async transition(
    id: string,
    expectedStatus: RequestStatus,
    nextStatus: RequestStatus,
    changedBy: RequestActor,
    metadata?: RequestTransitionMetadata,
  ): Promise<RequestRecord | null> {
    await this.ensureInitialized();
    const changedAt = now();
    const historyEntry: RequestStatusHistoryEntry = {
      id: randomUUID(),
      fromStatus: expectedStatus,
      toStatus: nextStatus,
      changedAt,
      changedBy: cloneActor(changedBy),
    };
    const result = await this.pool.query<RequestRow>(
      `
        UPDATE service_requests
        SET status = $3,
            confirmed_at = CASE WHEN $3 = 'IN_PROCESS' THEN $4::timestamptz ELSE confirmed_at END,
            completed_at = CASE WHEN $3 = 'COMPLETED' THEN $4::timestamptz ELSE completed_at END,
            reservation_expires_at = CASE WHEN $3 IN ('IN_PROCESS', 'CANCELLED') THEN NULL ELSE reservation_expires_at END,
            cancelled_at = CASE WHEN $3 = 'CANCELLED' THEN $4::timestamptz ELSE cancelled_at END,
            cancellation_reason = CASE WHEN $3 = 'CANCELLED' THEN $6 ELSE cancellation_reason END,
            cancellation_source = CASE WHEN $3 = 'CANCELLED' THEN $7 ELSE cancellation_source END,
            status_history = status_history || $5::jsonb,
            updated_at = $4::timestamptz
        WHERE id::text = $1 AND status = $2
        RETURNING id, client_request_id, guest_assignment_id, department, unit, room_id, room_number,
                  guest_name, items, guest_note, status, requested_at, confirmed_at, completed_at,
                  reservation_expires_at, cancelled_at, cancellation_reason, cancellation_source,
                  status_history, created_at, updated_at
      `,
      [
        id,
        expectedStatus,
        nextStatus,
        changedAt,
        JSON.stringify([historyEntry]),
        metadata?.cancellationReason ?? null,
        metadata?.cancellationSource ?? null,
      ],
    );
    return result.rows[0] === undefined ? null : this.toRecord(result.rows[0]);
  }

  public async revertCompletion(
    id: string,
    changedBy: RequestActor,
  ): Promise<RequestRecord | null> {
    await this.ensureInitialized();
    const changedAt = now();
    const historyEntry: RequestStatusHistoryEntry = {
      id: randomUUID(),
      fromStatus: 'COMPLETED',
      toStatus: 'IN_PROCESS',
      changedAt,
      changedBy: cloneActor(changedBy),
    };
    const result = await this.pool.query<RequestRow>(
      `
        UPDATE service_requests
        SET status = 'IN_PROCESS',
            completed_at = NULL,
            reservation_expires_at = NULL,
            status_history = status_history || $2::jsonb,
            updated_at = $3::timestamptz
        WHERE id::text = $1 AND status = 'COMPLETED'
        RETURNING id, client_request_id, guest_assignment_id, department, unit, room_id, room_number,
                  guest_name, items, guest_note, status, requested_at, confirmed_at, completed_at,
                  reservation_expires_at, cancelled_at, cancellation_reason, cancellation_source,
                  status_history, created_at, updated_at
      `,
      [id, JSON.stringify([historyEntry]), changedAt],
    );
    return result.rows[0] === undefined ? null : this.toRecord(result.rows[0]);
  }

  public async listExpiredReservations(before: string): Promise<RequestRecord[]> {
    await this.ensureInitialized();
    const result = await this.pool.query<RequestRow>(
      `SELECT id, client_request_id, guest_assignment_id, department, unit, room_id, room_number,
              guest_name, items, guest_note, status, requested_at, confirmed_at, completed_at,
              reservation_expires_at, cancelled_at, cancellation_reason, cancellation_source,
              status_history, created_at, updated_at
         FROM service_requests
        WHERE unit = 'BUTIK_INDONESIA'
          AND status = 'NEW'
          AND reservation_expires_at IS NOT NULL
          AND reservation_expires_at <= $1::timestamptz
        ORDER BY reservation_expires_at ASC
        LIMIT 100`,
      [before],
    );
    return result.rows.map((row) => this.toRecord(row));
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
      CREATE TABLE IF NOT EXISTS service_requests (
        id uuid PRIMARY KEY,
        client_request_id uuid NOT NULL,
        guest_assignment_id uuid,
        guest_name text,
        department text NOT NULL,
        unit text NOT NULL,
        room_id uuid NOT NULL,
        room_number text NOT NULL,
        items jsonb NOT NULL,
        guest_note text,
        status text NOT NULL,
        requested_at timestamptz NOT NULL,
        confirmed_at timestamptz,
        completed_at timestamptz,
        reservation_expires_at timestamptz,
        cancelled_at timestamptz,
        cancellation_reason text,
        cancellation_source text,
        status_history jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (room_id, client_request_id)
      )
    `);
    await this.pool.query(
      'ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS guest_assignment_id uuid',
    );
    await this.pool.query('ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS guest_name text');
    await this.pool.query(`
      ALTER TABLE service_requests
        ADD COLUMN IF NOT EXISTS reservation_expires_at timestamptz,
        ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
        ADD COLUMN IF NOT EXISTS cancellation_reason text,
        ADD COLUMN IF NOT EXISTS cancellation_source text
    `);
    await this.pool.query(
      'ALTER TABLE service_requests DROP CONSTRAINT IF EXISTS service_requests_room_id_client_request_id_key',
    );
    await this.pool.query('DROP INDEX IF EXISTS service_requests_context_client_idx');
    await this.pool.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS service_requests_context_client_unit_idx ON service_requests (COALESCE(guest_assignment_id, room_id), client_request_id, unit)',
    );
    await this.pool.query(
      'CREATE INDEX IF NOT EXISTS service_requests_unit_status_idx ON service_requests (unit, status, requested_at DESC)',
    );
    await this.pool.query(
      'CREATE INDEX IF NOT EXISTS service_requests_room_idx ON service_requests (room_number, requested_at DESC)',
    );
    await this.pool.query(
      'CREATE INDEX IF NOT EXISTS service_requests_guest_assignment_idx ON service_requests (guest_assignment_id, requested_at DESC)',
    );
  }

  private toRecord(row: RequestRow): RequestRecord {
    if (!isDepartmentCode(row.department)) {
      throw new Error(`Request ${row.id} contains an invalid department`);
    }
    if (!isUnitCode(row.unit)) throw new Error(`Request ${row.id} contains an invalid unit`);
    if (!isRequestStatus(row.status))
      throw new Error(`Request ${row.id} contains an invalid status`);

    const items = parseItems(row.items, row.id);
    for (const item of items) {
      if (!isUnitCode(item.unit) || !isRequestItemKind(item.kind)) {
        throw new Error(`Request ${row.id} contains an invalid item`);
      }
    }

    return {
      id: row.id,
      clientRequestId: row.client_request_id,
      guestAssignmentId: row.guest_assignment_id,
      guestName: row.guest_name,
      department: row.department,
      unit: row.unit,
      room: { id: row.room_id, number: row.room_number },
      items,
      guestNote: row.guest_note,
      status: row.status,
      requestedAt: this.toIsoString(row.requested_at),
      confirmedAt: row.confirmed_at === null ? null : this.toIsoString(row.confirmed_at),
      completedAt: row.completed_at === null ? null : this.toIsoString(row.completed_at),
      reservationExpiresAt:
        row.reservation_expires_at === null ? null : this.toIsoString(row.reservation_expires_at),
      cancelledAt: row.cancelled_at === null ? null : this.toIsoString(row.cancelled_at),
      cancellationReason: row.cancellation_reason,
      cancellationSource:
        row.cancellation_source === 'STAFF' || row.cancellation_source === 'AUTO_EXPIRY'
          ? row.cancellation_source
          : null,
      statusHistory: parseStatusHistory(row.status_history, row.id),
      createdAt: this.toIsoString(row.created_at),
      updatedAt: this.toIsoString(row.updated_at),
    };
  }

  private toIsoString(value: Date | string): string {
    return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === '23505'
  );
}
