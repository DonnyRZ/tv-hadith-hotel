import { randomUUID } from 'node:crypto';

import { HttpStatus, Inject, Injectable } from '@nestjs/common';

import { ApiException } from '../auth/api-exception';
import type { PublicStaffUser } from '../auth/auth.types';
import type { AssignGuestDto } from './dto/assign-guest.dto';
import type { ListReceptionistRoomsDto } from './dto/list-receptionist-rooms.dto';
import type { UpdateGuestAssignmentDto } from './dto/update-guest-assignment.dto';
import { RoomAssignmentEventBus } from './room-assignment-events';
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
    return { items: result.items, page, pageSize, total: result.total };
  }

  public async getRoom(roomId: string): Promise<ReceptionistRoomView> {
    const room = await this.repository.findRoom(roomId);
    if (room === null) throw this.roomNotFound();
    return room;
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
}
