import { createHash, randomUUID } from 'node:crypto';

export const RECEPTIONIST_FLOOR_DEFINITIONS = [
  { floor: 1, firstRoom: 201, lastRoom: 238 },
  { floor: 2, firstRoom: 301, lastRoom: 338 },
  { floor: 3, firstRoom: 401, lastRoom: 438 },
] as const;

export type ReceptionistFloor = (typeof RECEPTIONIST_FLOOR_DEFINITIONS)[number]['floor'];
export type RoomStatus = 'VACANT' | 'OCCUPIED';
export type AssignmentStatus = 'ACTIVE' | 'CHECKED_OUT';
export const MIN_GUEST_STAY_DAYS = 1;
export const MAX_GUEST_STAY_DAYS = 365;

export interface RoomReference {
  id: string;
  number: string;
}

export interface ReceptionistRoomRecord {
  id: string;
  number: string;
  floor: ReceptionistFloor;
}

export interface StaffActor {
  id: string;
  displayName: string;
  role: string | null;
}

export interface GuestAssignmentRecord {
  id: string;
  room: RoomReference;
  guestName: string;
  stayDays: number;
  status: AssignmentStatus;
  assignedAt: string;
  updatedAt: string;
  checkedOutAt: string | null;
  assignedBy: StaffActor;
}

export interface ReceptionistRoomView {
  room: RoomReference;
  roomStatus: RoomStatus;
  activeAssignment: GuestAssignmentRecord | null;
}

export interface GuestAssignmentUpdatedEvent {
  eventId: string;
  occurredAt: string;
  room: RoomReference;
  roomStatus: RoomStatus;
  assignmentStatus: AssignmentStatus;
  guestName: string | null;
  stayDays: number | null;
  welcome: {
    message: string;
    guestName: string | null;
    personalized: boolean;
  };
}

export interface ListReceptionistRoomsInput {
  page: number;
  pageSize: number;
  status?: RoomStatus;
  search?: string;
}

export function roomIdForNumber(roomNumber: string): string {
  const digest = createHash('sha256')
    .update(`room-service-hadith:guest-room:${roomNumber}`, 'utf8')
    .digest('hex')
    .slice(0, 32);
  const versioned = `5${digest.slice(13, 16)}`;
  const variant = ((Number.parseInt(digest[16] as string, 16) & 0x3) | 0x8).toString(16);
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-${versioned}-${variant}${digest.slice(17, 20)}-${digest.slice(20)}`;
}

export const RECEPTIONIST_ROOM_CATALOG: readonly ReceptionistRoomRecord[] =
  RECEPTIONIST_FLOOR_DEFINITIONS.flatMap((definition) =>
    Array.from(
      { length: definition.lastRoom - definition.firstRoom + 1 },
      (_, index): ReceptionistRoomRecord => {
        const number = String(definition.firstRoom + index);
        return {
          id: roomIdForNumber(number),
          number,
          floor: definition.floor,
        };
      },
    ),
  );

export function cloneRoom(room: ReceptionistRoomRecord): ReceptionistRoomRecord {
  return { ...room };
}

export function cloneActor(actor: StaffActor): StaffActor {
  return { ...actor };
}

export function cloneAssignment(assignment: GuestAssignmentRecord): GuestAssignmentRecord {
  return {
    ...assignment,
    room: { ...assignment.room },
    assignedBy: cloneActor(assignment.assignedBy),
  };
}

export function cloneRoomView(view: ReceptionistRoomView): ReceptionistRoomView {
  return {
    room: { ...view.room },
    roomStatus: view.roomStatus,
    activeAssignment:
      view.activeAssignment === null ? null : cloneAssignment(view.activeAssignment),
  };
}

export function createAssignmentId(): string {
  return randomUUID();
}
