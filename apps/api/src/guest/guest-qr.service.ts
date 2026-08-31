import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ApiException } from '../auth/api-exception';
import { RECEPTIONIST_ROOM_CATALOG } from '../receptionist/receptionist.types';
import { GUEST_QR_TOKEN_REPOSITORY, GuestQrRoomNotFoundError } from './guest-qr.repository';
import type { GuestQrTokenRepository } from './guest-qr.repository';

@Injectable()
export class GuestQrService {
  public constructor(
    @Inject(GUEST_QR_TOKEN_REPOSITORY)
    private readonly repository: GuestQrTokenRepository,
    private readonly config: ConfigService,
  ) {}

  public async issueForRoom(roomId: string) {
    const room = RECEPTIONIST_ROOM_CATALOG.find((candidate) => candidate.id === roomId);
    if (room === undefined) throw this.roomNotFound();

    try {
      const issued = await this.repository.issueForRoom(room.id);
      const qrUrl = new URL(this.config.get<string>('GUEST_WEB_URL') ?? 'http://localhost:5173');
      qrUrl.searchParams.set('access_token', issued.token);
      return {
        room: { id: room.id, number: room.number },
        qrUrl: qrUrl.toString(),
        issuedAt: issued.record.createdAt,
      };
    } catch (error) {
      if (error instanceof GuestQrRoomNotFoundError) throw this.roomNotFound();
      throw error;
    }
  }

  public async revokeForRoom(roomId: string) {
    const room = RECEPTIONIST_ROOM_CATALOG.find((candidate) => candidate.id === roomId);
    if (room === undefined) throw this.roomNotFound();
    const revoked = await this.repository.revokeForRoom(room.id);
    return {
      room: { id: room.id, number: room.number },
      revoked: revoked !== null,
      revokedAt: revoked?.revokedAt ?? null,
    };
  }

  private roomNotFound(): ApiException {
    return new ApiException(HttpStatus.NOT_FOUND, {
      code: 'ROOM_NOT_FOUND',
      message: 'The requested guest room does not exist.',
    });
  }
}
