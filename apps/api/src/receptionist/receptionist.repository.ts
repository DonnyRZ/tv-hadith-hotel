import { randomUUID } from 'node:crypto';

import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, type PoolClient } from 'pg';

import {
  cloneAssignment,
  cloneRoom,
  cloneRoomView,
  createAssignmentId,
  RECEPTIONIST_ROOM_CATALOG,
  type AssignmentStatus,
  type GuestAssignmentRecord,
  type ListReceptionistRoomsInput,
  MAX_GUEST_STAY_DAYS,
  MIN_GUEST_STAY_DAYS,
  type ReceptionistRoomRecord,
  type ReceptionistRoomView,
  type RoomStatus,
  type StaffActor,
} from './receptionist.types';

export const RECEPTIONIST_REPOSITORY = Symbol('RECEPTIONIST_REPOSITORY');

export class RoomNotFoundError extends Error {
  public constructor() {
    super('The requested guest room does not exist.');
    this.name = 'RoomNotFoundError';
  }
}

export class RoomAssignmentConflictError extends Error {
  public constructor() {
    super('The room already has an active guest assignment.');
    this.name = 'RoomAssignmentConflictError';
  }
}

export class GuestAssignmentNotFoundError extends Error {
  public constructor() {
    super('The requested guest assignment does not exist.');
    this.name = 'GuestAssignmentNotFoundError';
  }
}

export class GuestAssignmentConflictError extends Error {
  public constructor() {
    super('The guest assignment is no longer active.');
    this.name = 'GuestAssignmentConflictError';
  }
}

export interface ReceptionistRepository {
  listRooms(input: ListReceptionistRoomsInput): Promise<{
    items: ReceptionistRoomView[];
    total: number;
  }>;
  findRoom(id: string): Promise<ReceptionistRoomView | null>;
  findActiveAssignmentByRoomId(roomId: string): Promise<GuestAssignmentRecord | null>;
  assignGuest(
    roomId: string,
    guestName: string,
    stayDays: number,
    assignedBy: StaffActor,
  ): Promise<GuestAssignmentRecord>;
  updateGuestAssignment(
    assignmentId: string,
    guestName: string,
    stayDays?: number,
  ): Promise<GuestAssignmentRecord>;
  checkoutGuestAssignment(assignmentId: string): Promise<GuestAssignmentRecord>;
}

function now(): string {
  return new Date().toISOString();
}

function roomStatus(activeAssignment: GuestAssignmentRecord | null): RoomStatus {
  return activeAssignment === null ? 'VACANT' : 'OCCUPIED';
}

function createRoomView(
  room: ReceptionistRoomRecord,
  activeAssignment: GuestAssignmentRecord | null,
): ReceptionistRoomView {
  return {
    room: { id: room.id, number: room.number },
    roomStatus: roomStatus(activeAssignment),
    activeAssignment,
  };
}

function matchesSearch(view: ReceptionistRoomView, normalizedSearch: string | undefined): boolean {
  if (normalizedSearch === undefined) return true;
  return (
    view.room.number.toLocaleLowerCase().includes(normalizedSearch) ||
    view.activeAssignment?.guestName.toLocaleLowerCase().includes(normalizedSearch) === true
  );
}

@Injectable()
export class InMemoryReceptionistRepository implements ReceptionistRepository {
  private readonly rooms = new Map<string, ReceptionistRoomRecord>(
    RECEPTIONIST_ROOM_CATALOG.map((room) => [room.id, cloneRoom(room)]),
  );

  private readonly assignments = new Map<string, GuestAssignmentRecord>();

  public async listRooms(input: ListReceptionistRoomsInput) {
    const normalizedSearch = input.search?.trim().toLocaleLowerCase();
    const filtered = [...this.rooms.values()]
      .map((room) => createRoomView(room, this.findActiveAssignmentRecordByRoomId(room.id)))
      .filter((view) => (input.status === undefined ? true : view.roomStatus === input.status))
      .filter((view) => matchesSearch(view, normalizedSearch))
      .sort((left, right) => Number(left.room.number) - Number(right.room.number));
    const offset = (input.page - 1) * input.pageSize;

    return {
      items: filtered.slice(offset, offset + input.pageSize).map((view) => cloneRoomView(view)),
      total: filtered.length,
    };
  }

  public async findRoom(id: string): Promise<ReceptionistRoomView | null> {
    const room = this.rooms.get(id);
    if (room === undefined) return null;
    return cloneRoomView(createRoomView(room, this.findActiveAssignmentRecordByRoomId(id)));
  }

