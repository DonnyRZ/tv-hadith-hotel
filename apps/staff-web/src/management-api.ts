export interface ManagedUser {
  id: string;
  email: string;
  displayName: string;
  roles: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ManagedRole {
  id: string;
  code: string;
  name: string;
  description: string;
  system: boolean;
  permissions: string[];
  userCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserInput {
  email: string;
  displayName: string;
  roles: string[];
  password: string;
}

export interface UpdateUserInput {
  email: string;
  displayName: string;
  roles: string[];
}

export interface CreateRoleInput {
  code: string;
  name: string;
  description: string;
  permissions: string[];
}

export interface UpdateRoleInput {
  name: string;
  description: string;
  permissions: string[];
}

export type MenuUnit =
  'SPA' | 'RESTAURANT' | 'LOUNGE' | 'HOUSEKEEPING' | 'BEAUTY_AND_SALON' | 'CAFE';
export type RoomManagerUnit = 'SPA' | 'RESTAURANT' | 'LOUNGE' | 'HOUSEKEEPING';

export type MenuItemKind = 'PRODUCT' | 'SERVICE';

export interface LocalizedText {
  uz: string;
  ru: string;
  en: string;
}

export interface ManagedMenuItem {
  id: string;
  unit: MenuUnit;
  kind: MenuItemKind;
  name: string;
  localizedName: LocalizedText;
  description: string | null;
  localizedDescription: LocalizedText | null;
  price: number | null;
  currency: string | null;
  durationMinutes: number | null;
  imageMediaId: string | null;
  active: boolean;
  available: boolean;
  quantityAllowed: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface MenuListOptions {
  unit?: MenuUnit;
  includeInactive?: boolean;
  page?: number;
  pageSize?: number;
}

export type RequestStatus = 'NEW' | 'IN_PROCESS' | 'COMPLETED';

export interface StaffRequestItem {
  menuItemId: string;
  unit: MenuUnit;
  kind: MenuItemKind;
  name: string;
  localizedName: LocalizedText;
  quantity: number;
  note: string | null;
  unitPrice: number | null;
  currency: string | null;
}

export interface StaffRequest {
  id: string;
  clientRequestId: string;
  department: string;
  unit: MenuUnit;
  room: { id: string; number: string };
  items: StaffRequestItem[];
  guestNote: string | null;
  status: RequestStatus;
  requestedAt: string;
  confirmedAt: string | null;
  completedAt: string | null;
  statusHistory: Array<{
    id: string;
    fromStatus: RequestStatus | null;
    toStatus: RequestStatus;
    changedAt: string;
    changedBy: { id: string; displayName: string; role: string | null } | null;
  }>;
  createdAt: string;
  updatedAt: string;
}

export type RoomManagerRequest = Omit<StaffRequest, 'unit'> & { unit: RoomManagerUnit };

export interface DepartmentRequestListOptions {
  status?: RequestStatus;
  room?: string;
  dateFrom?: string;
  dateTo?: string;
  unit?: MenuUnit;
  page?: number;
  pageSize?: number;
}

export interface RoomManagerRequestListOptions {
  status?: RequestStatus;
  room?: string;
  dateFrom?: string;
  dateTo?: string;
  unit?: RoomManagerUnit;
  page?: number;
  pageSize?: number;
}

export type ReceptionistRoomStatus = 'VACANT' | 'OCCUPIED';
export type GuestAssignmentStatus = 'ACTIVE' | 'CHECKED_OUT';

export interface GuestAssignment {
  id: string;
  room: { id: string; number: string };
  guestName: string;
  stayDays: number;
  status: GuestAssignmentStatus;
  assignedAt: string;
  updatedAt: string;
  checkedOutAt: string | null;
  assignedBy: { id: string; displayName: string; role: string | null };
}

export interface ReceptionistRoom {
  room: { id: string; number: string };
  roomStatus: ReceptionistRoomStatus;
  activeAssignment: GuestAssignment | null;
}

export interface ReceptionistRoomListOptions {
  status?: ReceptionistRoomStatus;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface CreateMenuItemInput {
  unit: MenuUnit;
  kind: MenuItemKind;
  localizedName: LocalizedText;
  localizedDescription?: LocalizedText | null;
  price?: number | null;
  currency?: string | null;
  durationMinutes?: number | null;
  imageMediaId?: string | null;
  available?: boolean;
  quantityAllowed?: boolean;
  sortOrder?: number;
}

export interface UpdateMenuItemInput {
  localizedName?: LocalizedText;
  localizedDescription?: LocalizedText | null;
  price?: number | null;
  currency?: string | null;
  durationMinutes?: number | null;
  imageMediaId?: string | null;
  available?: boolean;
  quantityAllowed?: boolean;
  sortOrder?: number;
}

export class StaffApiError extends Error {
  public constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'StaffApiError';
  }
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init?.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...init?.headers,
    },
  });
  const rawBody = await response.text();
  let body: unknown = undefined;

  if (rawBody.length > 0) {
    try {
      body = JSON.parse(rawBody) as unknown;
    } catch {
      body = undefined;
    }
  }

  if (!response.ok) {
    const bodyRecord = isRecord(body) ? body : {};
    const message = typeof bodyRecord.message === 'string' ? bodyRecord.message : 'Request failed.';
    const code = typeof bodyRecord.code === 'string' ? bodyRecord.code : 'API_ERROR';
    throw new StaffApiError(message, response.status, code);
  }

  return body as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function withQuery(path: string, options: MenuListOptions): string {
  const query = new URLSearchParams();
  if (options.unit !== undefined) query.set('unit', options.unit);
  if (options.includeInactive !== undefined) {
    query.set('includeInactive', String(options.includeInactive));
  }
  if (options.page !== undefined) query.set('page', String(options.page));
  if (options.pageSize !== undefined) query.set('pageSize', String(options.pageSize));
  const encodedQuery = query.toString();
  return encodedQuery.length === 0 ? path : `${path}?${encodedQuery}`;
}

function withRequestQuery(
  path: string,
  options: DepartmentRequestListOptions | RoomManagerRequestListOptions,
): string {
  const query = new URLSearchParams();
  if (options.status !== undefined) query.set('status', options.status);
  if (options.room !== undefined && options.room.length > 0) query.set('room', options.room);
  if (options.dateFrom !== undefined) query.set('dateFrom', options.dateFrom);
  if (options.dateTo !== undefined) query.set('dateTo', options.dateTo);
  if (options.unit !== undefined) query.set('unit', options.unit);
  if (options.page !== undefined) query.set('page', String(options.page));
  if (options.pageSize !== undefined) query.set('pageSize', String(options.pageSize));
  const encodedQuery = query.toString();
  return encodedQuery.length === 0 ? path : `${path}?${encodedQuery}`;
}

function withReceptionistRoomQuery(path: string, options: ReceptionistRoomListOptions): string {
  const query = new URLSearchParams();
  if (options.status !== undefined) query.set('status', options.status);
  if (options.search !== undefined && options.search.length > 0) {
    query.set('search', options.search);
  }
  if (options.page !== undefined) query.set('page', String(options.page));
  if (options.pageSize !== undefined) query.set('pageSize', String(options.pageSize));
  const encodedQuery = query.toString();
  return encodedQuery.length === 0 ? path : `${path}?${encodedQuery}`;
}

export const managementApi = {
  listUsers: () => request<{ items: ManagedUser[] }>('/management/users'),
  createUser: (input: CreateUserInput) =>
    request<ManagedUser>('/management/users', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  updateUser: (id: string, input: UpdateUserInput) =>
    request<ManagedUser>(`/management/users/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  deactivateUser: (id: string) =>
    request<ManagedUser>(`/management/users/${encodeURIComponent(id)}/deactivate`, {
      method: 'POST',
    }),
  reactivateUser: (id: string) =>
    request<ManagedUser>(`/management/users/${encodeURIComponent(id)}/reactivate`, {
      method: 'POST',
    }),
  resetPassword: (id: string, password: string) =>
    request<ManagedUser>(`/management/users/${encodeURIComponent(id)}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),
  listRoles: () => request<{ items: ManagedRole[] }>('/management/roles'),
  createRole: (input: CreateRoleInput) =>
    request<ManagedRole>('/management/roles', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  updateRole: (id: string, input: UpdateRoleInput) =>
    request<ManagedRole>(`/management/roles/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  deleteRole: (id: string) =>
    request<ManagedRole>(`/management/roles/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
  listMenuItems: (options: MenuListOptions = {}) =>
    request<{ items: ManagedMenuItem[]; page: number; pageSize: number; total: number }>(
      withQuery('/management/menu-items', options),
    ),
  listDepartmentRequests: (options: DepartmentRequestListOptions = {}) =>
    request<{ items: StaffRequest[]; page: number; pageSize: number; total: number }>(
      withRequestQuery('/department/requests', options),
    ),
  listRoomManagerRequests: (options: RoomManagerRequestListOptions = {}) =>
    request<{
      items: RoomManagerRequest[];
      page: number;
      pageSize: number;
      total: number;
    }>(withRequestQuery('/room-manager/requests', options)),
  listReceptionistRooms: (options: ReceptionistRoomListOptions = {}) =>
    request<{ items: ReceptionistRoom[]; page: number; pageSize: number; total: number }>(
      withReceptionistRoomQuery('/receptionist/rooms', options),
    ),
  listAllReceptionistRooms: async (): Promise<ReceptionistRoom[]> => {
    const pageSize = 100;
    const firstPage = await managementApi.listReceptionistRooms({ page: 1, pageSize });
    const totalPages = Math.max(1, Math.ceil(firstPage.total / pageSize));
    if (totalPages === 1) return firstPage.items;

    const remainingPages = await Promise.all(
      Array.from({ length: totalPages - 1 }, (_, index) =>
        managementApi.listReceptionistRooms({ page: index + 2, pageSize }),
      ),
    );
    return [firstPage, ...remainingPages].flatMap((page) => page.items);
  },
  getReceptionistRoom: (id: string) =>
    request<ReceptionistRoom>(`/receptionist/rooms/${encodeURIComponent(id)}`),
  assignGuestToRoom: (roomId: string, guestName: string, stayDays: number) =>
    request<GuestAssignment>(`/receptionist/rooms/${encodeURIComponent(roomId)}/guest-assignment`, {
      method: 'POST',
      body: JSON.stringify({ guestName, stayDays }),
    }),
  updateGuestAssignment: (assignmentId: string, guestName: string, stayDays?: number) =>
    request<GuestAssignment>(
      `/receptionist/guest-assignments/${encodeURIComponent(assignmentId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ guestName, ...(stayDays === undefined ? {} : { stayDays }) }),
      },
    ),
  checkoutGuestAssignment: (assignmentId: string) =>
    request<GuestAssignment>(
      `/receptionist/guest-assignments/${encodeURIComponent(assignmentId)}/checkout`,
      {
        method: 'POST',
      },
    ),
  getDepartmentRequest: (id: string) =>
    request<StaffRequest>(`/department/requests/${encodeURIComponent(id)}`),
  getRoomManagerRequest: (id: string) =>
    request<RoomManagerRequest>(`/room-manager/requests/${encodeURIComponent(id)}`),
  confirmDepartmentRequest: (id: string) =>
    request<StaffRequest>(`/department/requests/${encodeURIComponent(id)}/confirm`, {
      method: 'POST',
    }),
  completeDepartmentRequest: (id: string) =>
    request<StaffRequest>(`/department/requests/${encodeURIComponent(id)}/done`, {
      method: 'POST',
    }),
  createMenuItem: (input: CreateMenuItemInput) =>
    request<ManagedMenuItem>('/management/menu-items', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  updateMenuItem: (id: string, input: UpdateMenuItemInput) =>
    request<ManagedMenuItem>(`/management/menu-items/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  activateMenuItem: (id: string) =>
    request<ManagedMenuItem>(`/management/menu-items/${encodeURIComponent(id)}/activate`, {
      method: 'POST',
    }),
  deactivateMenuItem: (id: string) =>
    request<ManagedMenuItem>(`/management/menu-items/${encodeURIComponent(id)}/deactivate`, {
      method: 'POST',
    }),
};
