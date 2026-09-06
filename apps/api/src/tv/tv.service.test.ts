import { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';

import type { ReceptionistRepository } from '../receptionist/receptionist.repository';
import { TvService } from './tv.service';
import {
  TvDevicePairingAlreadyUsedError,
  TvDevicePairingCodeChangedError,
  TvDevicePairingExpiredError,
  TvDeviceRoomNumberMismatchError,
  type TvDeviceRepository,
} from './tv-device.repository';
import type { TvDeviceRecord } from './tv.types';

const baseRecord: TvDeviceRecord = {
  id: '8f1d4a21-ff5a-4c77-8d14-3d2dd7e8c8d2',
  installationId: 'tv-installation-1',
  deviceCode: 'device_test',
  pairingCodeHash: 'not-used-by-stub',
  pairingExpiresAt: new Date(Date.now() + 60_000).toISOString(),
  credentialHash: 'credential-hash',
  credential: 'tv_credential',
  status: 'PENDING',
  room: null,
  deviceModel: 'Test TV',
  appVersion: '1.0.0',
  androidApiLevel: 36,
  createdAt: new Date().toISOString(),
  pairedAt: null,
  claimedAt: null,
  revokedAt: null,
};

function repositoryFor(
  pair: TvDeviceRepository['pair'],
  findByPairingCode: TvDeviceRepository['findByPairingCode'] = async () => ({
    ...baseRecord,
  }),
  findByCredential: TvDeviceRepository['findByCredential'] = async () => null,
): TvDeviceRepository {
  return {
    createPending: async () => {
      throw new Error('not used');
    },
    list: async () => ({ items: [], total: 0 }),
    findByPairingCode,
    findByInstallationId: async () => null,
    pair,
    claim: async () => {
      throw new Error('not used');
    },
    findByCredential,
    revoke: async () => {
      throw new Error('not used');
    },
    reset: async () => {
      throw new Error('not used');
    },
  };
}

function serviceWith(
  repository: TvDeviceRepository,
  receptionistRepository?: Pick<ReceptionistRepository, 'findActiveAssignmentByRoomId'>,
  config: ConfigService = new ConfigService({ TV_PAIRING_TTL_SECONDS: '600' }),
): TvService {
  return new TvService(
    repository,
    config,
    receptionistRepository as ReceptionistRepository | undefined,
  );
}

describe('TV pairing service contract', () => {
  it('passes pairing codes as strings without losing leading zeroes', async () => {
    let receivedCode = '';
    const repository = repositoryFor(async (_recordId, input, pairedAt) => {
      receivedCode = input.pairingCode;
      return {
        ...baseRecord,
        status: 'PAIRED',
        room: { id: input.roomId, number: input.roomNumber },
        pairedAt,
      };
    });

    const result = await serviceWith(repository).pairDevice({
      pairingCode: '098777',
      roomId: 'c3a4b6d6-5a58-4dd8-a4c5-2d4606c8a1e4',
      roomNumber: '417',
    });

    expect(receivedCode).toBe('098777');
    expect(result.device.room.number).toBe('417');
  });

  it.each([
    [new TvDevicePairingExpiredError(), 410, 'PAIRING_CODE_EXPIRED'],
    [new TvDevicePairingAlreadyUsedError(), 409, 'PAIRING_CODE_ALREADY_USED'],
    [new TvDevicePairingCodeChangedError(), 404, 'PAIRING_CODE_NOT_FOUND'],
    [new TvDeviceRoomNumberMismatchError(), 409, 'ROOM_NUMBER_MISMATCH'],
  ])('maps %s to the stable API error contract', async (repositoryError, status, code) => {
    const service = serviceWith(
      repositoryFor(async () => {
        throw repositoryError;
      }),
    );

    await expect(
      service.pairDevice({
        pairingCode: '098777',
        roomId: 'c3a4b6d6-5a58-4dd8-a4c5-2d4606c8a1e4',
        roomNumber: '417',
      }),
    ).rejects.toMatchObject({
      status,
    });

    try {
      await service.pairDevice({
        pairingCode: '098777',
        roomId: 'c3a4b6d6-5a58-4dd8-a4c5-2d4606c8a1e4',
        roomNumber: '417',
      });
    } catch (error) {
      expect((error as { getResponse: () => { code: string } }).getResponse().code).toBe(code);
    }
  });

  it('returns the active guest stay window in TV context', async () => {
    const room = { id: 'room-417', number: '417' };
    const activeAssignment = {
      id: 'assignment-417',
      room,
      guestName: 'TV Guest',
      stayDays: 3,
      status: 'ACTIVE' as const,
      assignedAt: '2026-08-30T10:00:00.000Z',
      updatedAt: '2026-08-30T10:00:00.000Z',
      checkedOutAt: null,
      assignedBy: { id: 'staff-1', displayName: 'Receptionist', role: 'RECEPTIONIST' },
    };
    const repository = repositoryFor(
      async () => {
        throw new Error('not used');
      },
      async () => ({ ...baseRecord, status: 'CLAIMED', room }),
      async () => ({ ...baseRecord, status: 'CLAIMED', room }),
    );

    const context = await serviceWith(repository, {
      findActiveAssignmentByRoomId: async () => activeAssignment,
    }).getContext('tv_credential');

    expect(context).toMatchObject({
      roomStatus: 'OCCUPIED',
      welcome: { guestName: 'TV Guest', personalized: true },
      stay: {
        checkInAt: '2026-08-30T10:00:00.000Z',
        checkOutAt: '2026-09-02T10:00:00.000Z',
        totalDays: 3,
        timeZone: 'Asia/Tashkent',
      },
    });
  });

  it('returns a disabled update manifest unless the production feed is explicitly configured', () => {
    const manifest = serviceWith(
      repositoryFor(async () => {
        throw new Error('not used');
      }),
    ).getUpdateManifest();

    expect(manifest).toEqual({
      enabled: false,
      packageName: 'com.roomservice.tv',
      latestVersionCode: 0,
      latestVersionName: null,
      apkUrl: null,
      sha256: null,
      certificateSha256: null,
      releaseId: 'local',
      mandatory: false,
      minSupportedVersionCode: null,
    });
  });

  it('returns only the public metadata of an explicitly configured update', () => {
    const manifest = serviceWith(
      repositoryFor(async () => {
        throw new Error('not used');
      }),
      undefined,
      new ConfigService({
        TV_UPDATE_ENABLED: 'true',
        TV_UPDATE_VERSION_CODE: '11',
        TV_UPDATE_VERSION_NAME: '0.4.7',
        TV_UPDATE_APK_URL: 'https://updates.example.com/egi-tv/11/app-release.apk',
        TV_UPDATE_SHA256: 'A'.repeat(64),
        TV_UPDATE_CERTIFICATE_SHA256: 'B'.repeat(64),
        TV_UPDATE_RELEASE_ID: 'tv-0.4.7',
        TV_UPDATE_MANDATORY: 'false',
        TV_UPDATE_MIN_SUPPORTED_VERSION_CODE: '1',
      }),
    ).getUpdateManifest();

    expect(manifest).toEqual({
      enabled: true,
      packageName: 'com.roomservice.tv',
      latestVersionCode: 11,
      latestVersionName: '0.4.7',
      apkUrl: 'https://updates.example.com/egi-tv/11/app-release.apk',
      sha256: 'a'.repeat(64),
      certificateSha256: 'b'.repeat(64),
      releaseId: 'tv-0.4.7',
      mandatory: false,
      minSupportedVersionCode: 1,
    });
  });
});
