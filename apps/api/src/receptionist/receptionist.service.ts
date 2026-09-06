import { randomUUID } from 'node:crypto';

import { HttpStatus, Inject, Injectable } from '@nestjs/common';

import { ApiException } from '../auth/api-exception';
import type { PublicStaffUser } from '../auth/auth.types';
import { UNIT_CODES } from '../rbac/rbac.types';
import { REQUEST_REPOSITORY } from '../requests/request.repository';
import type { RequestRepository } from '../requests/request.repository';
import type { AssignGuestDto } from './dto/assign-guest.dto';
import type { ListFolioOrdersDto } from './dto/list-folio-orders.dto';
import type { ListReceptionistRoomsDto } from './dto/list-receptionist-rooms.dto';
import type { UpdateGuestAssignmentDto } from './dto/update-guest-assignment.dto';
import { RoomAssignmentEventBus } from './room-assignment-events';
import {
  emptyFolioResponse,
  summarizeFolioRequests,
  toReceptionistFolioOrder,
  type ReceptionistFolioHistoryListResponse,
  type ReceptionistFolioResponse,
} from './receptionist-folio';
import {
  GuestAssignmentConflictError,
  GuestAssignmentNotFoundError,
  RECEPTIONIST_REPOSITORY,
  RoomAssignmentConflictError,
  RoomNotFoundError,
} from './receptionist.repository';
import type { ReceptionistRepository } from './receptionist.repository';
import type {
  GuestAssignmentRecord,
  GuestAssignmentUpdatedEvent,
  ReceptionistRoomView,
  RoomStatus,
} from './receptionist.types';
import { MAX_GUEST_STAY_DAYS, MIN_GUEST_STAY_DAYS } from './receptionist.types';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 25;

@Injectable()
export class ReceptionistService {
  public constructor(
    @Inject(RECEPTIONIST_REPOSITORY)
    private readonly repository: ReceptionistRepository,
    private readonly eventBus: RoomAssignmentEventBus,
    @Inject(REQUEST_REPOSITORY)
    private readonly requestRepository: RequestRepository,
  ) {}

  public async listRooms(query: ListReceptionistRoomsDto) {
    const page = query.page ?? DEFAULT_PAGE;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const result = await this.repository.listRooms({
      page,
      pageSize,
      ...(query.status === undefined ? {} : { status: query.status }),
      ...(query.search?.trim().length === 0 || query.search === undefined
        ? {}
        : { search: query.search.trim() }),
    });
    return {
      items: await this.withFolioSummaries(result.items),
      page,
      pageSize,
      total: result.total,
    };
  }

  public async getRoom(roomId: string): Promise<ReceptionistRoomView> {
    const room = await this.repository.findRoom(roomId);
    if (room === null) throw this.roomNotFound();
    const [withSummary] = await this.withFolioSummaries([room]);
    return withSummary ?? room;
  }

  public async getActiveFolio(
    roomId: string,
    query: ListFolioOrdersDto,
  ): Promise<ReceptionistFolioResponse> {
    const room = await this.repository.findRoom(roomId);
    if (room === null) throw this.roomNotFound();

    const page = query.page ?? DEFAULT_PAGE;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const assignment = room.activeAssignment;
    if (assignment === null) return emptyFolioResponse(room.room, null, page, pageSize);

    const result = await this.requestRepository.list({
      units: UNIT_CODES,
      guestAssignmentId: assignment.id,
      page,
      pageSize,
    });
    const allForSummary = await this.requestRepository.listByGuestAssignmentIds([assignment.id]);
    return {
      room: { ...room.room },
      assignment: { ...assignment, room: { ...assignment.room } },
      orders: result.items.map(toReceptionistFolioOrder),
      summary: summarizeFolioRequests(allForSummary),
      page,
      pageSize,
      total: result.total,
      lastUpdated: new Date().toISOString(),
    };
  }

