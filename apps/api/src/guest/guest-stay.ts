import type { GuestAssignmentRecord } from '../receptionist/receptionist.types';
import type { GuestStay } from './guest.types';

export const GUEST_TIME_ZONE = 'Asia/Tashkent';

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Builds the stay window from the same assignment data used by Guest Web and
 * Smart TV. Keep this calculation in one place so both clients show the same
 * check-in/check-out dates and remaining-day semantics.
 */
export function toGuestStay(
  assignment: Pick<GuestAssignmentRecord, 'assignedAt' | 'stayDays'>,
): GuestStay {
  const checkInAt = new Date(assignment.assignedAt);
  const checkOutAt = new Date(checkInAt.getTime() + assignment.stayDays * MILLISECONDS_PER_DAY);
  return {
    checkInAt: checkInAt.toISOString(),
    checkOutAt: checkOutAt.toISOString(),
    totalDays: assignment.stayDays,
    timeZone: GUEST_TIME_ZONE,
  };
}
