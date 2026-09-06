import { describe, expect, it } from 'vitest';

import { isStaffRealtimeEvent, isStaffRealtimeEventType } from './realtime-events';

const base = {
  eventId: 'event-1',
  occurredAt: '2026-09-02T10:00:00.000Z',
  entityId: '098777',
  updatedAt: '2026-09-02T10:00:00.000Z',
};

describe('Staff realtime event contract', () => {
  it('accepts a request event without coercing identifiers', () => {
    expect(
      isStaffRealtimeEvent({
        ...base,
        eventType: 'staff.request.created',
        unit: 'HOUSEKEEPING',
        status: 'NEW',
        roomId: 'room-1',
        guestAssignmentId: 'assignment-1',
      }),
    ).toBe(true);
    expect(isStaffRealtimeEventType('staff.request.updated')).toBe(true);
  });

  it('rejects an event with an unknown unit or status', () => {
    expect(
      isStaffRealtimeEvent({
        ...base,
        eventType: 'staff.request.updated',
        unit: 'BUTIK_INDONESIA',
        status: 'PAUSED',
        roomId: 'room-1',
        guestAssignmentId: null,
      }),
    ).toBe(false);
    expect(
      isStaffRealtimeEvent({
        ...base,
        eventType: 'staff.request.created',
        unit: 'UNKNOWN',
        status: 'NEW',
        roomId: 'room-1',
        guestAssignmentId: null,
      }),
    ).toBe(false);
  });

  it('accepts the minimum room and boutique payloads', () => {
    expect(
      isStaffRealtimeEvent({
        ...base,
        eventType: 'staff.room.updated',
        roomId: 'room-1',
        roomNumber: '305',
        roomStatus: 'OCCUPIED',
      }),
    ).toBe(true);
    expect(
      isStaffRealtimeEvent({
        ...base,
        eventType: 'staff.boutique.inventory.updated',
        unit: 'BUTIK_INDONESIA',
        variantId: 'variant-1',
      }),
    ).toBe(true);
  });
});
