import { HttpStatus, Inject, Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ApiException } from '../auth/api-exception';
import { RECEPTIONIST_REPOSITORY } from '../receptionist/receptionist.repository';
import type { ReceptionistRepository } from '../receptionist/receptionist.repository';
import { TV_DEVICE_REPOSITORY } from './tv-device.repository';
import type { TvDeviceRepository } from './tv-device.repository';
import type {
  ClaimTvProvisioningInput,
  PairTvDeviceInput,
  StartTvProvisioningInput,
  TvContext,
  TvDevicePublic,
  TvDeviceRecord,
} from './tv.types';

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

@Injectable()
export class TvService {
  private readonly rateLimits = new Map<string, RateLimitRecord>();

  public constructor(
    @Inject(TV_DEVICE_REPOSITORY) private readonly repository: TvDeviceRepository,
    private readonly config: ConfigService,
    @Optional()
    @Inject(RECEPTIONIST_REPOSITORY)
    private readonly receptionistRepository?: ReceptionistRepository,
  ) {}

  public async startProvisioning(input: StartTvProvisioningInput) {
    this.assertRateLimit(`start:${input.installationId}`);
    const ttlSeconds = this.readPairingTtlSeconds();
    const created = await this.repository.createPending(input, ttlSeconds);

    return {
      deviceId: created.record.id,
      deviceCode: created.record.deviceCode,
      pairingCode: created.pairingCode,
      expiresAt: created.record.pairingExpiresAt,
    };
  }

  public async pairDevice(input: PairTvDeviceInput) {
    this.assertRateLimit(`pair:${input.pairingCode}`);
    const record = await this.requirePairingCode(input.pairingCode);
    this.assertNotExpired(record);
    const pairedAt = new Date().toISOString();
    const paired = await this.repository.pair(record.id, input, pairedAt);

    return {
      device: this.toPublicDevice(paired),
      pairedAt,
    };
  }

  public async claimProvisioning(input: ClaimTvProvisioningInput) {
    this.assertRateLimit(`claim:${input.installationId}`);
    const record = await this.requirePairingCode(input.pairingCode);
    if (record.installationId !== input.installationId) {
      throw new ApiException(HttpStatus.NOT_FOUND, {
        code: 'PAIRING_CODE_NOT_FOUND',
        message: 'The pairing code does not belong to this TV installation.',
      });
    }
    this.assertNotExpired(record);

    if (record.status === 'PENDING') {
      throw new ApiException(HttpStatus.CONFLICT, {
        code: 'PAIRING_PENDING',
        message: 'The TV pairing code is waiting for a receptionist confirmation.',
      });
    }
    if (record.room === null || record.credential === null) {
      throw new ApiException(HttpStatus.CONFLICT, {
        code: 'PAIRING_INCOMPLETE',
        message: 'The TV pairing has not finished yet.',
      });
    }

    const claimed = await this.repository.claim(record.id, new Date().toISOString());
    return {
      credential: claimed.credential as string,
      device: this.toPublicDevice(claimed),
    };
  }

  public async getContext(credential: string | undefined): Promise<TvContext> {
    if (credential === undefined || credential.trim().length === 0) {
      throw new ApiException(HttpStatus.UNAUTHORIZED, {
        code: 'DEVICE_UNAUTHORIZED',
        message: 'Smart TV device credential is missing or invalid.',
      });
    }

    const record = await this.repository.findByCredential(credential);
    if (record === null) {
      throw new ApiException(HttpStatus.UNAUTHORIZED, {
        code: 'DEVICE_UNAUTHORIZED',
        message: 'Smart TV device credential is missing or invalid.',
      });
    }
    if (record.room === null) {
      throw new ApiException(HttpStatus.NOT_FOUND, {
        code: 'CONTEXT_NOT_FOUND',
        message: 'The TV device is not mapped to a room.',
      });
    }

    const activeAssignment =
      this.receptionistRepository === undefined
        ? null
        : await this.receptionistRepository.findActiveAssignmentByRoomId(record.room.id);
    const guestName = activeAssignment?.guestName ?? null;

    return {
      device: this.toPublicDevice(record),
      roomStatus: guestName === null ? 'VACANT' : 'OCCUPIED',
      welcome: {
        message: guestName === null ? 'Welcome' : `Welcome, ${guestName}`,
        guestName,
        personalized: guestName !== null,
      },
    };
  }

  public async revokeDevice(deviceId: string) {
    this.assertRateLimit(`revoke:${deviceId}`);
    const revoked = await this.repository.revoke(deviceId, new Date().toISOString());
    return {
      deviceId: revoked.id,
      status: revoked.status,
      revokedAt: revoked.revokedAt as string,
    };
  }

  public async resetDevice(deviceId: string) {
    this.assertRateLimit(`reset:${deviceId}`);
    const resetAt = new Date().toISOString();
    const reset = await this.repository.reset(deviceId, this.readPairingTtlSeconds(), resetAt);
    return {
      deviceId: reset.record.id,
      status: reset.record.status,
      pairingExpiresAt: reset.record.pairingExpiresAt,
    };
  }

  private async requirePairingCode(pairingCode: string): Promise<TvDeviceRecord> {
    const record = await this.repository.findByPairingCode(pairingCode);
    if (record === null) {
      throw new ApiException(HttpStatus.NOT_FOUND, {
        code: 'PAIRING_CODE_NOT_FOUND',
        message: 'The TV pairing code is invalid or no longer available.',
      });
    }

    return record;
  }

  private assertNotExpired(record: TvDeviceRecord): void {
    if (Date.parse(record.pairingExpiresAt) <= Date.now()) {
      throw new ApiException(HttpStatus.GONE, {
        code: 'PAIRING_CODE_EXPIRED',
        message: 'The TV pairing code has expired. Start a new pairing session.',
      });
    }
  }

  private assertRateLimit(key: string): void {
    const now = Date.now();
    const existing = this.rateLimits.get(key);
    if (existing === undefined || existing.resetAt <= now) {
      this.rateLimits.set(key, { count: 1, resetAt: now + 60_000 });
      return;
    }

    if (existing.count >= 10) {
      throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, {
        code: 'TOO_MANY_REQUESTS',
        message: 'Too many TV provisioning attempts. Try again later.',
      });
    }

    existing.count += 1;
  }

  private readPairingTtlSeconds(): number {
    const configured = Number(this.config.get<string>('TV_PAIRING_TTL_SECONDS') ?? 600);
    return Number.isInteger(configured) && configured >= 60 && configured <= 3600
      ? configured
      : 600;
  }

  private toPublicDevice(record: TvDeviceRecord): TvDevicePublic {
    if (record.room === null) {
      throw new ApiException(HttpStatus.NOT_FOUND, {
        code: 'CONTEXT_NOT_FOUND',
        message: 'The TV device is not mapped to a room.',
      });
    }

    return {
      id: record.id,
      deviceCode: record.deviceCode,
      room: record.room,
    };
  }
}