  public async findActiveAssignmentByRoomId(roomId: string): Promise<GuestAssignmentRecord | null> {
    const assignment = this.findActiveAssignmentRecordByRoomId(roomId);
    return assignment === null ? null : cloneAssignment(assignment);
  }

  public async assignGuest(
    roomId: string,
    guestName: string,
    stayDays: number,
    assignedBy: StaffActor,
  ): Promise<GuestAssignmentRecord> {
    const room = this.rooms.get(roomId);
    if (room === undefined) throw new RoomNotFoundError();
    if (this.findActiveAssignmentRecordByRoomId(roomId) !== null) {
      throw new RoomAssignmentConflictError();
    }

    const timestamp = now();
    const assignment: GuestAssignmentRecord = {
      id: createAssignmentId(),
      room: { id: room.id, number: room.number },
      guestName,
      stayDays,
      status: 'ACTIVE',
      assignedAt: timestamp,
      updatedAt: timestamp,
      checkedOutAt: null,
      assignedBy: { ...assignedBy },
    };
    this.assignments.set(assignment.id, assignment);
    return cloneAssignment(assignment);
  }

  public async updateGuestAssignment(
    assignmentId: string,
    guestName: string,
    stayDays?: number,
  ): Promise<GuestAssignmentRecord> {
    const assignment = this.assignments.get(assignmentId);
    if (assignment === undefined) throw new GuestAssignmentNotFoundError();
    if (assignment.status !== 'ACTIVE') throw new GuestAssignmentConflictError();

    assignment.guestName = guestName;
    if (stayDays !== undefined) assignment.stayDays = stayDays;
    assignment.updatedAt = now();
    return cloneAssignment(assignment);
  }

  public async checkoutGuestAssignment(assignmentId: string): Promise<GuestAssignmentRecord> {
    const assignment = this.assignments.get(assignmentId);
    if (assignment === undefined) throw new GuestAssignmentNotFoundError();
    if (assignment.status !== 'ACTIVE') throw new GuestAssignmentConflictError();

    const timestamp = now();
    assignment.status = 'CHECKED_OUT';
    assignment.checkedOutAt = timestamp;
    assignment.updatedAt = timestamp;
    return cloneAssignment(assignment);
  }

  private findActiveAssignmentRecordByRoomId(roomId: string): GuestAssignmentRecord | null {
    return (
      [...this.assignments.values()].find(
        (assignment) => assignment.room.id === roomId && assignment.status === 'ACTIVE',
      ) ?? null
    );
  }
}

interface RoomRow {
  id: string;
  room_number: string;
  floor: number;
}

interface AssignmentRow {
  id: string;
  room_id: string;
  room_number: string;
  guest_name: string;
  stay_days: number;
  status: string;
  assigned_at: Date | string;
  updated_at: Date | string;
  checked_out_at: Date | string | null;
  assigned_by_id: string;
  assigned_by_name: string;
  assigned_by_role: string | null;
}

interface RoomListRow extends AssignmentRow {
  room_floor: number;
  assignment_id: string | null;
  assignment_guest_name: string | null;
  assignment_stay_days: number | null;
  assignment_status: string | null;
  assignment_assigned_at: Date | string | null;
  assignment_updated_at: Date | string | null;
  assignment_checked_out_at: Date | string | null;
  assignment_by_id: string | null;
  assignment_by_name: string | null;
  assignment_by_role: string | null;
  total_count?: number | string;
}

@Injectable()
export class PostgresReceptionistRepository implements ReceptionistRepository, OnModuleDestroy {
  private readonly pool: Pool;

  private initialization?: Promise<void>;

  public constructor(config: ConfigService) {
    const connectionString = config.get<string>('DATABASE_URL');
    if (connectionString === undefined || connectionString.trim().length === 0) {
      throw new Error('DATABASE_URL is required when AUTH_STORE=postgres');
    }
    this.pool = new Pool({ connectionString });
  }

