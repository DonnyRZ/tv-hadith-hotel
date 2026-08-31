import type { GuestAssignmentRecord, RoomReference } from '../receptionist/receptionist.types';
import type { DepartmentCode, RequestRecord } from '../requests/request.types';
import type { UnitCode } from '../rbac/rbac.types';

export const GUEST_DISABLED_REASONS = ['MENU_NOT_CONFIGURED'] as const;
export type GuestDisabledReason = (typeof GUEST_DISABLED_REASONS)[number];

export interface GuestDepartmentUnit {
  code: UnitCode;
  department: DepartmentCode;
  name: string;
  roomManagerMonitoring: boolean;
  enabled: boolean;
  disabledReason: GuestDisabledReason | null;
}

export interface GuestDepartment {
  code: DepartmentCode;
  name: string;
  units: GuestDepartmentUnit[];
}

export interface ResolvedGuestContext {
  room: RoomReference;
  assignment: GuestAssignmentRecord;
  source: 'QR' | 'TV';
}

export interface GuestContextResponse {
  room: RoomReference;
  roomStatus: 'OCCUPIED';
  welcome: {
    message: string;
    guestName: string;
    personalized: true;
  };
  availableUnits: UnitCode[];
}

export type GuestRequestResponse = Omit<RequestRecord, 'room' | 'guestAssignmentId'>;

export interface GuestQrTokenRecord {
  id: string;
  roomId: string;
  tokenHash: string;
  active: boolean;
  createdAt: string;
  revokedAt: string | null;
}

export interface IssuedGuestQrToken {
  record: GuestQrTokenRecord;
  token: string;
}

export interface GuestQrRoomStatus {
  room: RoomReference;
  active: boolean;
  issuedAt: string | null;
  revokedAt: string | null;
}