  public async listFolioHistory(
    roomId: string,
    query: ListFolioOrdersDto,
  ): Promise<ReceptionistFolioHistoryListResponse> {
    const room = await this.repository.findRoom(roomId);
    if (room === null) throw this.roomNotFound();

    const page = query.page ?? DEFAULT_PAGE;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const assignments = await this.repository.listGuestAssignmentsByRoomId(roomId, page, pageSize);
    const requests = await this.requestRepository.listByGuestAssignmentIds(
      assignments.items.map((assignment) => assignment.id),
    );
    const requestsByAssignment = new Map<string, typeof requests>();
    for (const request of requests) {
      if (request.guestAssignmentId === null) continue;
      const assignmentRequests = requestsByAssignment.get(request.guestAssignmentId) ?? [];
      assignmentRequests.push(request);
      requestsByAssignment.set(request.guestAssignmentId, assignmentRequests);
    }

    return {
      room: { ...room.room },
      items: assignments.items.map((assignment) => ({
        assignment: { ...assignment, room: { ...assignment.room } },
        summary: summarizeFolioRequests(requestsByAssignment.get(assignment.id) ?? []),
      })),
      page,
      pageSize,
      total: assignments.total,
      lastUpdated: new Date().toISOString(),
    };
  }

  public async getFolioHistoryDetail(
    roomId: string,
    assignmentId: string,
    query: ListFolioOrdersDto,
  ): Promise<ReceptionistFolioResponse> {
    const room = await this.repository.findRoom(roomId);
    if (room === null) throw this.roomNotFound();
    const assignment = await this.repository.findGuestAssignmentByRoomId(roomId, assignmentId);
    if (assignment === null || assignment.status !== 'CHECKED_OUT') {
      throw this.guestAssignmentNotFound();
    }

    const page = query.page ?? DEFAULT_PAGE;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const result = await this.requestRepository.list({
      units: UNIT_CODES,
      guestAssignmentId: assignment.id,
      page,
      pageSize,
    });
    const allForSummary = await this.requestRepository.listByGuestAssignmentIds([assignment.id]);
    return {
      room: { ...room.room },
      assignment: { ...assignment, room: { ...assignment.room } },
      orders: result.items.map(toReceptionistFolioOrder),
      summary: summarizeFolioRequests(allForSummary),
      page,
      pageSize,
      total: result.total,
      lastUpdated: new Date().toISOString(),
    };
  }

  public async assignGuest(
    roomId: string,
    input: AssignGuestDto,
    staff: PublicStaffUser,
  ): Promise<GuestAssignmentRecord> {
    const guestName = this.normalizeGuestName(input.guestName);
    const stayDays = this.normalizeStayDays(input.stayDays);
    try {
      const assignment = await this.repository.assignGuest(
        roomId,
        guestName,
        stayDays,
        this.toActor(staff),
      );
      this.publishAssignmentEvent(assignment, 'OCCUPIED');
      return assignment;
    } catch (error) {
      this.rethrowMutationError(error);
      throw error;
    }
  }

  public async updateGuestAssignment(
    assignmentId: string,
    input: UpdateGuestAssignmentDto,
  ): Promise<GuestAssignmentRecord> {
    const guestName = this.normalizeGuestName(input.guestName);
    const stayDays =
      input.stayDays === undefined ? undefined : this.normalizeStayDays(input.stayDays);
    try {
      const assignment = await this.repository.updateGuestAssignment(
        assignmentId,
        guestName,
        stayDays,
      );
      this.publishAssignmentEvent(assignment, 'OCCUPIED');
      return assignment;
    } catch (error) {
      this.rethrowMutationError(error);
      throw error;
    }
  }

  public async checkoutGuestAssignment(assignmentId: string): Promise<GuestAssignmentRecord> {
    try {
      const assignment = await this.repository.checkoutGuestAssignment(assignmentId);
      this.publishAssignmentEvent(assignment, 'VACANT');
      return assignment;
    } catch (error) {
      this.rethrowMutationError(error);
      throw error;
    }
  }

  private normalizeGuestName(value: string): string {
    const guestName = value.trim().replace(/\s+/g, ' ');
    if (guestName.length === 0) {
      throw new ApiException(HttpStatus.BAD_REQUEST, {
        code: 'GUEST_NAME_REQUIRED',
        message: 'Guest name is required.',
      });
    }
    if (guestName.length > 200) {
      throw new ApiException(HttpStatus.BAD_REQUEST, {
        code: 'GUEST_NAME_TOO_LONG',
        message: 'Guest name must not exceed 200 characters.',
      });
    }
    return guestName;
  }

