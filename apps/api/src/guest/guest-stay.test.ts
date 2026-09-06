import { describe, expect, it } from 'vitest';

import { GUEST_TIME_ZONE, toGuestStay } from './guest-stay';

describe('guest stay projection', () => {
  it('uses assignment start and stay days for the shared TV and Guest Web window', () => {
    expect(
      toGuestStay({
        assignedAt: '2026-08-30T10:00:00.000Z',
        stayDays: 3,
      }),
    ).toEqual({
      checkInAt: '2026-08-30T10:00:00.000Z',
      checkOutAt: '2026-09-02T10:00:00.000Z',
      totalDays: 3,
      timeZone: GUEST_TIME_ZONE,
    });
  });
});
