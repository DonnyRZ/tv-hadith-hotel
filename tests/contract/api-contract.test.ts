import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

interface Operation {
  security?: readonly Record<string, readonly string[]>[];
  responses: Record<string, unknown>;
  requestBody?: {
    content?: {
      'application/json'?: {
        schema?: { $ref?: string };
      };
    };
  };
  description?: string;
}

interface PathItem {
  get?: Operation;
  post?: Operation;
  patch?: Operation;
  delete?: Operation;
}

interface ContractDocument {
  paths: Record<string, PathItem>;
  components: {
    securitySchemes: Record<string, { type: string; in: string; name: string }>;
    schemas: Record<
      string,
      {
        required?: readonly string[];
        enum?: readonly string[];
        properties?: Record<string, unknown>;
        allOf?: readonly {
          required?: readonly string[];
        }[];
      }
    >;
  };
}

const contract = parse(
  readFileSync(resolve(process.cwd(), 'packages/contracts/openapi.yaml'), 'utf8'),
) as ContractDocument;

function schema(name: string): NonNullable<ContractDocument['components']['schemas'][string]> {
  const selectedSchema = contract.components.schemas[name];
  expect(selectedSchema, `Missing schema ${name}`).toBeDefined();
  return selectedSchema as NonNullable<ContractDocument['components']['schemas'][string]>;
}

function operation(path: string, method: keyof PathItem): Operation {
  const pathItem = contract.paths[path];
  expect(pathItem, `Missing path ${path}`).toBeDefined();
  const selectedOperation = pathItem?.[method];
  expect(selectedOperation, `Missing operation ${method.toUpperCase()} ${path}`).toBeDefined();
  return selectedOperation as Operation;
}

function hasStaffSessionSecurity(selectedOperation: Operation): boolean {
  return (
    selectedOperation.security?.some(
      (securityRequirement) => 'StaffSession' in securityRequirement,
    ) ?? false
  );
}

