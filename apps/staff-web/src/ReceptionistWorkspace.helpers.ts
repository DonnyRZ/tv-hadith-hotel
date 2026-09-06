import type {
  ReceptionistFolioSummary,
  ReceptionistRoom,
  ReceptionistFolioResponse,
  ReceptionistFolioHistoryResponse,
} from './management-api';

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
  folioSummary: ReceptionistFolioSummary;
}

const RECEPTIONIST_ROOM_CACHE_VERSION = 2;
const RECEPTIONIST_ROOM_CACHE_PREFIX = 'room-service:receptionist-rooms:v2:';
const RECEPTIONIST_FOLIO_CACHE_VERSION = 1;
const RECEPTIONIST_FOLIO_CACHE_PREFIX = 'room-service:receptionist-folio:v1:';

interface ReceptionistRoomCachePayload {
  version: typeof RECEPTIONIST_ROOM_CACHE_VERSION;
  rooms: ReceptionistRoomPreview[];
}

function receptionistRoomCacheKey(userId: string): string {
  return `${RECEPTIONIST_ROOM_CACHE_PREFIX}${encodeURIComponent(userId)}`;
}

type ReceptionistFolioCacheScope = 'active' | 'history' | 'history-detail';

function receptionistFolioCacheKey(
  userId: string,
  roomId: string,
  assignmentId: string | null,
  scope: ReceptionistFolioCacheScope,
): string {
  return `${RECEPTIONIST_FOLIO_CACHE_PREFIX}${encodeURIComponent(userId)}:${encodeURIComponent(
    roomId,
  )}:${encodeURIComponent(assignmentId ?? 'none')}:${scope}`;
}

function getSessionStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isCachedRoom(value: unknown): value is ReceptionistRoomPreview {
  if (value === null || typeof value !== 'object') return false;
  const room = value as Partial<ReceptionistRoomPreview>;
  return (
    typeof room.id === 'string' &&
    typeof room.number === 'string' &&
    (room.floor === 1 || room.floor === 2 || room.floor === 3) &&
    (room.status === 'VACANT' || room.status === 'OCCUPIED') &&
    (room.assignmentId === null || typeof room.assignmentId === 'string') &&
    (room.guestName === null || typeof room.guestName === 'string') &&
    (room.stayDays === null || typeof room.stayDays === 'number') &&
    isCachedFolioSummary(room.folioSummary)
  );
}

function isCachedFolioSummary(value: unknown): value is ReceptionistFolioSummary {
  if (value === null || typeof value !== 'object') return false;
  const summary = value as Partial<ReceptionistFolioSummary>;
  const statusCounts = summary.statusCounts as Partial<ReceptionistFolioSummary['statusCounts']>;
  return (
    typeof summary.orderCount === 'number' &&
    typeof summary.openOrderCount === 'number' &&
    typeof summary.itemCount === 'number' &&
    typeof summary.unpricedItemCount === 'number' &&
    typeof summary.isTotalComplete === 'boolean' &&
    (summary.lastOrderAt === null || typeof summary.lastOrderAt === 'string') &&
    Array.isArray(summary.totalsByCurrency) &&
    summary.totalsByCurrency.every(
      (amount) =>
        amount !== null &&
        typeof amount === 'object' &&
        typeof (amount as { currency?: unknown }).currency === 'string' &&
        typeof (amount as { amount?: unknown }).amount === 'number',
    ) &&
    statusCounts !== null &&
    typeof statusCounts === 'object' &&
    typeof statusCounts.NEW === 'number' &&
    typeof statusCounts.IN_PROCESS === 'number' &&
    typeof statusCounts.COMPLETED === 'number' &&
    typeof statusCounts.CANCELLED === 'number'
  );
}

export function readReceptionistRoomCache(userId: string): ReceptionistRoomPreview[] | null {
  const storage = getSessionStorage();
  if (storage === null) return null;
  try {
    const raw = storage.getItem(receptionistRoomCacheKey(userId));
    if (raw === null) return null;
    const payload = JSON.parse(raw) as Partial<ReceptionistRoomCachePayload>;
    if (
      payload.version !== RECEPTIONIST_ROOM_CACHE_VERSION ||
      !Array.isArray(payload.rooms) ||
      !payload.rooms.every(isCachedRoom)
    ) {
      return null;
    }
    return payload.rooms;
  } catch {
    return null;
  }
}

export function writeReceptionistRoomCache(
  userId: string,
  rooms: readonly ReceptionistRoomPreview[],
): void {
  const storage = getSessionStorage();
  if (storage === null) return;
  try {
    const payload: ReceptionistRoomCachePayload = {
      version: RECEPTIONIST_ROOM_CACHE_VERSION,
      rooms: [...rooms],
    };
    storage.setItem(receptionistRoomCacheKey(userId), JSON.stringify(payload));
  } catch {
    // A full or restricted sessionStorage must never block the live API path.
  }
}

export function readReceptionistFolioCache<
  T extends ReceptionistFolioResponse | ReceptionistFolioHistoryResponse,
>(
  userId: string,
  roomId: string,
  assignmentId: string | null,
  scope: ReceptionistFolioCacheScope,
): T | null {
  const storage = getSessionStorage();
  if (storage === null) return null;
  try {
    const raw = storage.getItem(receptionistFolioCacheKey(userId, roomId, assignmentId, scope));
    if (raw === null) return null;
    const payload = JSON.parse(raw) as { version?: unknown; data?: unknown };
    if (payload.version !== RECEPTIONIST_FOLIO_CACHE_VERSION || !isRecord(payload.data)) {
      return null;
    }
    return payload.data as T;
  } catch {
    return null;
  }
}

export function writeReceptionistFolioCache<
  T extends ReceptionistFolioResponse | ReceptionistFolioHistoryResponse,
>(
  userId: string,
  roomId: string,
  assignmentId: string | null,
  scope: ReceptionistFolioCacheScope,
  data: T,
): void {
  const storage = getSessionStorage();
  if (storage === null) return;
  try {
    storage.setItem(
      receptionistFolioCacheKey(userId, roomId, assignmentId, scope),
      JSON.stringify({ version: RECEPTIONIST_FOLIO_CACHE_VERSION, data }),
    );
  } catch {
    // A full or restricted sessionStorage must never block the live API path.
  }
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

export function emptyReceptionistFolioSummary(): ReceptionistFolioSummary {
  return {
    orderCount: 0,
    openOrderCount: 0,
    statusCounts: { NEW: 0, IN_PROCESS: 0, COMPLETED: 0, CANCELLED: 0 },
    itemCount: 0,
    totalsByCurrency: [],
    unpricedItemCount: 0,
    isTotalComplete: true,
    lastOrderAt: null,
  };
}

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
    folioSummary: room.folioSummary,
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
          folioSummary: emptyReceptionistFolioSummary(),
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