  private normalizeStayDays(value: number): number {
    if (!Number.isInteger(value) || value < MIN_GUEST_STAY_DAYS || value > MAX_GUEST_STAY_DAYS) {
      throw new ApiException(HttpStatus.BAD_REQUEST, {
        code: 'STAY_DAYS_INVALID',
        message: `Stay days must be an integer between ${MIN_GUEST_STAY_DAYS} and ${MAX_GUEST_STAY_DAYS}.`,
      });
    }
    return value;
  }

  private toActor(staff: PublicStaffUser) {
    return {
      id: staff.id,
      displayName: staff.displayName,
      role: staff.roles[0] ?? null,
    };
  }

  private publishAssignmentEvent(assignment: GuestAssignmentRecord, status: RoomStatus): void {
    const guestName = status === 'OCCUPIED' ? assignment.guestName : null;
    const stayDays = status === 'OCCUPIED' ? assignment.stayDays : null;
    const personalized = guestName !== null;
    const event: GuestAssignmentUpdatedEvent = {
      eventId: randomUUID(),
      occurredAt: new Date().toISOString(),
      room: { ...assignment.room },
      roomStatus: status,
      assignmentStatus: assignment.status,
      guestName,
      stayDays,
      welcome: {
        message: personalized ? `Welcome, ${guestName}` : 'Welcome',
        guestName,
        personalized,
      },
    };
    this.eventBus.publish(event);
  }

  private rethrowMutationError(error: unknown): void {
    if (error instanceof RoomNotFoundError) throw this.roomNotFound();
    if (error instanceof RoomAssignmentConflictError) {
      throw new ApiException(HttpStatus.CONFLICT, {
        code: 'ROOM_ASSIGNMENT_CONFLICT',
        message: 'This room is already occupied. Refresh the room board and try again.',
      });
    }
    if (error instanceof GuestAssignmentNotFoundError) {
      throw new ApiException(HttpStatus.NOT_FOUND, {
        code: 'GUEST_ASSIGNMENT_NOT_FOUND',
        message: 'The guest assignment no longer exists.',
      });
    }
    if (error instanceof GuestAssignmentConflictError) {
      throw new ApiException(HttpStatus.CONFLICT, {
        code: 'GUEST_ASSIGNMENT_CONFLICT',
        message: 'The guest assignment is no longer active. Refresh the room board.',
      });
    }
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === '23505'
    ) {
      throw new ApiException(HttpStatus.CONFLICT, {
        code: 'ROOM_ASSIGNMENT_CONFLICT',
        message: 'This room is already occupied. Refresh the room board and try again.',
      });
    }
  }

  private roomNotFound(): ApiException {
    return new ApiException(HttpStatus.NOT_FOUND, {
      code: 'ROOM_NOT_FOUND',
      message: 'The requested guest room does not exist.',
    });
  }

  private guestAssignmentNotFound(): ApiException {
    return new ApiException(HttpStatus.NOT_FOUND, {
      code: 'GUEST_ASSIGNMENT_NOT_FOUND',
      message: 'The requested guest assignment does not exist for this room.',
    });
  }

  private async withFolioSummaries(
    rooms: readonly ReceptionistRoomView[],
  ): Promise<ReceptionistRoomView[]> {
    const assignmentIds = rooms
      .map((room) => room.activeAssignment?.id)
      .filter((id): id is string => id !== undefined);
    if (assignmentIds.length === 0) return rooms.map((room) => ({ ...room }));

    const requests = await this.requestRepository.listByGuestAssignmentIds(assignmentIds);
    const requestsByAssignment = new Map<string, typeof requests>();
    for (const request of requests) {
      if (request.guestAssignmentId === null) continue;
      const assignmentRequests = requestsByAssignment.get(request.guestAssignmentId) ?? [];
      assignmentRequests.push(request);
      requestsByAssignment.set(request.guestAssignmentId, assignmentRequests);
    }

    return rooms.map((room) => ({
      ...room,
      folioSummary:
        room.activeAssignment === null
          ? room.folioSummary
          : summarizeFolioRequests(requestsByAssignment.get(room.activeAssignment.id) ?? []),
    }));
  }
}
