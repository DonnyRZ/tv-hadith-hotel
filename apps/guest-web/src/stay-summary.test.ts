import { describe, expect, it } from 'vitest';

import type { GuestStay } from '@room-service/api-client';

import { getStaySummary } from './stay-summary';

const stay: GuestStay = {
  checkInAt: '2026-09-01T07:00:00.000Z',
  checkOutAt: '2026-09-04T07:00:00.000Z',
  timeZone: 'Asia/Tashkent',
  totalDays: 3,
};

describe('getStaySummary', () => {
  it('calculates remaining days from the absolute checkout timestamp', () => {
    expect(getStaySummary(stay, new Date('2026-09-01T07:00:00.000Z'))).toMatchObject({
      daysRemaining: 3,
      isCheckOutToday: false,
      isExpired: false,
    });
    expect(getStaySummary(stay, new Date('2026-09-02T07:00:00.000Z'))).toMatchObject({
      daysRemaining: 2,
      isCheckOutToday: false,
      isExpired: false,
    });
  });

  it('shows the final day without ever displaying zero while the stay is active', () => {
    expect(getStaySummary(stay, new Date('2026-09-04T06:30:00.000Z'))).toMatchObject({
      daysRemaining: 1,
      isCheckOutToday: true,
      isExpired: false,
    });
  });

  it('marks the stay expired at checkout and clamps the remaining value to zero', () => {
    expect(getStaySummary(stay, new Date('2026-09-04T07:00:00.000Z'))).toMatchObject({
      daysRemaining: 0,
      isCheckOutToday: false,
      isExpired: true,
    });
  });

  it('rejects incomplete or invalid stay data instead of inventing a duration', () => {
    expect(getStaySummary(undefined, new Date('2026-09-02T07:00:00.000Z'))).toBeNull();
    expect(
      getStaySummary({ ...stay, checkOutAt: 'not-a-date' }, new Date('2026-09-02T07:00:00.000Z')),
    ).toBeNull();
  });
});
