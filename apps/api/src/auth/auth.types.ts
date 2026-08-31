import type { Request } from 'express';
import type { Session } from 'express-session';

import type { PermissionCode } from '../rbac/rbac.types';

declare module 'express-session' {
  interface SessionData {
    staffUserId?: string;
  }
}

export interface StaffUserRecord {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  roles: string[];
  permissions: PermissionCode[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PublicStaffUser {
  id: string;
  displayName: string;
  roles: string[];
  permissions: PermissionCode[];
}

export type StaffSession = Session & { staffUserId?: string };

export type StaffRequest = Request & {
  session: StaffSession;
  staffUser?: PublicStaffUser;
};
