import { describe, expect, it, vi } from 'vitest';

import type { PublicStaffUser } from '../auth/auth.types';
import { RealtimeState } from './realtime.state';
import { StaffRealtimeGateway } from './staff-realtime.gateway';

function clientFor(session: Record<string, unknown> = {}) {
  return {
    data: {} as Record<string, unknown>,
    disconnect: vi.fn(),
    emit: vi.fn(),
    join: vi.fn(async () => undefined),
    request: { session },
  };
}

function staff(overrides: Partial<PublicStaffUser> = {}): PublicStaffUser {
  return {
    id: 'staff-1',
    displayName: 'Staff',
    roles: ['CAFE'],
    permissions: ['request:view'],
    ...overrides,
  };
}

describe('StaffRealtimeGateway', () => {
  it('assigns only server-derived unit channels', async () => {
    const state = new RealtimeState();
    state.configure(true);
    const auth = { getCurrentStaffUser: vi.fn(async () => staff()) };
    const gateway = new StaffRealtimeGateway(auth as never, state);
    const client = clientFor();

    await gateway.handleConnection(client as never);

    expect(client.join).toHaveBeenCalledWith('staff:unit:CAFE');
    expect(client.join).toHaveBeenCalledTimes(1);
    expect(client.data.staffChannels).toEqual(['staff:unit:CAFE']);
  });

  it('gives Receptionist both Housekeeping and room channels', async () => {
    const state = new RealtimeState();
    state.configure(true);
    const auth = {
      getCurrentStaffUser: vi.fn(async () =>
        staff({
          roles: ['RECEPTIONIST'],
          permissions: ['request:view', 'receptionist:rooms:view', 'receptionist:folio:view'],
        }),
      ),
    };
    const gateway = new StaffRealtimeGateway(auth as never, state);
    const client = clientFor();

    await gateway.handleConnection(client as never);

    expect(client.join).toHaveBeenCalledWith('staff:unit:HOUSEKEEPING');
    expect(client.join).toHaveBeenCalledWith('staff:rooms');
    expect(client.join).toHaveBeenCalledWith('staff:receptionist:folio');
    expect(client.join).toHaveBeenCalledTimes(3);
    expect(client.emit).toHaveBeenCalledWith('staff.realtime.ready');
  });

  it('disconnects a session that cannot be authenticated or scoped', async () => {
    const state = new RealtimeState();
    state.configure(true);
    const auth = {
      getCurrentStaffUser: vi.fn(async () => {
        throw new Error('unauthorized');
      }),
    };
    const gateway = new StaffRealtimeGateway(auth as never, state);
    const client = clientFor();

    await gateway.handleConnection(client as never);

    expect(client.disconnect).toHaveBeenCalledWith(true);
  });

  it('emits request events to the event unit and Receptionist folio channels', () => {
    const state = new RealtimeState();
    state.configure(true);
    const gateway = new StaffRealtimeGateway({} as never, state);
    const emit = vi.fn();
    const to = vi.fn(() => ({ emit }));
    gateway.server = { to } as never;

    gateway.notify({
      eventId: 'event-1',
      eventType: 'staff.request.updated',
      occurredAt: '2026-09-02T10:00:00.000Z',
      entityId: 'request-1',
      updatedAt: '2026-09-02T10:00:00.000Z',
      unit: 'CAFE',
      status: 'IN_PROCESS',
      roomId: 'room-1',
      guestAssignmentId: 'assignment-1',
    });

    expect(to).toHaveBeenCalledWith(['staff:unit:CAFE', 'staff:receptionist:folio']);
    expect(emit).toHaveBeenCalledWith(
      'staff.request.updated',
      expect.objectContaining({
        entityId: 'request-1',
      }),
    );
  });
});