  public async listRooms(input: ListReceptionistRoomsInput) {
    await this.ensureInitialized();
    const normalizedSearch = input.search?.trim();
    const searchPattern =
      normalizedSearch === undefined || normalizedSearch.length === 0
        ? null
        : `%${this.escapeLike(normalizedSearch.toLocaleLowerCase())}%`;
    const status = input.status ?? null;
    const result = await this.pool.query<RoomListRow>(
      `
        SELECT r.id AS room_id,
               r.room_number,
               r.floor AS room_floor,
               a.id AS assignment_id,
               a.guest_name AS assignment_guest_name,
               a.stay_days AS assignment_stay_days,
               a.status AS assignment_status,
               a.assigned_at AS assignment_assigned_at,
               a.updated_at AS assignment_updated_at,
               a.checked_out_at AS assignment_checked_out_at,
               a.assigned_by_id AS assignment_by_id,
               a.assigned_by_name AS assignment_by_name,
               a.assigned_by_role AS assignment_by_role,
               COUNT(*) OVER() AS total_count
        FROM hotel_rooms r
        LEFT JOIN LATERAL (
          SELECT id, guest_name, stay_days, status, assigned_at, updated_at, checked_out_at,
                 assigned_by_id, assigned_by_name, assigned_by_role
          FROM guest_room_assignments
          WHERE room_id = r.id AND status = 'ACTIVE'
          ORDER BY assigned_at DESC, id DESC
          LIMIT 1
        ) a ON true
        WHERE (
          $1::text IS NULL OR
          r.room_number ILIKE $1::text ESCAPE '\\' OR
          a.guest_name ILIKE $1::text ESCAPE '\\'
        )
          AND (
            $2::text IS NULL OR
            CASE WHEN a.id IS NULL THEN 'VACANT' ELSE 'OCCUPIED' END = $2::text
          )
        ORDER BY r.floor ASC, r.room_number::integer ASC
        LIMIT $3 OFFSET $4
      `,
      [searchPattern, status, input.pageSize, (input.page - 1) * input.pageSize],
    );

    return {
      items: result.rows.map((row) => this.toRoomView(row)),
      total: result.rows[0] === undefined ? 0 : Number(result.rows[0].total_count ?? 0),
    };
  }

  public async findRoom(id: string): Promise<ReceptionistRoomView | null> {
    await this.ensureInitialized();
    const result = await this.pool.query<RoomListRow>(
      `
        SELECT r.id AS room_id,
               r.room_number,
               r.floor AS room_floor,
               a.id AS assignment_id,
               a.guest_name AS assignment_guest_name,
               a.stay_days AS assignment_stay_days,
               a.status AS assignment_status,
               a.assigned_at AS assignment_assigned_at,
               a.updated_at AS assignment_updated_at,
               a.checked_out_at AS assignment_checked_out_at,
               a.assigned_by_id AS assignment_by_id,
               a.assigned_by_name AS assignment_by_name,
               a.assigned_by_role AS assignment_by_role
        FROM hotel_rooms r
        LEFT JOIN LATERAL (
          SELECT id, guest_name, stay_days, status, assigned_at, updated_at, checked_out_at,
                 assigned_by_id, assigned_by_name, assigned_by_role
          FROM guest_room_assignments
          WHERE room_id = r.id AND status = 'ACTIVE'
          ORDER BY assigned_at DESC, id DESC
          LIMIT 1
        ) a ON true
        WHERE r.id = $1::uuid
        LIMIT 1
      `,
      [id],
    );
    return result.rows[0] === undefined ? null : this.toRoomView(result.rows[0]);
  }

  public async findActiveAssignmentByRoomId(roomId: string): Promise<GuestAssignmentRecord | null> {
    await this.ensureInitialized();
    const result = await this.pool.query<AssignmentRow>(
      `
        SELECT a.id,
               a.room_id,
               r.room_number,
               a.guest_name,
               a.stay_days,
               a.status,
               a.assigned_at,
               a.updated_at,
               a.checked_out_at,
               a.assigned_by_id,
               a.assigned_by_name,
               a.assigned_by_role
        FROM guest_room_assignments a
        JOIN hotel_rooms r ON r.id = a.room_id
        WHERE a.room_id = $1::uuid AND a.status = 'ACTIVE'
        ORDER BY a.assigned_at DESC, a.id DESC
        LIMIT 1
      `,
      [roomId],
    );
    return result.rows[0] === undefined ? null : this.toAssignment(result.rows[0]);
  }

