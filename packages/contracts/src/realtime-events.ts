export const STAFF_REALTIME_NAMESPACE = '/staff-realtime' as const;

export const STAFF_REALTIME_EVENT_TYPES = [
  'staff.request.created',
  'staff.request.updated',
  'staff.room.updated',
  'staff.boutique.catalog.updated',
  'staff.boutique.inventory.updated',
] as const;

export type StaffRealtimeEventType = (typeof STAFF_REALTIME_EVENT_TYPES)[number];

export type StaffRealtimeUnit =
  | 'SPA'
  | 'RESTAURANT'
  | 'LOUNGE'
  | 'HOUSEKEEPING'
  | 'BEAUTY_AND_SALON'
  | 'CAFE'
  | 'BUTIK_INDONESIA';

export type StaffRequestStatus = 'NEW' | 'IN_PROCESS' | 'COMPLETED' | 'CANCELLED';

const STAFF_REALTIME_UNITS: readonly StaffRealtimeUnit[] = [
  'SPA',
  'RESTAURANT',
  'LOUNGE',
  'HOUSEKEEPING',
  'BEAUTY_AND_SALON',
  'CAFE',
  'BUTIK_INDONESIA',
];

const STAFF_REQUEST_STATUSES: readonly StaffRequestStatus[] = [
  'NEW',
  'IN_PROCESS',
  'COMPLETED',
  'CANCELLED',
];

export interface StaffRealtimeEventBase<TType extends StaffRealtimeEventType> {
  eventId: string;
  eventType: TType;
  occurredAt: string;
  entityId: string;
  updatedAt: string;
}

export interface StaffRequestCreatedEvent extends StaffRealtimeEventBase<'staff.request.created'> {
  unit: StaffRealtimeUnit;
  status: 'NEW';
  roomId: string;
  guestAssignmentId: string | null;
}

export interface StaffRequestUpdatedEvent extends StaffRealtimeEventBase<'staff.request.updated'> {
  unit: StaffRealtimeUnit;
  status: StaffRequestStatus;
  roomId: string;
  guestAssignmentId: string | null;
}

export interface StaffRoomUpdatedEvent extends StaffRealtimeEventBase<'staff.room.updated'> {
  roomId: string;
  roomNumber: string;
  roomStatus: 'VACANT' | 'OCCUPIED';
}

export interface StaffBoutiqueCatalogUpdatedEvent extends StaffRealtimeEventBase<'staff.boutique.catalog.updated'> {
  unit: 'BUTIK_INDONESIA';
  resource: 'category' | 'product' | 'variant';
  action: 'created' | 'updated' | 'activated' | 'deactivated';
}

export interface StaffBoutiqueInventoryUpdatedEvent extends StaffRealtimeEventBase<'staff.boutique.inventory.updated'> {
  unit: 'BUTIK_INDONESIA';
  variantId: string;
}

export type StaffRealtimeEvent =
  | StaffRequestCreatedEvent
  | StaffRequestUpdatedEvent
  | StaffRoomUpdatedEvent
  | StaffBoutiqueCatalogUpdatedEvent
  | StaffBoutiqueInventoryUpdatedEvent;

export function isStaffRealtimeEventType(value: unknown): value is StaffRealtimeEventType {
  return (
    typeof value === 'string' && (STAFF_REALTIME_EVENT_TYPES as readonly string[]).includes(value)
  );
}

export function isStaffRealtimeEvent(value: unknown): value is StaffRealtimeEvent {
  if (!isRecord(value) || !isStaffRealtimeEventType(value.eventType)) return false;
  if (
    typeof value.eventId !== 'string' ||
    typeof value.occurredAt !== 'string' ||
    typeof value.entityId !== 'string' ||
    typeof value.updatedAt !== 'string'
  ) {
    return false;
  }

  switch (value.eventType) {
    case 'staff.request.created':
      return (
        value.status === 'NEW' &&
        isStaffRealtimeUnit(value.unit) &&
        typeof value.roomId === 'string' &&
        (value.guestAssignmentId === null || typeof value.guestAssignmentId === 'string')
      );
    case 'staff.request.updated':
      return (
        isStaffRealtimeUnit(value.unit) &&
        isStaffRequestStatus(value.status) &&
        typeof value.roomId === 'string' &&
        (value.guestAssignmentId === null || typeof value.guestAssignmentId === 'string')
      );
    case 'staff.room.updated':
      return (
        typeof value.roomId === 'string' &&
        typeof value.roomNumber === 'string' &&
        (value.roomStatus === 'VACANT' || value.roomStatus === 'OCCUPIED')
      );
    case 'staff.boutique.catalog.updated':
      return (
        value.unit === 'BUTIK_INDONESIA' &&
        (value.resource === 'category' ||
          value.resource === 'product' ||
          value.resource === 'variant') &&
        (value.action === 'created' ||
          value.action === 'updated' ||
          value.action === 'activated' ||
          value.action === 'deactivated')
      );
    case 'staff.boutique.inventory.updated':
      return value.unit === 'BUTIK_INDONESIA' && typeof value.variantId === 'string';
    default:
      return false;
  }
}

function isStaffRealtimeUnit(value: unknown): value is StaffRealtimeUnit {
  return typeof value === 'string' && STAFF_REALTIME_UNITS.includes(value as StaffRealtimeUnit);
}

function isStaffRequestStatus(value: unknown): value is StaffRequestStatus {
  return typeof value === 'string' && STAFF_REQUEST_STATUSES.includes(value as StaffRequestStatus);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
