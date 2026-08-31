export const ROLE_CODES = [
  'SUPERADMIN',
  'ROOM_MANAGER',
  'RECEPTIONIST',
  'SPA',
  'RESTAURANT',
  'LOUNGE',
  'HOUSEKEEPING',
  'BEAUTY_AND_SALON',
  'CAFE',
] as const;

export type RoleCode = (typeof ROLE_CODES)[number];

export const PERMISSION_CODES = [
  'request:view',
  'request:confirm',
  'request:complete',
  'request:history',
  'room-manager:monitor',
  'receptionist:rooms:view',
  'receptionist:guest:assign',
  'receptionist:guest:update',
  'receptionist:guest:checkout',
  'receptionist:tv:pair',
  'menu:manage',
  'user:manage',
  'role:manage',
] as const;

export type PermissionCode = (typeof PERMISSION_CODES)[number];

export const UNIT_CODES = [
  'SPA',
  'RESTAURANT',
  'LOUNGE',
  'HOUSEKEEPING',
  'BEAUTY_AND_SALON',
  'CAFE',
] as const;

export type UnitCode = (typeof UNIT_CODES)[number];

export const ROLE_PERMISSIONS: Readonly<Record<RoleCode, readonly PermissionCode[]>> = {
  SUPERADMIN: ['user:manage', 'role:manage'],
  ROOM_MANAGER: ['request:view', 'request:history', 'room-manager:monitor'],
  RECEPTIONIST: [
    'receptionist:rooms:view',
    'receptionist:guest:assign',
    'receptionist:guest:update',
    'receptionist:guest:checkout',
    'receptionist:tv:pair',
  ],
  SPA: ['request:view', 'request:confirm', 'request:complete', 'request:history', 'menu:manage'],
  RESTAURANT: [
    'request:view',
    'request:confirm',
    'request:complete',
    'request:history',
    'menu:manage',
  ],
  LOUNGE: ['request:view', 'request:confirm', 'request:complete', 'request:history', 'menu:manage'],
  HOUSEKEEPING: ['request:view', 'request:confirm', 'request:complete', 'request:history'],
  BEAUTY_AND_SALON: [
    'request:view',
    'request:confirm',
    'request:complete',
    'request:history',
    'menu:manage',
  ],
  CAFE: ['request:view', 'request:confirm', 'request:complete', 'request:history', 'menu:manage'],
};

export const ROLE_UNITS: Readonly<Record<RoleCode, readonly UnitCode[]>> = {
  SUPERADMIN: [],
  ROOM_MANAGER: ['SPA', 'RESTAURANT', 'LOUNGE', 'HOUSEKEEPING'],
  RECEPTIONIST: [],
  SPA: ['SPA'],
  RESTAURANT: ['RESTAURANT'],
  LOUNGE: ['LOUNGE'],
  HOUSEKEEPING: ['HOUSEKEEPING'],
  BEAUTY_AND_SALON: ['BEAUTY_AND_SALON'],
  CAFE: ['CAFE'],
};

export function isRoleCode(value: unknown): value is RoleCode {
  return typeof value === 'string' && (ROLE_CODES as readonly string[]).includes(value);
}

export function isPermissionCode(value: unknown): value is PermissionCode {
  return typeof value === 'string' && (PERMISSION_CODES as readonly string[]).includes(value);
}

export function mergeRolePermissions(
  roles: readonly RoleCode[],
  explicitPermissions: readonly PermissionCode[] = [],
): PermissionCode[] {
  const permissions = new Set<PermissionCode>(explicitPermissions);

  for (const role of roles) {
    for (const permission of ROLE_PERMISSIONS[role]) {
      permissions.add(permission);
    }
  }

  return [...permissions].sort();
}

export function getAccessibleUnits(roles: readonly RoleCode[]): UnitCode[] {
  const units = new Set<UnitCode>();

  for (const role of roles) {
    for (const unit of ROLE_UNITS[role]) {
      units.add(unit);
    }
  }

  return [...units].sort();
}
