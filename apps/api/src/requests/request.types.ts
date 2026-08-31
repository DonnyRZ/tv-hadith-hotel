import type { UnitCode } from '../rbac/rbac.types';
import type { LocalizedText } from '../menu/menu.types';

export const REQUEST_STATUS_CODES = ['NEW', 'IN_PROCESS', 'COMPLETED'] as const;
export type RequestStatus = (typeof REQUEST_STATUS_CODES)[number];

export const DEPARTMENT_CODES = [
  'SPA',
  'FOOD_AND_BEVERAGES',
  'HOUSEKEEPING',
  'BEAUTY_AND_SALON',
  'CAFE',
] as const;
export type DepartmentCode = (typeof DEPARTMENT_CODES)[number];

export const ROOM_MANAGER_UNIT_CODES = ['SPA', 'RESTAURANT', 'LOUNGE', 'HOUSEKEEPING'] as const;
export type RoomManagerUnitCode = (typeof ROOM_MANAGER_UNIT_CODES)[number];

export type RequestItemKind = 'PRODUCT' | 'SERVICE';

export interface RequestRoomReference {
  id: string;
  number: string;
}

export interface RequestItemRecord {
  menuItemId: string;
  unit: UnitCode;
  kind: RequestItemKind;
  name: string;
  localizedName: LocalizedText;
  quantity: number;
  note: string | null;
  unitPrice: number | null;
  currency: string | null;
}

export interface RequestActor {
  id: string;
  displayName: string;
  role: Exclude<DepartmentCode, 'FOOD_AND_BEVERAGES'> | 'ROOM_MANAGER' | 'RECEPTIONIST' | null;
}

export interface RequestStatusHistoryEntry {
  id: string;
  fromStatus: RequestStatus | null;
  toStatus: RequestStatus;
  changedAt: string;
  changedBy: RequestActor | null;
}

export interface RequestRecord {
  id: string;
  clientRequestId: string;
  guestAssignmentId: string | null;
  department: DepartmentCode;
  unit: UnitCode;
  room: RequestRoomReference;
  items: RequestItemRecord[];
  guestNote: string | null;
  status: RequestStatus;
  requestedAt: string;
  confirmedAt: string | null;
  completedAt: string | null;
  statusHistory: RequestStatusHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateRequestRecordInput {
  clientRequestId: string;
  guestAssignmentId?: string | null;
  department: DepartmentCode;
  unit: UnitCode;
  room: RequestRoomReference;
  items: RequestItemRecord[];
  guestNote: string | null;
  requestedAt?: string;
}

export interface RequestListFilter {
  units: readonly UnitCode[];
  guestAssignmentId?: string;
  status?: RequestStatus;
  room?: string;
  dateFrom?: string;
  dateTo?: string;
  page: number;
  pageSize: number;
}

export interface RequestListResult {
  items: RequestRecord[];
  total: number;
}
