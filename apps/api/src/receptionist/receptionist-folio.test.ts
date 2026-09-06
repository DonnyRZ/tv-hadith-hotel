import { describe, expect, it } from 'vitest';

import type { RequestRecord } from '../requests/request.types';
import { summarizeFolioRequests } from './receptionist-folio';

function request(overrides: Partial<RequestRecord> = {}): RequestRecord {
  return {
    id: 'request-1',
    clientRequestId: 'client-1',
    guestAssignmentId: 'assignment-1',
    guestName: 'Guest',
    department: 'CAFE',
    unit: 'CAFE',
    room: { id: 'room-230', number: '230' },
    items: [
      {
        menuItemId: 'menu-1',
        unit: 'CAFE',
        kind: 'PRODUCT',
        name: 'Coffee',
        localizedName: { uz: 'Coffee', ru: 'Coffee', en: 'Coffee' },
        quantity: 2,
        note: null,
        unitPrice: 25_000,
        currency: 'UZS',
      },
    ],
    guestNote: null,
    status: 'NEW',
    requestedAt: '2026-09-02T10:00:00.000Z',
    confirmedAt: null,
    completedAt: null,
    reservationExpiresAt: null,
    cancelledAt: null,
    cancellationReason: null,
    cancellationSource: null,
    statusHistory: [],
    createdAt: '2026-09-02T10:00:00.000Z',
    updatedAt: '2026-09-02T10:00:00.000Z',
    ...overrides,
  };
}

describe('Receptionist folio calculation', () => {
  it('includes active billable statuses and groups totals by currency', () => {
    const summary = summarizeFolioRequests([
      request(),
      request({
        id: 'request-2',
        unit: 'RESTAURANT',
        department: 'FOOD_AND_BEVERAGES',
        items: [
          {
            ...request().items[0]!,
            menuItemId: 'menu-2',
            unit: 'RESTAURANT',
            unitPrice: 10,
            currency: 'USD',
            quantity: 1,
          },
        ],
        status: 'COMPLETED',
      }),
    ]);

    expect(summary).toMatchObject({
      orderCount: 2,
      openOrderCount: 1,
      itemCount: 3,
      unpricedItemCount: 0,
      isTotalComplete: true,
      statusCounts: { NEW: 1, IN_PROCESS: 0, COMPLETED: 1, CANCELLED: 0 },
    });
    expect(summary.totalsByCurrency).toEqual([
      { currency: 'USD', amount: 10 },
      { currency: 'UZS', amount: 50_000 },
    ]);
  });

  it('keeps cancelled orders visible in counts but excludes them from totals', () => {
    const summary = summarizeFolioRequests([
      request({ status: 'CANCELLED', cancelledAt: '2026-09-02T10:05:00.000Z' }),
    ]);

    expect(summary).toMatchObject({
      orderCount: 1,
      openOrderCount: 0,
      itemCount: 2,
      unpricedItemCount: 0,
      isTotalComplete: true,
      totalsByCurrency: [],
      statusCounts: { NEW: 0, IN_PROCESS: 0, COMPLETED: 0, CANCELLED: 1 },
    });
  });

  it('marks the folio incomplete when a billable item has no price', () => {
    const summary = summarizeFolioRequests([
      request({
        items: [{ ...request().items[0]!, unitPrice: null, currency: null }],
      }),
    ]);

    expect(summary).toMatchObject({
      orderCount: 1,
      unpricedItemCount: 1,
      isTotalComplete: false,
      totalsByCurrency: [],
    });
  });
});
