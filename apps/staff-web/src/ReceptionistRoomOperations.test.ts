import { describe, expect, it } from 'vitest';

import { operationError } from './ReceptionistRoomOperations';
import { StaffApiError } from './management-api';
import type { ReceptionistCopy } from './i18n';

const copy = {
  apiError: 'generic',
  sessionExpired: 'session expired',
  tvApiUnavailable: 'api unavailable',
  tvApiProxyMissing: 'proxy missing',
  tvPermissionDenied: 'permission denied',
  tvRoomAlreadyPaired: 'already paired',
  tvPairingExpired: 'expired',
  tvPairingCodeNotFound: 'not found',
  tvPairingAlreadyUsed: 'already used',
  tvRoomMismatch: 'room mismatch',
} as ReceptionistCopy;

describe('Receptionist TV pairing error mapping', () => {
  it.each([
    ['PAIRING_CODE_NOT_FOUND', 'not found'],
    ['PAIRING_CODE_EXPIRED', 'expired'],
    ['PAIRING_CODE_ALREADY_USED', 'already used'],
    ['ROOM_NUMBER_MISMATCH', 'room mismatch'],
    ['TV_ROOM_ALREADY_PAIRED', 'already paired'],
    ['FORBIDDEN', 'permission denied'],
  ])('maps %s to an actionable message', (code, message) => {
    expect(operationError(new StaffApiError('server message', 409, code), copy, 'tv')).toBe(
      message,
    );
  });

  it('distinguishes session, proxy, and network failures', () => {
    expect(operationError(new StaffApiError('expired', 401, 'UNAUTHORIZED'), copy, 'tv')).toBe(
      'session expired',
    );
    expect(operationError(new StaffApiError('method', 405, 'API_ERROR'), copy, 'tv')).toBe(
      'proxy missing',
    );
    expect(
      operationError(new StaffApiError('down', 502, 'API_PROXY_UNAVAILABLE'), copy, 'tv'),
    ).toBe('api unavailable');
    expect(operationError(new StaffApiError('down', 0, 'STAFF_API_UNREACHABLE'), copy, 'tv')).toBe(
      'api unavailable',
    );
  });
});
