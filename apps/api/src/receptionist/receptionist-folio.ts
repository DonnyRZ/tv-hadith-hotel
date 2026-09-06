import type { RequestItemRecord, RequestRecord, RequestStatus } from '../requests/request.types';
import {
  emptyReceptionistFolioSummary,
  type GuestAssignmentRecord,
  type ReceptionistFolioAmount,
  type ReceptionistFolioStatusCounts,
  type ReceptionistFolioSummary,
  type RoomReference,
} from './receptionist.types';

export interface ReceptionistFolioItem extends RequestItemRecord {
  lineTotal: number | null;
}

export interface ReceptionistFolioOrder {
  id: string;
  guestAssignmentId: string | null;
  guestName: string | null;
  department: RequestRecord['department'];
  unit: RequestRecord['unit'];
  room: RoomReference;
  items: ReceptionistFolioItem[];
  guestNote: string | null;
  status: RequestStatus;
  requestedAt: string;
  confirmedAt: string | null;
  completedAt: string | null;
  reservationExpiresAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  cancellationSource: RequestRecord['cancellationSource'];
  statusHistory: RequestRecord['statusHistory'];
  createdAt: string;
  updatedAt: string;
}

export interface ReceptionistFolioResponse {
  room: RoomReference;
  assignment: GuestAssignmentRecord | null;
  orders: ReceptionistFolioOrder[];
  summary: ReceptionistFolioSummary;
  page: number;
  pageSize: number;
  total: number;
  lastUpdated: string;
}

export interface ReceptionistFolioHistorySummary {
  assignment: GuestAssignmentRecord;
  summary: ReceptionistFolioSummary;
}

export interface ReceptionistFolioHistoryListResponse {
  room: RoomReference;
  items: ReceptionistFolioHistorySummary[];
  page: number;
  pageSize: number;
  total: number;
  lastUpdated: string;
}

const BILLABLE_STATUSES: readonly RequestStatus[] = ['NEW', 'IN_PROCESS', 'COMPLETED'];

function isBillableStatus(status: RequestStatus): boolean {
  return BILLABLE_STATUSES.includes(status);
}

function priceableItem(item: RequestItemRecord): item is RequestItemRecord & {
  unitPrice: number;
  currency: string;
} {
  return (
    typeof item.unitPrice === 'number' &&
    Number.isFinite(item.unitPrice) &&
    item.unitPrice >= 0 &&
    typeof item.currency === 'string' &&
    item.currency.trim().length > 0
  );
}

function emptyStatusCounts(): ReceptionistFolioStatusCounts {
  return { NEW: 0, IN_PROCESS: 0, COMPLETED: 0, CANCELLED: 0 };
}

function sortedAmounts(amounts: Map<string, number>): ReceptionistFolioAmount[] {
  return [...amounts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([currency, amount]) => ({ currency, amount }));
}

export function summarizeFolioRequests(requests: readonly RequestRecord[]): ReceptionistFolioSummary {
  const summary = emptyReceptionistFolioSummary();
  const statusCounts = emptyStatusCounts();
  const totals = new Map<string, number>();
  let latestRequestedAt: string | null = null;

  for (const request of requests) {
    summary.orderCount += 1;
    statusCounts[request.status] += 1;
    if (request.status === 'NEW' || request.status === 'IN_PROCESS') summary.openOrderCount += 1;
    summary.itemCount += request.items.reduce((total, item) => total + item.quantity, 0);
    if (latestRequestedAt === null || request.requestedAt > latestRequestedAt) {
      latestRequestedAt = request.requestedAt;
    }

    if (!isBillableStatus(request.status)) continue;
    for (const item of request.items) {
      if (!priceableItem(item)) {
        summary.unpricedItemCount += 1;
        continue;
      }
      const currency = item.currency.trim().toUpperCase();
      totals.set(currency, (totals.get(currency) ?? 0) + item.unitPrice * item.quantity);
    }
  }

  summary.statusCounts = statusCounts;
  summary.totalsByCurrency = sortedAmounts(totals);
  summary.isTotalComplete = summary.unpricedItemCount === 0;
  summary.lastOrderAt = latestRequestedAt;
  return summary;
}

export function toReceptionistFolioOrder(request: RequestRecord): ReceptionistFolioOrder {
  return {
    id: request.id,
    guestAssignmentId: request.guestAssignmentId,
    guestName: request.guestName,
    department: request.department,
    unit: request.unit,
    room: { ...request.room },
    items: request.items.map((item) => ({
      ...item,
      localizedName: { ...item.localizedName },
      lineTotal: priceableItem(item) ? item.unitPrice * item.quantity : null,
    })),
    guestNote: request.guestNote,
    status: request.status,
    requestedAt: request.requestedAt,
    confirmedAt: request.confirmedAt,
    completedAt: request.completedAt,
    reservationExpiresAt: request.reservationExpiresAt,
    cancelledAt: request.cancelledAt,
    cancellationReason: request.cancellationReason,
    cancellationSource: request.cancellationSource,
    statusHistory: request.statusHistory.map((entry) => ({
      ...entry,
      changedBy: entry.changedBy === null ? null : { ...entry.changedBy },
    })),
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
  };
}

export function emptyFolioResponse(
  room: RoomReference,
  assignment: GuestAssignmentRecord | null,
  page: number,
  pageSize: number,
): ReceptionistFolioResponse {
  return {
    room: { ...room },
    assignment: assignment === null ? null : { ...assignment, room: { ...assignment.room } },
    orders: [],
    summary: emptyReceptionistFolioSummary(),
    page,
    pageSize,
    total: 0,
    lastUpdated: new Date().toISOString(),
  };
}
