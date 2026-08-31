import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ApiException } from '../auth/api-exception';
import { RECEPTIONIST_ROOM_CATALOG } from '../receptionist/receptionist.types';
import { GUEST_QR_TOKEN_REPOSITORY, GuestQrRoomNotFoundError } from './guest-qr.repository';
import type { GuestQrTokenRepository } from './guest-qr.repository';
import type { GuestQrRoomStatus } from './guest.types';

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
      return this.toIssuedResponse(room.id, room.number, issued.token, issued.record.createdAt);
    } catch (error) {
      if (error instanceof GuestQrRoomNotFoundError) throw this.roomNotFound();
      throw error;
    }
  }

  public async issueForRooms(roomIds: string[]) {
    const uniqueRoomIds = [...new Set(roomIds)];
    if (uniqueRoomIds.length === 0 || uniqueRoomIds.length !== roomIds.length) {
      throw new ApiException(HttpStatus.BAD_REQUEST, {
        code: 'ROOM_IDS_INVALID',
        message: 'The room list must contain unique room IDs.',
      });
    }
    if (uniqueRoomIds.length > RECEPTIONIST_ROOM_CATALOG.length) {
      throw new ApiException(HttpStatus.BAD_REQUEST, {
        code: 'ROOM_IDS_TOO_MANY',
        message: `The room list cannot exceed ${RECEPTIONIST_ROOM_CATALOG.length} rooms.`,
      });
    }

    const rooms = uniqueRoomIds.map((roomId) => {
      const room = RECEPTIONIST_ROOM_CATALOG.find((candidate) => candidate.id === roomId);
      if (room === undefined) throw this.roomNotFound();
      return room;
    });

    try {
      const issued = await this.repository.issueForRooms(uniqueRoomIds);
      return {
        items: issued.map((item) => {
          const room = rooms.find((candidate) => candidate.id === item.record.roomId);
          if (room === undefined) throw this.roomNotFound();
          return this.toIssuedResponse(room.id, room.number, item.token, item.record.createdAt);
        }),
      };
    } catch (error) {
      if (error instanceof GuestQrRoomNotFoundError) throw this.roomNotFound();
      throw error;
    }
  }

  public async getForRoom(roomId: string): Promise<GuestQrRoomStatus> {
    const room = RECEPTIONIST_ROOM_CATALOG.find((candidate) => candidate.id === roomId);
    if (room === undefined) throw this.roomNotFound();
    const active = await this.repository.findActiveForRoom(room.id);
    return {
      room: { id: room.id, number: room.number },
      active: active !== null,
      issuedAt: active?.createdAt ?? null,
      revokedAt: active?.revokedAt ?? null,
    };
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

  private toIssuedResponse(roomId: string, roomNumber: string, token: string, issuedAt: string) {
    const qrUrl = new URL(this.config.get<string>('GUEST_WEB_URL') ?? 'http://localhost:5173');
    qrUrl.searchParams.set('access_token', token);
    return {
      room: { id: roomId, number: roomNumber },
      qrUrl: qrUrl.toString(),
      issuedAt,
    };
  }
}
