import type { LocalizedText } from '@room-service/translations';

export type UnitCode =
  'SPA' | 'RESTAURANT' | 'LOUNGE' | 'HOUSEKEEPING' | 'BEAUTY_AND_SALON' | 'CAFE';
export type DepartmentCode =
  'SPA' | 'FOOD_AND_BEVERAGES' | 'HOUSEKEEPING' | 'BEAUTY_AND_SALON' | 'CAFE';
export type MenuItemKind = 'PRODUCT' | 'SERVICE';
export type RequestStatus = 'NEW' | 'IN_PROCESS' | 'COMPLETED';

export interface GuestMenuItem {
  id: string;
  unit: UnitCode;
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

export interface GuestDepartmentUnit {
  code: UnitCode;
  department: DepartmentCode;
  name: string;
  roomManagerMonitoring: boolean;
  enabled: boolean;
  disabledReason: 'MENU_NOT_CONFIGURED' | null;
}

export interface GuestDepartment {
  code: DepartmentCode;
  name: string;
  units: GuestDepartmentUnit[];
}

export interface GuestContext {
  room: { id: string; number: string };
  roomStatus: 'OCCUPIED';
  welcome: {
    message: string;
    guestName: string;
    personalized: true;
  };
  availableUnits: UnitCode[];
}

export interface GuestRequestItem {
  menuItemId: string;
  unit: UnitCode;
  kind: MenuItemKind;
  name: string;
  localizedName: LocalizedText;
  quantity: number;
  note: string | null;
  unitPrice: number | null;
  currency: string | null;
}

export interface GuestRequest {
  id: string;
  clientRequestId: string;
  department: DepartmentCode;
  unit: UnitCode;
  items: GuestRequestItem[];
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
    changedBy: {
      id: string;
      displayName: string;
      role: string | null;
    } | null;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface GuestApiErrorDetail {
  field: string;
  message: string;
}

export class GuestApiError extends Error {
  public constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly details: readonly GuestApiErrorDetail[] = [],
  ) {
    super(message);
    this.name = 'GuestApiError';
  }
}

export interface GuestApiClientOptions {
  baseUrl?: string;
  getGuestAccessToken?: () => string | undefined;
  getDeviceCredential?: () => string | undefined;
  fetcher?: typeof fetch;
}

export interface CreateGuestRequestInput {
  clientRequestId: string;
  items: Array<{
    menuItemId: string;
    quantity: number;
    note?: string | null;
  }>;
  guestNote?: string | null;
}

export interface GuestApiClient {
  getContext(): Promise<GuestContext>;
  listDepartments(): Promise<{ items: GuestDepartment[] }>;
  listMenus(options: {
    unit: UnitCode;
    page?: number;
    pageSize?: number;
  }): Promise<{ items: GuestMenuItem[]; page: number; pageSize: number; total: number }>;
  getMenuItem(menuItemId: string): Promise<GuestMenuItem>;
  listRequests(options?: {
    page?: number;
    pageSize?: number;
    status?: RequestStatus;
  }): Promise<{ items: GuestRequest[]; page: number; pageSize: number; total: number }>;
  createRequest(input: CreateGuestRequestInput): Promise<GuestRequest>;
  getRequest(requestId: string): Promise<GuestRequest>;
}

export function createGuestApiClient(options: GuestApiClientOptions = {}): GuestApiClient {
  const baseUrl = (options.baseUrl ?? '/api/v1').replace(/\/$/, '');
  const fetcher = options.fetcher ?? fetch;

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set('Accept', 'application/json');
    if (init.body !== undefined) headers.set('Content-Type', 'application/json');

    const guestAccessToken = options.getGuestAccessToken?.();
    const deviceCredential = options.getDeviceCredential?.();
    if (guestAccessToken !== undefined && guestAccessToken.trim().length > 0) {
      headers.set('X-Guest-Access-Token', guestAccessToken);
    } else if (deviceCredential !== undefined && deviceCredential.trim().length > 0) {
      headers.set('X-Device-Credential', deviceCredential);
    }

    const response = await fetcher(`${baseUrl}${path}`, {
      ...init,
      credentials: 'omit',
      headers,
    });
    const rawBody = await response.text();
    let body: unknown;
    if (rawBody.length > 0) {
      try {
        body = JSON.parse(rawBody) as unknown;
      } catch {
        body = undefined;
      }
    }

    if (!response.ok) {
      const record = isRecord(body) ? body : {};
      const details = Array.isArray(record.details) ? record.details.filter(isErrorDetail) : [];
      throw new GuestApiError(
        typeof record.message === 'string' ? record.message : 'Guest request failed.',
        response.status,
        typeof record.code === 'string' ? record.code : 'API_ERROR',
        details,
      );
    }

    return body as T;
  }

  function withQuery(path: string, params: Record<string, string | number | undefined>): string {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) query.set(key, String(value));
    }
    const encoded = query.toString();
    return encoded.length === 0 ? path : `${path}?${encoded}`;
  }

  return {
    getContext: () => request<GuestContext>('/guest/context'),
    listDepartments: () => request<{ items: GuestDepartment[] }>('/guest/departments'),
    listMenus: (query) =>
      request<{ items: GuestMenuItem[]; page: number; pageSize: number; total: number }>(
        withQuery('/guest/menus', query),
      ),
    getMenuItem: (menuItemId) =>
      request<GuestMenuItem>(`/guest/menus/${encodeURIComponent(menuItemId)}`),
    listRequests: (query = {}) =>
      request<{ items: GuestRequest[]; page: number; pageSize: number; total: number }>(
        withQuery('/guest/requests', query),
      ),
    createRequest: (input) =>
      request<GuestRequest>('/guest/requests', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    getRequest: (requestId) =>
      request<GuestRequest>(`/guest/requests/${encodeURIComponent(requestId)}`),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isErrorDetail(value: unknown): value is GuestApiErrorDetail {
  return isRecord(value) && typeof value.field === 'string' && typeof value.message === 'string';
}
