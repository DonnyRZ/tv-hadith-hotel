import type {
  PairTvDeviceInput,
  StartTvProvisioningInput,
  CreatedTvDevice,
  TvDeviceRecord,
} from './tv.types';

export const TV_DEVICE_REPOSITORY = Symbol('TV_DEVICE_REPOSITORY');

export interface TvDeviceRepository {
  createPending(input: StartTvProvisioningInput, ttlSeconds: number): Promise<CreatedTvDevice>;
  findByPairingCode(pairingCode: string): Promise<TvDeviceRecord | null>;
  findByInstallationId(installationId: string): Promise<TvDeviceRecord | null>;
  pair(recordId: string, input: PairTvDeviceInput, pairedAt: string): Promise<TvDeviceRecord>;
  claim(recordId: string, claimedAt: string): Promise<TvDeviceRecord>;
  findByCredential(credential: string): Promise<TvDeviceRecord | null>;
  revoke(recordId: string, revokedAt: string): Promise<TvDeviceRecord>;
  reset(recordId: string, ttlSeconds: number, resetAt: string): Promise<CreatedTvDevice>;
}
