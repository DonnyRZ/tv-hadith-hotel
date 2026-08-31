import { describe, expect, it } from 'vitest';

import {
  activeRequestTotal,
  filterActiveRequests,
  paginateRequests,
  sortRequests,
} from './CafeDashboard.helpers';
import type { StaffRequest } from './management-api';

function request(id: string, status: StaffRequest['status'], requestedAt: string): StaffRequest {
  return { id, status, requestedAt } as StaffRequest;
}

describe('Cafe dashboard request helpers', () => {
  it('sorts the operational queue newest first with a stable id fallback', () => {
    const older = request('a', 'NEW', '2026-08-30T09:00:00.000Z');
    const newer = request('b', 'IN_PROCESS', '2026-08-30T10:00:00.000Z');

    expect(sortRequests([older, newer]).map((item) => item.id)).toEqual(['b', 'a']);
  });

  it('filters only active statuses and paginates at ten records per page', () => {
    const requests = [
      request('new', 'NEW', '2026-08-30T10:00:00.000Z'),
      request('process', 'IN_PROCESS', '2026-08-30T09:00:00.000Z'),
      request('done', 'COMPLETED', '2026-08-30T08:00:00.000Z'),
    ];

    expect(filterActiveRequests(requests, 'ALL').map((item) => item.id)).toEqual([
      'new',
      'process',
    ]);
    expect(filterActiveRequests(requests, 'IN_PROCESS').map((item) => item.id)).toEqual([
      'process',
    ]);
    expect(
      paginateRequests(
        Array.from({ length: 21 }, (_, index) => index),
        3,
        10,
      ),
    ).toEqual([20]);
  });

  it('derives queue totals from API totals rather than fabricated row values', () => {
    const counts = { newCount: 7, inProcessCount: 3 };

    expect(activeRequestTotal(counts, 'ALL')).toBe(10);
    expect(activeRequestTotal(counts, 'NEW')).toBe(7);
    expect(activeRequestTotal(counts, 'IN_PROCESS')).toBe(3);
  });
});
