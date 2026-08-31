import type { ReceptionistRoom } from './management-api';

export const RECEPTIONIST_ROOM_PAGE_SIZE = 10;
export const RECEPTIONIST_STAY_DAYS_MIN = 1;
export const RECEPTIONIST_STAY_DAYS_MAX = 365;

export type ReceptionistFloor = 1 | 2 | 3;
export type ReceptionistRoomStatus = 'VACANT' | 'OCCUPIED';

export interface ReceptionistFloorDefinition {
  floor: ReceptionistFloor;
  firstRoom: number;
  lastRoom: number;
}

export interface ReceptionistRoomPreview {
  id: string;
  number: string;
  floor: ReceptionistFloor;
  status: ReceptionistRoomStatus;
  assignmentId: string | null;
  guestName: string | null;
  stayDays: number | null;
}

/**
 * The physical building floor labels were confirmed separately from the room
 * number prefixes: Ground (G) has no guest rooms; guest floors are 1–3 and
 * retain the 2xx, 3xx, and 4xx room ranges supplied for the hotel.
 */
export const RECEPTIONIST_FLOORS: readonly ReceptionistFloorDefinition[] = [
  { floor: 1, firstRoom: 201, lastRoom: 238 },
  { floor: 2, firstRoom: 301, lastRoom: 338 },
  { floor: 3, firstRoom: 401, lastRoom: 438 },
];

export const RECEPTIONIST_GUEST_ROOM_TOTAL = RECEPTIONIST_FLOORS.reduce(
  (total, definition) => total + definition.lastRoom - definition.firstRoom + 1,
  0,
);

export function floorForReceptionistRoomNumber(roomNumber: string): ReceptionistFloor | null {
  const numericRoomNumber = Number(roomNumber);
  const definition = RECEPTIONIST_FLOORS.find(
    (candidate) =>
      numericRoomNumber >= candidate.firstRoom && numericRoomNumber <= candidate.lastRoom,
  );
  return definition?.floor ?? null;
}

export function mapReceptionistRoom(room: ReceptionistRoom): ReceptionistRoomPreview | null {
  const floor = floorForReceptionistRoomNumber(room.room.number);
  if (floor === null) return null;

  return {
    id: room.room.id,
    number: room.room.number,
    floor,
    status: room.roomStatus,
    assignmentId: room.activeAssignment?.id ?? null,
    guestName: room.activeAssignment?.guestName ?? null,
    stayDays: room.activeAssignment?.stayDays ?? null,
  };
}

/**
 * Deterministic fixture retained for isolated presentation tests. Runtime
 * pages use mapReceptionistRoom with the API response instead.
 */
export function createReceptionistPreviewRooms(): ReceptionistRoomPreview[] {
  return RECEPTIONIST_FLOORS.flatMap((definition) =>
    Array.from(
      { length: definition.lastRoom - definition.firstRoom + 1 },
      (_, index): ReceptionistRoomPreview => {
        const roomNumber = definition.firstRoom + index;
        return {
          id: String(roomNumber),
          number: String(roomNumber),
          floor: definition.floor,
          status: (index + 1) % 2 === 0 ? 'OCCUPIED' : 'VACANT',
          assignmentId: null,
          guestName: null,
          stayDays: null,
        };
      },
    ),
  );
}

export function filterReceptionistRooms(
  rooms: readonly ReceptionistRoomPreview[],
  query: string,
): ReceptionistRoomPreview[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (normalizedQuery.length === 0) return [...rooms];

  return rooms.filter(
    (room) =>
      room.number.toLocaleLowerCase().includes(normalizedQuery) ||
      room.guestName?.toLocaleLowerCase().includes(normalizedQuery) === true,
  );
}

export function getReceptionistRoomsForView(
  rooms: readonly ReceptionistRoomPreview[],
  activeFloor: ReceptionistFloor,
  query: string,
): ReceptionistRoomPreview[] {
  const searchedRooms = filterReceptionistRooms(rooms, query);
  if (query.trim().length > 0) return searchedRooms;

  return searchedRooms.filter((room) => room.floor === activeFloor);
}

export function paginateReceptionistRooms(
  rooms: readonly ReceptionistRoomPreview[],
  page: number,
  pageSize = RECEPTIONIST_ROOM_PAGE_SIZE,
): ReceptionistRoomPreview[] {
  if (pageSize < 1) return [];
  const safePage = Math.max(1, page);
  const startIndex = (safePage - 1) * pageSize;
  return rooms.slice(startIndex, startIndex + pageSize);
}

export function getReceptionistTotalPages(
  totalRooms: number,
  pageSize = RECEPTIONIST_ROOM_PAGE_SIZE,
): number {
  if (pageSize < 1) return 1;
  return Math.max(1, Math.ceil(totalRooms / pageSize));
}
