import { Injectable } from '@nestjs/common';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { StaffRealtimeEvent } from '@room-service/contracts/realtime-events';
import type { Server, Socket } from 'socket.io';

import { AuthService } from '../auth/auth.service';
import type { PublicStaffUser, StaffSession } from '../auth/auth.types';
import { getAccessibleUnits, isRoleCode, type UnitCode } from '../rbac/rbac.types';
import { RealtimeState } from './realtime.state';

const STAFF_UNIT_CHANNEL_PREFIX = 'staff:unit:';
const STAFF_ROOM_CHANNEL = 'staff:rooms';
export const STAFF_RECEPTIONIST_FOLIO_CHANNEL = 'staff:receptionist:folio';
const STAFF_SESSION_RECHECK_INTERVAL_MS = 60_000;

type StaffSocketRequest = Socket['request'] & { session?: StaffSession };

@Injectable()
@WebSocketGateway({
  namespace: '/staff-realtime',
  transports: ['websocket', 'polling'],
})
export class StaffRealtimeGateway {
  @WebSocketServer()
  public server!: Server;

  public constructor(
    private readonly authService: AuthService,
    private readonly realtimeState: RealtimeState,
  ) {}

  public async handleConnection(client: Socket): Promise<void> {
    if (!this.realtimeState.isEnabled()) {
      client.disconnect(true);
      return;
    }

    const request = client.request as StaffSocketRequest;
    try {
      const staff = await this.authService.getCurrentStaffUser(request.session);
      const channels = channelsForStaff(staff);
      if (channels.length === 0) throw new Error('Staff account has no realtime scope');
      await Promise.all(channels.map((channel) => client.join(channel)));
      client.data.staffUserId = staff.id;
      client.data.staffChannels = channels;
      client.emit('staff.realtime.ready');
      const sessionCheck = setInterval(() => {
        void this.authService.getCurrentStaffUser(request.session).catch(() => {
          client.disconnect(true);
        });
      }, STAFF_SESSION_RECHECK_INTERVAL_MS);
      sessionCheck.unref?.();
      client.data.staffSessionCheck = sessionCheck;
    } catch {
      client.disconnect(true);
    }
  }

  public handleDisconnect(client: Socket): void {
    const sessionCheck = client.data.staffSessionCheck as
      ReturnType<typeof setInterval> | undefined;
    if (sessionCheck !== undefined) clearInterval(sessionCheck);
    delete client.data.staffUserId;
    delete client.data.staffChannels;
    delete client.data.staffSessionCheck;
  }

  public notify(event: StaffRealtimeEvent): void {
    if (this.server === undefined || !this.realtimeState.isEnabled()) return;
    const channels = channelsForEvent(event);
    if (channels.length === 0) return;

    this.server.to(channels).emit(event.eventType, event);
  }
}

function channelsForStaff(staff: PublicStaffUser): string[] {
  const channels = new Set<string>();
  const roles = staff.roles.filter(isRoleCode);
  const units = getAccessibleUnits(roles);
  if (staff.permissions.includes('request:view')) {
    for (const unit of units) channels.add(unitChannel(unit));
  }
  if (staff.permissions.includes('receptionist:rooms:view')) channels.add(STAFF_ROOM_CHANNEL);
  if (staff.permissions.includes('receptionist:folio:view')) {
    channels.add(STAFF_RECEPTIONIST_FOLIO_CHANNEL);
  }
  return [...channels];
}

function channelsForEvent(event: StaffRealtimeEvent): string[] {
  switch (event.eventType) {
    case 'staff.room.updated':
      return [STAFF_ROOM_CHANNEL];
    case 'staff.request.created':
    case 'staff.request.updated':
      return [unitChannel(event.unit), STAFF_RECEPTIONIST_FOLIO_CHANNEL];
    case 'staff.boutique.catalog.updated':
    case 'staff.boutique.inventory.updated':
      return [unitChannel('BUTIK_INDONESIA')];
    default:
      return [];
  }
}

function unitChannel(unit: UnitCode): `${typeof STAFF_UNIT_CHANNEL_PREFIX}${UnitCode}` {
  return `${STAFF_UNIT_CHANNEL_PREFIX}${unit}`;
}
