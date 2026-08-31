import { createHash, randomBytes, randomUUID } from 'node:crypto';

import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import type { TvDeviceRepository } from './tv-device.repository';
import type {
  CreatedTvDevice,
  PairTvDeviceInput,
  StartTvProvisioningInput,
  TvDeviceRecord,
} from './tv.types';

export function hashTvSecret(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function createPairingCode(): string {
  return randomBytes(3).readUIntBE(0, 3).toString(10).padStart(6, '0').slice(-6);
}

function createDeviceCredential(): string {
  return `tv_${randomBytes(32).toString('base64url')}`;
}

function cloneRecord(record: TvDeviceRecord): TvDeviceRecord {
  return {
    ...record,
    room: record.room === null ? null : { ...record.room },
  };
}

@Injectable()
export class InMemoryTvDeviceRepository implements TvDeviceRepository {
  private readonly records = new Map<string, TvDeviceRecord>();

  private readonly pairingCodes = new Map<string, string>();

  public async createPending(
    input: StartTvProvisioningInput,
    ttlSeconds: number,
  ): Promise<CreatedTvDevice> {
    const existing = [...this.records.values()].find(
      (record) => record.installationId === input.installationId && record.status !== 'REVOKED',
    );

    if (existing !== undefined) {
      return {
        record: cloneRecord(existing),
        pairingCode: this.pairingCodes.get(existing.id) ?? '',
      };
    }

    let pairingCode = createPairingCode();
    while (
      [...this.records.values()].some(
        (record) => record.pairingCodeHash === hashTvSecret(pairingCode),
      )
    ) {
      pairingCode = createPairingCode();
    }

    const createdAt = new Date();
    const record: TvDeviceRecord = {
      id: randomUUID(),
      installationId: input.installationId,
      deviceCode: `device_${randomBytes(6).toString('base64url')}`,
      pairingCodeHash: hashTvSecret(pairingCode),
      pairingExpiresAt: new Date(createdAt.getTime() + ttlSeconds * 1000).toISOString(),
      credentialHash: '',
      credential: null,
      status: 'PENDING',
      room: null,
      deviceModel: input.deviceModel,
      appVersion: input.appVersion,
      androidApiLevel: input.androidApiLevel,
      createdAt: createdAt.toISOString(),
      pairedAt: null,
      claimedAt: null,
      revokedAt: null,
    };

    const credential = createDeviceCredential();
    record.credentialHash = hashTvSecret(credential);
    record.credential = credential;
    this.records.set(record.id, record);
    this.pairingCodes.set(record.id, pairingCode);

    return {
      record: cloneRecord(record),
      pairingCode,
    };
  }

  public async findByPairingCode(pairingCode: string): Promise<TvDeviceRecord | null> {
    const hash = hashTvSecret(pairingCode);
    const record = [...this.records.values()].find(
      (candidate) => candidate.pairingCodeHash === hash,
    );
    return record === undefined ? null : cloneRecord(record);
  }

  public async findByInstallationId(installationId: string): Promise<TvDeviceRecord | null> {
    const record = [...this.records.values()].find(
      (candidate) => candidate.installationId === installationId,
    );
    return record === undefined ? null : cloneRecord(record);
  }

  public async pair(
    recordId: string,
    input: PairTvDeviceInput,
    pairedAt: string,
  ): Promise<TvDeviceRecord> {
    const record = this.records.get(recordId);
    if (record === undefined) {
      throw new NotFoundException('TV device does not exist.');
    }
    if (record.status !== 'PENDING') {
      throw new ConflictException('TV pairing code has already been used.');
    }

    record.room = { id: input.roomId, number: input.roomNumber };
    record.status = 'PAIRED';
    record.pairedAt = pairedAt;
    this.records.set(record.id, record);

    return cloneRecord(record);
  }

  public async claim(recordId: string, claimedAt: string): Promise<TvDeviceRecord> {
    const record = this.records.get(recordId);
    if (record === undefined) {
      throw new NotFoundException('TV device does not exist.');
    }
    if (record.status !== 'PAIRED' && record.status !== 'CLAIMED') {
      throw new ConflictException('TV device is not paired yet.');
    }

    record.status = 'CLAIMED';
    record.claimedAt ??= claimedAt;
    this.records.set(record.id, record);

    return cloneRecord(record);
  }

  public async findByCredential(credential: string): Promise<TvDeviceRecord | null> {
    const hash = hashTvSecret(credential);
    const record = [...this.records.values()].find(
      (candidate) =>
        candidate.credentialHash === hash &&
        (candidate.status === 'PAIRED' || candidate.status === 'CLAIMED'),
    );
    return record === undefined ? null : cloneRecord(record);
  }

  public async revoke(recordId: string, revokedAt: string): Promise<TvDeviceRecord> {
    const record = this.records.get(recordId);
    if (record === undefined) {
      throw new NotFoundException('TV device does not exist.');
    }

    record.status = 'REVOKED';
    record.revokedAt = revokedAt;
    this.records.set(record.id, record);

    return cloneRecord(record);
  }

  public async reset(
    recordId: string,
    ttlSeconds: number,
    resetAt: string,
  ): Promise<CreatedTvDevice> {
    const record = this.records.get(recordId);
    if (record === undefined) {
      throw new NotFoundException('TV device does not exist.');
    }

    let pairingCode = createPairingCode();
    while (
      [...this.records.values()].some(
        (candidate) =>
          candidate.id !== recordId && candidate.pairingCodeHash === hashTvSecret(pairingCode),
      )
    ) {
      pairingCode = createPairingCode();
    }

    const credential = createDeviceCredential();
    record.pairingCodeHash = hashTvSecret(pairingCode);
    record.pairingExpiresAt = new Date(Date.parse(resetAt) + ttlSeconds * 1000).toISOString();
    record.credentialHash = hashTvSecret(credential);
    record.credential = credential;
    record.status = 'PENDING';
    record.room = null;
    record.pairedAt = null;
    record.claimedAt = null;
    record.revokedAt = null;
    this.records.set(record.id, record);
    this.pairingCodes.set(record.id, pairingCode);

    return {
      record: cloneRecord(record),
      pairingCode,
    };
  }
}
