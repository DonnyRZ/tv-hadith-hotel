import type { RequestStatus, StaffRequest } from './management-api';

export type ActiveRequestFilter = 'ALL' | 'NEW' | 'IN_PROCESS';

export function sortRequests(requests: readonly StaffRequest[]): StaffRequest[] {
  return [...requests].sort(
    (left, right) =>
      right.requestedAt.localeCompare(left.requestedAt) || right.id.localeCompare(left.id),
  );
}

export function filterActiveRequests(
  requests: readonly StaffRequest[],
  filter: ActiveRequestFilter,
): StaffRequest[] {
  return requests.filter(
    (request) =>
      isActiveRequestStatus(request.status) && (filter === 'ALL' || request.status === filter),
  );
}

export function paginateRequests<T>(items: readonly T[], page: number, pageSize: number): T[] {
  const start = Math.max(0, page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

export function activeRequestTotal(
  counts: { newCount: number; inProcessCount: number },
  filter: ActiveRequestFilter,
): number {
  if (filter === 'NEW') return counts.newCount;
  if (filter === 'IN_PROCESS') return counts.inProcessCount;
  return counts.newCount + counts.inProcessCount;
}

export function isActiveRequestStatus(status: RequestStatus): boolean {
  return status === 'NEW' || status === 'IN_PROCESS';
}
