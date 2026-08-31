import { createHash, randomBytes, randomUUID } from 'node:crypto';

import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import type { TvDeviceRepository } from './tv-device.repository';
import { TvDeviceRoomConflictError } from './tv-device.repository';
import type {
  CreatedTvDevice,
  ListTvDevicesInput,
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
      const pairingCode = this.createUniquePairingCode(existing.id);
      const credential = createDeviceCredential();
      const createdAt = new Date();
      existing.pairingCodeHash = hashTvSecret(pairingCode);
      existing.pairingExpiresAt = new Date(createdAt.getTime() + ttlSeconds * 1000).toISOString();
      existing.credentialHash = hashTvSecret(credential);
      existing.credential = credential;
      existing.status = 'PENDING';
      existing.room = null;
      existing.deviceModel = input.deviceModel;
      existing.appVersion = input.appVersion;
      existing.androidApiLevel = input.androidApiLevel;
      existing.pairedAt = null;
      existing.claimedAt = null;
      existing.revokedAt = null;
      this.records.set(existing.id, existing);
      this.pairingCodes.set(existing.id, pairingCode);
      return {
        record: cloneRecord(existing),
        pairingCode,
      };
    }

    const pairingCode = this.createUniquePairingCode();

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

  public async list(input: ListTvDevicesInput) {
    const filtered = [...this.records.values()]
      .filter((record) => input.roomId === undefined || record.room?.id === input.roomId)
      .filter((record) => input.status === undefined || record.status === input.status)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    const offset = (input.page - 1) * input.pageSize;
    return {
      items: filtered.slice(offset, offset + input.pageSize).map(cloneRecord),
      total: filtered.length,
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

    if (
      [...this.records.values()].some(
        (candidate) =>
          candidate.id !== recordId &&
          candidate.room?.id === input.roomId &&
          (candidate.status === 'PAIRED' || candidate.status === 'CLAIMED'),
      )
    ) {
      throw new TvDeviceRoomConflictError();
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

    const pairingCode = this.createUniquePairingCode(recordId);

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

  private createUniquePairingCode(excludeRecordId?: string): string {
    let pairingCode = createPairingCode();
    while (
      [...this.records.values()].some(
        (record) =>
          record.id !== excludeRecordId && record.pairingCodeHash === hashTvSecret(pairingCode),
      )
    ) {
      pairingCode = createPairingCode();
    }
    return pairingCode;
  }
}