  public async assignGuest(
    roomId: string,
    guestName: string,
    stayDays: number,
    assignedBy: StaffActor,
  ): Promise<GuestAssignmentRecord> {
    await this.ensureInitialized();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const roomResult = await client.query<RoomRow>(
        'SELECT id, room_number, floor FROM hotel_rooms WHERE id = $1::uuid FOR UPDATE',
        [roomId],
      );
      const room = roomResult.rows[0];
      if (room === undefined) throw new RoomNotFoundError();

      const activeResult = await client.query<{ id: string }>(
        `
          SELECT id
          FROM guest_room_assignments
          WHERE room_id = $1::uuid AND status = 'ACTIVE'
          FOR UPDATE
        `,
        [roomId],
      );
      if (activeResult.rows[0] !== undefined) throw new RoomAssignmentConflictError();

      const id = randomUUID();
      const timestamp = new Date().toISOString();
      const result = await client.query<AssignmentRow>(
        `
          INSERT INTO guest_room_assignments
            (id, room_id, guest_name, stay_days, status, assigned_at, updated_at,
             checked_out_at, assigned_by_id, assigned_by_name, assigned_by_role)
          VALUES ($1::uuid, $2::uuid, $3, $4::integer, 'ACTIVE', $5::timestamptz, $5::timestamptz,
                  NULL, $6::uuid, $7, $8)
          RETURNING id, room_id, guest_name, stay_days, status, assigned_at, updated_at,
                    checked_out_at, assigned_by_id, assigned_by_name, assigned_by_role,
                    $9::text AS room_number
        `,
        [
          id,
          roomId,
          guestName,
          stayDays,
          timestamp,
          assignedBy.id,
          assignedBy.displayName,
          assignedBy.role,
          room.room_number,
        ],
      );
      await client.query('COMMIT');
      return this.toAssignment(result.rows[0] as AssignmentRow);
    } catch (error) {
      await this.rollback(client);
      throw error;
    } finally {
      client.release();
    }
  }

  public async updateGuestAssignment(
    assignmentId: string,
    guestName: string,
    stayDays?: number,
  ): Promise<GuestAssignmentRecord> {
    await this.ensureInitialized();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const current = await this.findAssignmentForUpdate(client, assignmentId);
      if (current === null) throw new GuestAssignmentNotFoundError();
      if (current.status !== 'ACTIVE') throw new GuestAssignmentConflictError();
      const timestamp = new Date().toISOString();
      const result =
        stayDays === undefined
          ? await client.query<AssignmentRow>(
              `
                UPDATE guest_room_assignments
                SET guest_name = $2, updated_at = $3::timestamptz
                WHERE id = $1::uuid AND status = 'ACTIVE'
                RETURNING id, room_id, guest_name, stay_days, status, assigned_at, updated_at,
                          checked_out_at, assigned_by_id, assigned_by_name, assigned_by_role,
                          $4::text AS room_number
              `,
              [assignmentId, guestName, timestamp, current.room_number],
            )
          : await client.query<AssignmentRow>(
              `
                UPDATE guest_room_assignments
                SET guest_name = $2, stay_days = $3::integer, updated_at = $4::timestamptz
                WHERE id = $1::uuid AND status = 'ACTIVE'
                RETURNING id, room_id, guest_name, stay_days, status, assigned_at, updated_at,
                          checked_out_at, assigned_by_id, assigned_by_name, assigned_by_role,
                          $5::text AS room_number
              `,
              [assignmentId, guestName, stayDays, timestamp, current.room_number],
            );
      await client.query('COMMIT');
      return this.toAssignment(result.rows[0] as AssignmentRow);
    } catch (error) {
      await this.rollback(client);
      throw error;
    } finally {
      client.release();
    }
  }

  public async checkoutGuestAssignment(assignmentId: string): Promise<GuestAssignmentRecord> {
    await this.ensureInitialized();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const current = await this.findAssignmentForUpdate(client, assignmentId);
      if (current === null) throw new GuestAssignmentNotFoundError();
      if (current.status !== 'ACTIVE') throw new GuestAssignmentConflictError();
      const timestamp = new Date().toISOString();
      const result = await client.query<AssignmentRow>(
        `
          UPDATE guest_room_assignments
          SET status = 'CHECKED_OUT',
              checked_out_at = $2::timestamptz,
              updated_at = $2::timestamptz
          WHERE id = $1::uuid AND status = 'ACTIVE'
          RETURNING id, room_id, guest_name, stay_days, status, assigned_at, updated_at,
                    checked_out_at, assigned_by_id, assigned_by_name, assigned_by_role,
                    $3::text AS room_number
        `,
        [assignmentId, timestamp, current.room_number],
      );
      await client.query('COMMIT');
      return this.toAssignment(result.rows[0] as AssignmentRow);
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
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS guest_room_assignments (
        id uuid PRIMARY KEY,
        room_id uuid NOT NULL REFERENCES hotel_rooms(id),
        guest_name text NOT NULL,
        stay_days integer NOT NULL
          CONSTRAINT guest_room_assignments_stay_days_range_check
          CHECK (stay_days BETWEEN ${MIN_GUEST_STAY_DAYS} AND ${MAX_GUEST_STAY_DAYS}),
        status text NOT NULL CHECK (status IN ('ACTIVE', 'CHECKED_OUT')),
        assigned_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL,
        checked_out_at timestamptz,
        assigned_by_id uuid NOT NULL,
        assigned_by_name text NOT NULL,
        assigned_by_role text
      )
    `);
    await this.pool.query(
      'ALTER TABLE guest_room_assignments ADD COLUMN IF NOT EXISTS stay_days integer',
    );
    await this.pool.query(
      'UPDATE guest_room_assignments SET stay_days = $1 WHERE stay_days IS NULL',
      [MIN_GUEST_STAY_DAYS],
    );
    await this.pool.query('ALTER TABLE guest_room_assignments ALTER COLUMN stay_days SET NOT NULL');
    await this.pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'guest_room_assignments_stay_days_range_check'
        ) THEN
          ALTER TABLE guest_room_assignments
            ADD CONSTRAINT guest_room_assignments_stay_days_range_check
            CHECK (stay_days BETWEEN ${MIN_GUEST_STAY_DAYS} AND ${MAX_GUEST_STAY_DAYS});
        END IF;
      END $$;
    `);
    await this.pool.query(
      "CREATE UNIQUE INDEX IF NOT EXISTS guest_room_assignments_active_room_idx ON guest_room_assignments (room_id) WHERE status = 'ACTIVE'",
    );
    await this.pool.query(
      'CREATE INDEX IF NOT EXISTS guest_room_assignments_guest_name_idx ON guest_room_assignments (guest_name)',
    );
    for (const room of RECEPTIONIST_ROOM_CATALOG) {
      await this.pool.query(
        `
          INSERT INTO hotel_rooms (id, room_number, floor)
          VALUES ($1::uuid, $2, $3)
          ON CONFLICT (room_number) DO NOTHING
        `,
        [room.id, room.number, room.floor],
      );
    }
  }

  private async findAssignmentForUpdate(
    client: PoolClient,
    assignmentId: string,
  ): Promise<(AssignmentRow & { room_number: string }) | null> {
    const result = await client.query<AssignmentRow & { room_number: string }>(
      `
        SELECT a.id, a.room_id, r.room_number, a.guest_name, a.stay_days, a.status,
               a.assigned_at, a.updated_at, a.checked_out_at,
               a.assigned_by_id, a.assigned_by_name, a.assigned_by_role
        FROM guest_room_assignments a
        JOIN hotel_rooms r ON r.id = a.room_id
        WHERE a.id = $1::uuid
        FOR UPDATE
      `,
      [assignmentId],
    );
    return result.rows[0] ?? null;
  }

  private toRoomView(row: RoomListRow): ReceptionistRoomView {
    const assignment =
      row.assignment_id === null
        ? null
        : this.toAssignment({
            id: row.assignment_id,
            room_id: row.room_id,
            room_number: row.room_number,
            guest_name: row.assignment_guest_name as string,
            stay_days: row.assignment_stay_days as number,
            status: row.assignment_status as string,
            assigned_at: row.assignment_assigned_at as Date | string,
            updated_at: row.assignment_updated_at as Date | string,
            checked_out_at: row.assignment_checked_out_at,
            assigned_by_id: row.assignment_by_id as string,
            assigned_by_name: row.assignment_by_name as string,
            assigned_by_role: row.assignment_by_role,
          });
    return {
      room: { id: row.room_id, number: row.room_number },
      roomStatus: roomStatus(assignment),
      activeAssignment: assignment,
    };
  }

  private toAssignment(row: AssignmentRow): GuestAssignmentRecord {
    if (row.status !== 'ACTIVE' && row.status !== 'CHECKED_OUT') {
      throw new Error(`Guest assignment ${row.id} contains an invalid status`);
    }
    return {
      id: row.id,
      room: { id: row.room_id, number: row.room_number },
      guestName: row.guest_name,
      stayDays: row.stay_days,
      status: row.status as AssignmentStatus,
      assignedAt: this.toIsoString(row.assigned_at),
      updatedAt: this.toIsoString(row.updated_at),
      checkedOutAt: row.checked_out_at === null ? null : this.toIsoString(row.checked_out_at),
      assignedBy: {
        id: row.assigned_by_id,
        displayName: row.assigned_by_name,
        role: row.assigned_by_role,
      },
    };
  }

  private toIsoString(value: Date | string): string {
    return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
  }

  private escapeLike(value: string): string {
    return value.replace(/[\\%_]/g, (character) => `\\${character}`);
  }

  private async rollback(client: PoolClient): Promise<void> {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Preserve the original mutation error.
    }
  }
}
