import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';

import { ApiException } from './api-exception';
import { PermissionsGuard } from './guards/permissions.guard';
import { RolesGuard } from './guards/roles.guard';
import { REQUIRED_PERMISSIONS_KEY } from './decorators/require-permissions.decorator';
import { REQUIRED_ROLES_KEY } from './decorators/require-roles.decorator';
import { getAccessibleUnits, mergeRolePermissions } from '../rbac/rbac.types';

function executionContext(
  request: Record<string, unknown>,
  handler: (...args: never[]) => unknown,
): {
  getHandler: () => (...args: never[]) => unknown;
  getClass: () => typeof Object;
  switchToHttp: () => { getRequest: () => Record<string, unknown> };
} {
  return {
    getHandler: () => handler,
    getClass: () => Object,
    switchToHttp: () => ({ getRequest: () => request }),
  };
}

describe('RBAC policy', () => {
  it('maps role permissions and department units according to scope', () => {
    expect(mergeRolePermissions(['SUPERADMIN'])).toEqual(['role:manage', 'user:manage']);
    expect(getAccessibleUnits(['SUPERADMIN'])).toEqual([]);
    expect(mergeRolePermissions(['RECEPTIONIST'])).toEqual([
      'receptionist:guest:assign',
      'receptionist:guest:checkout',
      'receptionist:guest:update',
      'receptionist:rooms:view',
      'receptionist:tv:pair',
    ]);
    expect(getAccessibleUnits(['ROOM_MANAGER'])).toEqual([
      'HOUSEKEEPING',
      'LOUNGE',
      'RESTAURANT',
      'SPA',
    ]);
    expect(getAccessibleUnits(['RECEPTIONIST'])).toEqual([]);
    expect(getAccessibleUnits(['RESTAURANT'])).toEqual(['RESTAURANT']);
    expect(getAccessibleUnits(['LOUNGE'])).toEqual(['LOUNGE']);
    expect(mergeRolePermissions(['CAFE'])).toContain('menu:manage');
    expect(mergeRolePermissions(['RESTAURANT'])).toContain('menu:manage');
    expect(mergeRolePermissions(['LOUNGE'])).toContain('menu:manage');
    expect(mergeRolePermissions(['SPA'])).toContain('menu:manage');
    expect(mergeRolePermissions(['BEAUTY_AND_SALON'])).toContain('menu:manage');
  });

  it('allows a required permission and rejects an out-of-scope permission', () => {
    const handler = () => undefined;
    Reflect.defineMetadata(REQUIRED_PERMISSIONS_KEY, ['request:confirm'], handler);
    const guard = new PermissionsGuard(new Reflector());

    const allowed = executionContext(
      {
        staffUser: {
          roles: ['SPA'],
          permissions: ['request:view', 'request:confirm'],
        },
      },
      handler,
    );
    expect(guard.canActivate(allowed as never)).toBe(true);

    const denied = executionContext(
      {
        staffUser: {
          roles: ['ROOM_MANAGER'],
          permissions: ['request:view', 'room-manager:monitor'],
        },
      },
      handler,
    );
    expect(() => guard.canActivate(denied as never)).toThrowError(ApiException);
    try {
      guard.canActivate(denied as never);
    } catch (error) {
      expect(error).toBeInstanceOf(ApiException);
      expect((error as ApiException).getStatus()).toBe(403);
    }
  });

  it('enforces an explicit role requirement', () => {
    const handler = () => undefined;
    Reflect.defineMetadata(REQUIRED_ROLES_KEY, ['RECEPTIONIST'], handler);
    const guard = new RolesGuard(new Reflector());

    expect(
      guard.canActivate(
        executionContext(
          { staffUser: { roles: ['RECEPTIONIST'], permissions: [] } },
          handler,
        ) as never,
      ),
    ).toBe(true);

    expect(() =>
      guard.canActivate(
        executionContext({ staffUser: { roles: ['SPA'], permissions: [] } }, handler) as never,
      ),
    ).toThrowError(ApiException);
  });
});
