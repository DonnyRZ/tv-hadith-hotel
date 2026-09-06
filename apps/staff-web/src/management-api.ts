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
  | 'SPA'
  | 'RESTAURANT'
  | 'LOUNGE'
  | 'HOUSEKEEPING'
  | 'BEAUTY_AND_SALON'
  | 'CAFE'
  | 'BUTIK_INDONESIA';
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

export type RequestStatus = 'NEW' | 'IN_PROCESS' | 'COMPLETED' | 'CANCELLED';

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
  variantId?: string | null;
  sku?: string | null;
  variantOptions?: Array<{
    code: string;
    label: LocalizedText;
    value: LocalizedText;
  }> | null;
}

export interface StaffRequest {
  id: string;
  clientRequestId: string;
  department: string;
  unit: MenuUnit;
  room: { id: string; number: string };
  guestName: string | null;
  items: StaffRequestItem[];
  guestNote: string | null;
  status: RequestStatus;
  requestedAt: string;
  confirmedAt: string | null;
  completedAt: string | null;
  reservationExpiresAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  cancellationSource: 'STAFF' | 'AUTO_EXPIRY' | null;
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
  folioSummary: ReceptionistFolioSummary;
}

export interface ReceptionistFolioAmount {
  currency: string;
  amount: number;
}

export interface ReceptionistFolioStatusCounts {
  NEW: number;
  IN_PROCESS: number;
  COMPLETED: number;
  CANCELLED: number;
}

export interface ReceptionistFolioSummary {
  orderCount: number;
  openOrderCount: number;
  statusCounts: ReceptionistFolioStatusCounts;
  itemCount: number;
  totalsByCurrency: ReceptionistFolioAmount[];
  unpricedItemCount: number;
  isTotalComplete: boolean;
  lastOrderAt: string | null;
}

export interface ReceptionistFolioItem extends StaffRequestItem {
  lineTotal: number | null;
}

export interface ReceptionistFolioOrder {
  id: string;
  guestAssignmentId: string | null;
  guestName: string | null;
  department: string;
  unit: MenuUnit;
  room: { id: string; number: string };
  items: ReceptionistFolioItem[];
  guestNote: string | null;
  status: RequestStatus;
  requestedAt: string;
  confirmedAt: string | null;
  completedAt: string | null;
  reservationExpiresAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  cancellationSource: 'STAFF' | 'AUTO_EXPIRY' | null;
  statusHistory: StaffRequest['statusHistory'];
  createdAt: string;
  updatedAt: string;
}

export interface ReceptionistFolioResponse {
  room: { id: string; number: string };
  assignment: GuestAssignment | null;
  orders: ReceptionistFolioOrder[];
  summary: ReceptionistFolioSummary;
  page: number;
  pageSize: number;
  total: number;
  lastUpdated: string;
}

export interface ReceptionistFolioHistoryItem {
  assignment: GuestAssignment;
  summary: ReceptionistFolioSummary;
}

export interface ReceptionistFolioHistoryResponse {
  room: { id: string; number: string };
  items: ReceptionistFolioHistoryItem[];
  page: number;
  pageSize: number;
  total: number;
  lastUpdated: string;
}

export interface ReceptionistFolioListOptions {
  page?: number;
  pageSize?: number;
}

export interface ReceptionistRoomListOptions {
  status?: ReceptionistRoomStatus;
  search?: string;
  page?: number;
  pageSize?: number;
}

export type TvProvisioningStatus = 'PENDING' | 'PAIRED' | 'CLAIMED' | 'REVOKED';

export interface ManagedTvDevice {
  id: string;
  deviceCode: string;
  status: TvProvisioningStatus;
  room: { id: string; number: string } | null;
  pairingExpiresAt: string;
  deviceModel: string;
  appVersion: string;
  androidApiLevel: number;
  createdAt: string;
  pairedAt: string | null;
  claimedAt: string | null;
  revokedAt: string | null;
}

export interface GuestQrRoomStatus {
  room: { id: string; number: string };
  active: boolean;
  issuedAt: string | null;
  revokedAt: string | null;
}