describe('REST API contract scenarios', () => {
  it('defines the staff session lifecycle and session cookie contract', () => {
    const login = operation('/auth/staff/login', 'post');
    const logout = operation('/auth/staff/logout', 'post');
    const me = operation('/auth/me', 'get');

    expect(login.security).toEqual([]);
    expect(login.responses).toHaveProperty('200');
    expect(login.responses).toHaveProperty('401');
    expect(logout.responses).toHaveProperty('204');
    expect(me.responses).toHaveProperty('200');
    expect(hasStaffSessionSecurity(logout)).toBe(true);
    expect(hasStaffSessionSecurity(me)).toBe(true);
    expect(contract.components.securitySchemes.StaffSession).toMatchObject({
      type: 'apiKey',
      in: 'cookie',
      name: 'room_service_session',
    });
  });

  it('requires email and password with bounded login input', () => {
    const schemaRef = operation('/auth/staff/login', 'post').requestBody?.content?.[
      'application/json'
    ]?.schema?.$ref;
    expect(schemaRef).toBe('#/components/schemas/StaffLoginRequest');

    expect(schema('StaffLoginRequest').required).toEqual(['email', 'password']);
    expect(schema('StaffLoginRequest').properties?.email).toMatchObject({
      format: 'email',
    });
  });

  it('models every role from the approved scope, including Receptionist', () => {
    expect(schema('RoleCode').enum).toEqual([
      'SUPERADMIN',
      'ROOM_MANAGER',
      'RECEPTIONIST',
      'SPA',
      'RESTAURANT',
      'LOUNGE',
      'HOUSEKEEPING',
      'BEAUTY_AND_SALON',
      'CAFE',
    ]);
    expect(schema('StaffUser').required).toEqual(['id', 'displayName', 'roles', 'permissions']);
  });

  it('requires staff authentication and forbidden responses on staff surfaces', () => {
    const staffPrefixes = ['/department/', '/room-manager/', '/receptionist/', '/management/'];
    const staffOperations = Object.entries(contract.paths).flatMap(([path, pathItem]) =>
      staffPrefixes.some((prefix) => path.startsWith(prefix))
        ? (['get', 'post', 'patch', 'delete'] as const)
            .map((method) => ({ path, method, selectedOperation: pathItem[method] }))
            .filter(
              (
                entry,
              ): entry is {
                path: string;
                method: 'get' | 'post' | 'patch' | 'delete';
                selectedOperation: Operation;
              } => entry.selectedOperation !== undefined,
            )
        : [],
    );

    expect(staffOperations.length).toBeGreaterThan(0);
    for (const staffOperation of staffOperations) {
      expect(
        hasStaffSessionSecurity(staffOperation.selectedOperation),
        `${staffOperation.method.toUpperCase()} ${staffOperation.path} must require StaffSession`,
      ).toBe(true);
      expect(staffOperation.selectedOperation.responses).toHaveProperty('401');
      expect(staffOperation.selectedOperation.responses).toHaveProperty('403');
    }
  });

  it('keeps Room Manager read-only and limits it to monitored units', () => {
    const list = operation('/room-manager/requests', 'get');
    const detail = operation('/room-manager/requests/{requestId}', 'get');

    expect(list.description).toContain('SPA, Restaurant, Lounge, and');
    expect(list.description).toContain('Beauty & Salon and Cafe are intentionally excluded');
    expect(detail.description).toContain('read-only');
    expect(contract.paths['/room-manager/requests']?.post).toBeUndefined();
  });

  it('keeps Receptionist capabilities separate from operational request actions', () => {
    const rooms = operation('/receptionist/rooms', 'get');
    const roomDetail = operation('/receptionist/rooms/{roomId}', 'get');
    const assignment = operation('/receptionist/rooms/{roomId}/guest-assignment', 'post');
    const update = operation('/receptionist/guest-assignments/{assignmentId}', 'patch');
    const checkout = operation('/receptionist/guest-assignments/{assignmentId}/checkout', 'post');

    for (const selectedOperation of [rooms, roomDetail, assignment, update, checkout]) {
      expect(hasStaffSessionSecurity(selectedOperation)).toBe(true);
      expect(selectedOperation.responses).toHaveProperty('401');
      expect(selectedOperation.responses).toHaveProperty('403');
    }
    expect(assignment.responses).toHaveProperty('201');
    expect(update.responses).toHaveProperty('200');
    expect(checkout.responses).toHaveProperty('200');
    expect(schema('AssignGuestRequest').required).toEqual(['guestName', 'stayDays']);
    expect(schema('AssignGuestRequest').properties?.stayDays).toMatchObject({
      type: 'integer',
      minimum: 1,
      maximum: 365,
    });
    expect(schema('UpdateGuestAssignmentRequest').required).toEqual(['guestName']);
    expect(schema('UpdateGuestAssignmentRequest').properties?.stayDays).toMatchObject({
      type: 'integer',
      minimum: 1,
      maximum: 365,
    });
    expect(schema('GuestAssignment').required).toEqual([
      'id',
      'room',
      'guestName',
      'stayDays',
      'status',
      'assignedAt',
      'updatedAt',
      'assignedBy',
    ]);
    expect(contract.paths['/receptionist/rooms/{roomId}']?.post).toBeUndefined();
  });

  it('defines Superadmin-only staff user and role management boundaries', () => {
    const staffManagementOperations = [
      operation('/management/users', 'get'),
      operation('/management/users', 'post'),
      operation('/management/users/{userId}', 'patch'),
      operation('/management/users/{userId}/deactivate', 'post'),
      operation('/management/users/{userId}/reactivate', 'post'),
      operation('/management/users/{userId}/reset-password', 'post'),
      operation('/management/roles', 'get'),
      operation('/management/roles', 'post'),
      operation('/management/roles/{roleId}', 'patch'),
      operation('/management/roles/{roleId}', 'delete'),
    ];

    for (const selectedOperation of staffManagementOperations) {
      expect(hasStaffSessionSecurity(selectedOperation)).toBe(true);
      expect(selectedOperation.responses).toHaveProperty('401');
      expect(selectedOperation.responses).toHaveProperty('403');
    }

    expect(schema('StaffManagementUser').required).toEqual([
      'id',
      'email',
      'displayName',
      'roles',
      'active',
      'createdAt',
      'updatedAt',
    ]);
    expect(schema('CreateStaffUserRequest').required).toEqual([
      'email',
      'displayName',
      'roles',
      'password',
    ]);
    expect(schema('CreateStaffRoleRequest').required).toEqual([
      'code',
      'name',
      'description',
      'permissions',
    ]);
  });

  it('defines scoped menu CMS operations and ordered menu item fields', () => {
    const menuOperations = [
      operation('/management/menu-items', 'get'),
      operation('/management/menu-items', 'post'),
      operation('/management/menu-items/{menuItemId}', 'get'),
      operation('/management/menu-items/{menuItemId}', 'patch'),
      operation('/management/menu-items/{menuItemId}/activate', 'post'),
      operation('/management/menu-items/{menuItemId}/deactivate', 'post'),
    ];

    for (const selectedOperation of menuOperations) {
      expect(hasStaffSessionSecurity(selectedOperation)).toBe(true);
      expect(selectedOperation.responses).toHaveProperty('401');
      expect(selectedOperation.responses).toHaveProperty('403');
    }

    expect(schema('MenuItem').required).toContain('sortOrder');
    expect(schema('MenuItem').required).not.toContain('category');
    expect(schema('MenuItem').properties).not.toHaveProperty('category');
    expect(schema('CreateMenuItemRequest').required).toEqual(['unit', 'kind', 'localizedName']);
    expect(schema('CreateMenuItemRequest').properties?.localizedName).toMatchObject({
      $ref: '#/components/schemas/LocalizedText',
    });
    expect(schema('CreateMenuItemRequest').properties).not.toHaveProperty('categoryId');
    expect(schema('UpdateMenuItemRequest').properties).not.toHaveProperty('categoryId');
    expect(contract.paths['/management/menu-categories']).toBeUndefined();
    expect(contract.paths['/management/menu-categories/{categoryId}']).toBeUndefined();
    expect(schema('CreateMenuItemRequest').properties?.sortOrder).toMatchObject({
      type: 'integer',
      minimum: 0,
    });
    expect(schema('UpdateMenuItemRequest').properties?.sortOrder).toMatchObject({
      type: 'integer',
      minimum: 0,
    });
  });

  it('defines the TV provisioning flow and keeps TV start/claim unauthenticated', () => {
    const start = operation('/tv/provisioning/start', 'post');
    const claim = operation('/tv/provisioning/claim', 'post');
    const startSchemaRef = start.requestBody?.content?.['application/json']?.schema?.$ref;
    const claimSchemaRef = claim.requestBody?.content?.['application/json']?.schema?.$ref;

    expect(start.security).toEqual([]);
    expect(claim.security).toEqual([]);
    expect(start.responses).toHaveProperty('429');
    expect(claim.responses).toHaveProperty('409');
    expect(claim.responses).toHaveProperty('410');
    expect(startSchemaRef).toBe('#/components/schemas/StartTvProvisioningRequest');
    expect(claimSchemaRef).toBe('#/components/schemas/ClaimTvProvisioningRequest');
    expect(schema('StartTvProvisioningRequest').required).toEqual([
      'installationId',
      'appVersion',
      'deviceModel',
      'androidApiLevel',
    ]);
    expect(schema('ClaimTvProvisioningRequest').required).toEqual([
      'pairingCode',
      'installationId',
    ]);
    expect(schema('PairTvDeviceRequest').required).toEqual(['pairingCode', 'roomId', 'roomNumber']);
  });

  it('protects receptionist TV pairing and revocation with the pairing permission boundary', () => {
    const pair = operation('/receptionist/tv-devices/pair', 'post');
    const revoke = operation('/receptionist/tv-devices/{deviceId}/revoke', 'post');
    const reset = operation('/receptionist/tv-devices/{deviceId}/reset', 'post');

    for (const selectedOperation of [pair, revoke, reset]) {
      expect(hasStaffSessionSecurity(selectedOperation)).toBe(true);
      expect(selectedOperation.responses).toHaveProperty('401');
      expect(selectedOperation.responses).toHaveProperty('403');
    }
    expect(schema('StartTvProvisioningResponse').required).toEqual([
      'deviceId',
      'deviceCode',
      'pairingCode',
      'expiresAt',
    ]);
    expect(schema('PairTvDeviceRequest').properties?.pairingCode).toMatchObject({
      pattern: '^[0-9]{6}$',
    });
    expect(schema('ResetTvDeviceResponse').required).toEqual([
      'deviceId',
      'status',
      'pairingExpiresAt',
    ]);
  });

  it('keeps guest request identity room-bound and idempotent', () => {
    const createGuestRequest = operation('/guest/requests', 'post');
    const schemaRef = createGuestRequest.requestBody?.content?.['application/json']?.schema?.$ref;
    expect(schemaRef).toBe('#/components/schemas/CreateGuestRequest');
    expect(schema('CreateGuestRequest').required).toContain('clientRequestId');
    expect(schema('CreateGuestRequest').required).toContain('items');
    expect(schema('CreateGuestRequest').properties).not.toHaveProperty('roomId');
    expect(hasStaffSessionSecurity(createGuestRequest)).toBe(false);
  });

  it('defines the guest catalog, request, and QR access boundaries', () => {
    const guestContext = operation('/guest/context', 'get');
    const guestDepartments = operation('/guest/departments', 'get');
    const guestMenus = operation('/guest/menus', 'get');
    const guestMenuItem = operation('/guest/menus/{menuItemId}', 'get');
    const guestRequests = operation('/guest/requests', 'get');
    const guestRequestDetail = operation('/guest/requests/{requestId}', 'get');
    const issueQr = operation('/receptionist/rooms/{roomId}/guest-access-token', 'post');
    const revokeQr = operation('/receptionist/rooms/{roomId}/guest-access-token/revoke', 'post');

    for (const selectedOperation of [
      guestContext,
      guestDepartments,
      guestMenus,
      guestMenuItem,
      guestRequests,
      guestRequestDetail,
    ]) {
      expect(selectedOperation.security?.some((entry) => 'GuestAccessToken' in entry)).toBe(true);
      expect(selectedOperation.security?.some((entry) => 'TvDeviceCredential' in entry)).toBe(true);
    }

    for (const selectedOperation of [issueQr, revokeQr]) {
      expect(hasStaffSessionSecurity(selectedOperation)).toBe(true);
      expect(selectedOperation.responses).toHaveProperty('401');
      expect(selectedOperation.responses).toHaveProperty('403');
    }

    expect(schema('LocalizedText').required).toEqual(['uz', 'ru', 'en']);
    expect(schema('DepartmentUnit').required).toContain('enabled');
    expect(schema('DepartmentUnit').required).toContain('disabledReason');
    expect(schema('RequestItem').required).toContain('currency');
    expect(schema('RequestItem').properties).not.toHaveProperty('lineTotal');
    expect(schema('CreateGuestRequest').properties).not.toHaveProperty('roomId');
    expect(schema('GuestContext').required).toContain('availableUnits');
  });

  it('defines the department queue lifecycle used by the Cafe dashboard', () => {
    const list = operation('/department/requests', 'get');
    const detail = operation('/department/requests/{requestId}', 'get');
    const confirm = operation('/department/requests/{requestId}/confirm', 'post');
    const done = operation('/department/requests/{requestId}/done', 'post');

    for (const selectedOperation of [list, detail, confirm, done]) {
      expect(hasStaffSessionSecurity(selectedOperation)).toBe(true);
      expect(selectedOperation.responses).toHaveProperty('401');
      expect(selectedOperation.responses).toHaveProperty('403');
    }

    expect(confirm.responses).toHaveProperty('409');
    expect(done.responses).toHaveProperty('409');
    expect(schema('RequestStatus').enum).toEqual(['NEW', 'IN_PROCESS', 'COMPLETED']);
    expect(schema('StaffRequest').allOf?.some((part) => part.required?.includes('room'))).toBe(
      true,
    );
    expect(schema('StaffRequestListResponse').required).toEqual([
      'items',
      'page',
      'pageSize',
      'total',
    ]);
  });
});
