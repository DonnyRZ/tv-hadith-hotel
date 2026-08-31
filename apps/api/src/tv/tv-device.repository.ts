import type {
  PairTvDeviceInput,
  StartTvProvisioningInput,
  CreatedTvDevice,
  ListTvDevicesInput,
  TvDeviceRecord,
} from './tv.types';

export const TV_DEVICE_REPOSITORY = Symbol('TV_DEVICE_REPOSITORY');

export class TvDeviceRoomNotFoundError extends Error {
  public constructor() {
    super('The requested TV room does not exist.');
    this.name = 'TvDeviceRoomNotFoundError';
  }
}

export class TvDeviceRoomConflictError extends Error {
  public constructor() {
    super('The room already has an active TV device.');
    this.name = 'TvDeviceRoomConflictError';
  }
}

export interface TvDeviceRepository {
  createPending(input: StartTvProvisioningInput, ttlSeconds: number): Promise<CreatedTvDevice>;
  list(input: ListTvDevicesInput): Promise<{ items: TvDeviceRecord[]; total: number }>;
  findByPairingCode(pairingCode: string): Promise<TvDeviceRecord | null>;
  findByInstallationId(installationId: string): Promise<TvDeviceRecord | null>;
  pair(recordId: string, input: PairTvDeviceInput, pairedAt: string): Promise<TvDeviceRecord>;
  claim(recordId: string, claimedAt: string): Promise<TvDeviceRecord>;
  findByCredential(credential: string): Promise<TvDeviceRecord | null>;
  revoke(recordId: string, revokedAt: string): Promise<TvDeviceRecord>;
  reset(recordId: string, ttlSeconds: number, resetAt: string): Promise<CreatedTvDevice>;
}