export interface IssuedGuestQr {
  room: { id: string; number: string };
  qrUrl: string;
  issuedAt: string;
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

export interface BoutiqueVariantOption {
  code: string;
  label: LocalizedText;
  value: LocalizedText;
}

export interface BoutiqueCategory {
  id: string;
  localizedName: LocalizedText;
  localizedDescription: LocalizedText | null;
  imageMediaId: string | null;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface BoutiqueVariant {
  id: string;
  menuItemId: string;
  sku: string;
  options: BoutiqueVariantOption[];
  price: number;
  currency: string;
  active: boolean;
  stockOnHand: number;
  reservedQuantity: number;
  availableQuantity: number;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface BoutiqueProduct {
  item: ManagedMenuItem;
  categoryId: string;
  category: BoutiqueCategory;
  variants: BoutiqueVariant[];
}

export interface LocalizedBoutiqueInput {
  uz: string;
  ru: string;
  en: string;
}

export interface CreateBoutiqueCategoryInput {
  localizedName: LocalizedBoutiqueInput;
  localizedDescription?: LocalizedBoutiqueInput | null;
  imageMediaId?: string | null;
  sortOrder?: number;
}

export interface UpdateBoutiqueCategoryInput {
  localizedName?: LocalizedBoutiqueInput;
  localizedDescription?: LocalizedBoutiqueInput | null;
  imageMediaId?: string | null;
  sortOrder?: number;
}

export interface CreateBoutiqueVariantInput {
  sku: string;
  options: BoutiqueVariantOption[];
  price: number;
  currency: string;
  stockOnHand: number;
  sortOrder?: number;
}

export interface CreateBoutiqueProductInput {
  localizedName: LocalizedBoutiqueInput;
  localizedDescription?: LocalizedBoutiqueInput | null;
  categoryId: string;
  imageMediaId?: string | null;
  available?: boolean;
  sortOrder?: number;
  variants: CreateBoutiqueVariantInput[];
}

export interface UpdateBoutiqueProductInput {
  localizedName?: LocalizedBoutiqueInput;
  localizedDescription?: LocalizedBoutiqueInput | null;
  categoryId?: string;
  imageMediaId?: string | null;
  available?: boolean;
  sortOrder?: number;
}

export interface UpdateBoutiqueVariantInput {
  sku?: string;
  options?: BoutiqueVariantOption[];
  price?: number;
  currency?: string;
  sortOrder?: number;
}

export interface MediaUploadResponse {
  id: string;
  objectKey: string;
  contentType: string;
  fileName: string;
  byteSize: number;
  createdAt: string;
  url: string;
}

export interface StaffApiHealth {
  status: 'ok';
  service: 'room-service-api';
  environment: string;
  releaseId: string;
  dependencies: {
    database: 'ok' | 'memory' | 'unavailable';
    mediaStorage: 'ok' | 'unavailable';
    redis: 'ok' | 'memory' | 'disabled' | 'unavailable';
    realtime: 'ok' | 'memory' | 'disabled' | 'unavailable';
  };
}

interface StaffApiErrorOptions {
  requestId?: string | null;
  environment?: string | null;
  releaseId?: string | null;
  endpoint?: string;
}

export class StaffApiError extends Error {
  public constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    options: StaffApiErrorOptions = {},
  ) {
    super(message);
    this.name = 'StaffApiError';
    this.requestId = options.requestId ?? null;
    this.environment = options.environment ?? null;
    this.releaseId = options.releaseId ?? null;
    this.endpoint = options.endpoint ?? 'unknown';
  }

  public readonly requestId: string | null;
  public readonly environment: string | null;
  public readonly releaseId: string | null;
  public readonly endpoint: string;
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '/api/v1').replace(/\/+$/u, '');

function apiEndpoint(path: string): string {
  return `${API_BASE_URL}${path}`;
}

function stringFrom(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function fallbackErrorCode(status: number): string {
  switch (status) {
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'RESOURCE_NOT_FOUND';
    case 405:
      return 'STAFF_API_PROXY_MISSING';
    case 502:
      return 'API_PROXY_UNAVAILABLE';
    default:
      return 'API_ERROR';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const isFormData = typeof FormData !== 'undefined' && init?.body instanceof FormData;
  let response: Response;
  try {
    response = await fetch(apiEndpoint(path), {
      ...init,
      credentials: 'include',
      headers: {
        ...(init?.body === undefined || isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...init?.headers,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    throw new StaffApiError('The Staff Web could not reach the API.', 0, 'STAFF_API_UNREACHABLE', {
      endpoint: path,
    });
  }
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
    const message =
      typeof bodyRecord.message === 'string'
        ? bodyRecord.message
        : Array.isArray(bodyRecord.message)
          ? bodyRecord.message.filter((item): item is string => typeof item === 'string').join('; ')
          : 'Request failed.';
    const code = stringFrom(bodyRecord.code) ?? fallbackErrorCode(response.status);
    throw new StaffApiError(message, response.status, code, {
      requestId: response.headers.get('X-Request-Id') ?? stringFrom(bodyRecord.requestId),
      environment: stringFrom(bodyRecord.environment),
      releaseId: stringFrom(bodyRecord.releaseId),
      endpoint: path,
    });
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

function withFolioQuery(path: string, options: ReceptionistFolioListOptions): string {
  const query = new URLSearchParams();
  if (options.page !== undefined) query.set('page', String(options.page));
  if (options.pageSize !== undefined) query.set('pageSize', String(options.pageSize));
  const encodedQuery = query.toString();
  return encodedQuery.length === 0 ? path : `${path}?${encodedQuery}`;
}

function withTvDeviceQuery(
  path: string,
  options: { roomId?: string; status?: TvProvisioningStatus; page?: number; pageSize?: number },
): string {
  const query = new URLSearchParams();
  if (options.roomId !== undefined) query.set('roomId', options.roomId);
  if (options.status !== undefined) query.set('status', options.status);
  if (options.page !== undefined) query.set('page', String(options.page));
  if (options.pageSize !== undefined) query.set('pageSize', String(options.pageSize));
  const encodedQuery = query.toString();
  return encodedQuery.length === 0 ? path : `${path}?${encodedQuery}`;
}

export const managementApi = {
  getApiHealth: async (): Promise<StaffApiHealth> => {
    const health = await request<unknown>('/health');
    if (
      !isRecord(health) ||
      health.status !== 'ok' ||
      health.service !== 'room-service-api' ||
      typeof health.environment !== 'string' ||
      typeof health.releaseId !== 'string' ||
      !isRecord(health.dependencies)
    ) {
      throw new StaffApiError(
        'The Staff Web did not receive a valid API health response.',
        200,
        'STAFF_API_PROXY_MISSING',
        { endpoint: '/health' },
      );
    }

    return health as unknown as StaffApiHealth;
  },
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
  listDepartmentRequests: (options: DepartmentRequestListOptions = {}, signal?: AbortSignal) =>
    request<{ items: StaffRequest[]; page: number; pageSize: number; total: number }>(
      withRequestQuery('/department/requests', options),
      signal === undefined ? undefined : { signal },
    ),
  listRoomManagerRequests: (options: RoomManagerRequestListOptions = {}, signal?: AbortSignal) =>
    request<{
      items: RoomManagerRequest[];
      page: number;
      pageSize: number;
      total: number;
    }>(
      withRequestQuery('/room-manager/requests', options),
      signal === undefined ? undefined : { signal },
    ),
  listReceptionistRooms: (options: ReceptionistRoomListOptions = {}, signal?: AbortSignal) =>
    request<{ items: ReceptionistRoom[]; page: number; pageSize: number; total: number }>(
      withReceptionistRoomQuery('/receptionist/rooms', options),
      signal === undefined ? undefined : { signal },
    ),
  listAllReceptionistRooms: async (signal?: AbortSignal): Promise<ReceptionistRoom[]> => {
    const pageSize = 100;
    const firstPage = await managementApi.listReceptionistRooms({ page: 1, pageSize }, signal);
    const totalPages = Math.max(1, Math.ceil(firstPage.total / pageSize));
    if (totalPages === 1) return firstPage.items;

    const remainingPages = await Promise.all(
      Array.from({ length: totalPages - 1 }, (_, index) =>
        managementApi.listReceptionistRooms({ page: index + 2, pageSize }, signal),
      ),
    );
    return [firstPage, ...remainingPages].flatMap((page) => page.items);
  },
  getReceptionistRoom: (id: string) =>
    request<ReceptionistRoom>(`/receptionist/rooms/${encodeURIComponent(id)}`),
  getReceptionistActiveFolio: (
    roomId: string,
    options: ReceptionistFolioListOptions = {},
    signal?: AbortSignal,
  ) =>
    request<ReceptionistFolioResponse>(
      withFolioQuery(`/receptionist/rooms/${encodeURIComponent(roomId)}/folio`, options),
      signal === undefined ? undefined : { signal },
    ),
  listReceptionistFolioHistory: (
    roomId: string,
    options: ReceptionistFolioListOptions = {},
    signal?: AbortSignal,
  ) =>
    request<ReceptionistFolioHistoryResponse>(
      withFolioQuery(`/receptionist/rooms/${encodeURIComponent(roomId)}/folio/history`, options),
      signal === undefined ? undefined : { signal },
    ),
  getReceptionistFolioHistoryDetail: (
    roomId: string,
    assignmentId: string,
    options: ReceptionistFolioListOptions = {},
    signal?: AbortSignal,
  ) =>
    request<ReceptionistFolioResponse>(
      withFolioQuery(
        `/receptionist/rooms/${encodeURIComponent(roomId)}/folio/history/${encodeURIComponent(assignmentId)}`,
        options,
      ),
      signal === undefined ? undefined : { signal },
    ),
  listTvDevices: (
    options: {
      roomId?: string;
      status?: TvProvisioningStatus;
      page?: number;
      pageSize?: number;
    } = {},
  ) =>
    request<{ items: ManagedTvDevice[]; page: number; pageSize: number; total: number }>(
      withTvDeviceQuery('/receptionist/tv-devices', options),
    ),
  pairTvDevice: (pairingCode: string, roomId: string, roomNumber: string) =>
    request<{ device: ManagedTvDevice; pairedAt: string }>('/receptionist/tv-devices/pair', {
      method: 'POST',
      body: JSON.stringify({ pairingCode, roomId, roomNumber }),
    }),
  resetTvDevice: (deviceId: string) =>
    request<{ deviceId: string; status: 'PENDING'; pairingExpiresAt: string }>(
      `/receptionist/tv-devices/${encodeURIComponent(deviceId)}/reset`,
      { method: 'POST' },
    ),
  revokeTvDevice: (deviceId: string) =>
    request<{ deviceId: string; status: 'REVOKED'; revokedAt: string }>(
      `/receptionist/tv-devices/${encodeURIComponent(deviceId)}/revoke`,
      { method: 'POST' },
    ),
  getGuestQrStatus: (roomId: string) =>
    request<GuestQrRoomStatus>(
      `/receptionist/rooms/${encodeURIComponent(roomId)}/guest-access-token`,
    ),
  issueGuestQr: (roomId: string) =>
    request<IssuedGuestQr>(`/receptionist/rooms/${encodeURIComponent(roomId)}/guest-access-token`, {
      method: 'POST',
    }),
  revokeGuestQr: (roomId: string) =>
    request<{ room: { id: string; number: string }; revoked: boolean; revokedAt: string | null }>(
      `/receptionist/rooms/${encodeURIComponent(roomId)}/guest-access-token/revoke`,
      { method: 'POST' },
    ),
  issueGuestQrBatch: (roomIds: string[]) =>
    request<{ items: IssuedGuestQr[] }>('/receptionist/guest-access-tokens/batch', {
      method: 'POST',
      body: JSON.stringify({ roomIds }),
    }),
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
  cancelDepartmentRequest: (id: string, reason?: string) =>
    request<StaffRequest>(`/department/requests/${encodeURIComponent(id)}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
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
  listBoutiqueCategories: (signal?: AbortSignal) =>
    request<{ items: BoutiqueCategory[] }>(
      '/management/boutique/categories',
      signal === undefined ? undefined : { signal },
    ),
  createBoutiqueCategory: (input: CreateBoutiqueCategoryInput) =>
    request<BoutiqueCategory>('/management/boutique/categories', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  updateBoutiqueCategory: (id: string, input: UpdateBoutiqueCategoryInput) =>
    request<BoutiqueCategory>(`/management/boutique/categories/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  activateBoutiqueCategory: (id: string) =>
    request<BoutiqueCategory>(
      `/management/boutique/categories/${encodeURIComponent(id)}/activate`,
      {
        method: 'POST',
      },
    ),
  deactivateBoutiqueCategory: (id: string) =>
    request<BoutiqueCategory>(
      `/management/boutique/categories/${encodeURIComponent(id)}/deactivate`,
      {
        method: 'POST',
      },
    ),
  listBoutiqueProducts: (
    options: {
      includeInactive?: boolean;
      categoryId?: string;
      page?: number;
      pageSize?: number;
    } = {},
    signal?: AbortSignal,
  ) => {
    const query = new URLSearchParams();
    if (options.includeInactive !== undefined)
      query.set('includeInactive', String(options.includeInactive));
    if (options.categoryId !== undefined) query.set('categoryId', options.categoryId);
    if (options.page !== undefined) query.set('page', String(options.page));
    if (options.pageSize !== undefined) query.set('pageSize', String(options.pageSize));
    const suffix = query.toString();
    return request<{ items: BoutiqueProduct[]; page: number; pageSize: number; total: number }>(
      `/management/boutique/products${suffix.length === 0 ? '' : `?${suffix}`}`,
      signal === undefined ? undefined : { signal },
    );
  },
  createBoutiqueProduct: (input: CreateBoutiqueProductInput) =>
    request<BoutiqueProduct>('/management/boutique/products', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  updateBoutiqueProduct: (id: string, input: UpdateBoutiqueProductInput) =>
    request<BoutiqueProduct>(`/management/boutique/products/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  activateBoutiqueProduct: (id: string) =>
    request<BoutiqueProduct>(`/management/boutique/products/${encodeURIComponent(id)}/activate`, {
      method: 'POST',
    }),
  deactivateBoutiqueProduct: (id: string) =>
    request<BoutiqueProduct>(`/management/boutique/products/${encodeURIComponent(id)}/deactivate`, {
      method: 'POST',
    }),
  createBoutiqueVariant: (productId: string, input: CreateBoutiqueVariantInput) =>
    request<BoutiqueVariant>(
      `/management/boutique/products/${encodeURIComponent(productId)}/variants`,
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
    ),
  updateBoutiqueVariant: (id: string, input: UpdateBoutiqueVariantInput) =>
    request<BoutiqueVariant>(`/management/boutique/variants/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  activateBoutiqueVariant: (id: string) =>
    request<BoutiqueVariant>(`/management/boutique/variants/${encodeURIComponent(id)}/activate`, {
      method: 'POST',
    }),
  deactivateBoutiqueVariant: (id: string) =>
    request<BoutiqueVariant>(`/management/boutique/variants/${encodeURIComponent(id)}/deactivate`, {
      method: 'POST',
    }),
  adjustBoutiqueStock: (id: string, delta: number, reason: string) =>
    request<BoutiqueVariant>(
      `/management/boutique/variants/${encodeURIComponent(id)}/stock-adjustments`,
      {
        method: 'POST',
        body: JSON.stringify({ delta, reason }),
      },
    ),
  uploadBoutiqueMedia: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return request<MediaUploadResponse>('/media/upload', { method: 'POST', body: form });
  },
};
