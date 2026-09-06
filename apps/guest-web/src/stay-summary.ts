import type { GuestStay } from '@room-service/api-client';

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export interface StaySummaryState {
  daysRemaining: number;
  isCheckOutToday: boolean;
  isExpired: boolean;
}

function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format();
    return true;
  } catch {
    return false;
  }
}

function dateKey(value: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: '2-digit',
    timeZone,
    year: 'numeric',
  }).formatToParts(value);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return `${values.get('year')}-${values.get('month')}-${values.get('day')}`;
}

export function getStaySummary(
  stay: GuestStay | null | undefined,
  now = new Date(),
): StaySummaryState | null {
  if (
    stay === null ||
    stay === undefined ||
    !Number.isInteger(stay.totalDays) ||
    stay.totalDays < 1 ||
    !isValidTimeZone(stay.timeZone)
  ) {
    return null;
  }

  const checkInMs = Date.parse(stay.checkInAt);
  const checkOutMs = Date.parse(stay.checkOutAt);
  const nowMs = now.getTime();
  if (!Number.isFinite(checkInMs) || !Number.isFinite(checkOutMs) || !Number.isFinite(nowMs)) {
    return null;
  }
  if (checkOutMs <= checkInMs) return null;

  const millisecondsRemaining = checkOutMs - nowMs;
  const isExpired = millisecondsRemaining <= 0;
  return {
    daysRemaining: isExpired ? 0 : Math.ceil(millisecondsRemaining / MILLISECONDS_PER_DAY),
    isCheckOutToday:
      !isExpired && dateKey(new Date(checkOutMs), stay.timeZone) === dateKey(now, stay.timeZone),
    isExpired,
  };
}
