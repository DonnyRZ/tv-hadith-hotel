import { HttpStatus, Inject, Injectable } from '@nestjs/common';

import { ApiException } from '../auth/api-exception';
import { RECEPTIONIST_REPOSITORY } from '../receptionist/receptionist.repository';
import type { ReceptionistRepository } from '../receptionist/receptionist.repository';
import { TvService } from '../tv/tv.service';
import { GUEST_QR_TOKEN_REPOSITORY } from './guest-qr.repository';
import type { GuestQrTokenRepository } from './guest-qr.repository';
import type { ResolvedGuestContext } from './guest.types';

@Injectable()
export class GuestContextResolver {
  public constructor(
    @Inject(GUEST_QR_TOKEN_REPOSITORY)
    private readonly qrTokenRepository: GuestQrTokenRepository,
    @Inject(RECEPTIONIST_REPOSITORY)
    private readonly receptionistRepository: ReceptionistRepository,
    private readonly tvService: TvService,
  ) {}

  public async resolve(
    guestAccessToken: string | undefined,
    deviceCredential: string | undefined,
  ): Promise<ResolvedGuestContext> {
    const normalizedGuestToken = guestAccessToken?.trim();
    if (normalizedGuestToken !== undefined && normalizedGuestToken.length > 0) {
      const token = await this.qrTokenRepository.findActiveByToken(normalizedGuestToken);
      if (token === null) throw this.unauthorized();
      return this.resolveActiveAssignment(token.roomId, 'QR');
    }

    const normalizedDeviceCredential = deviceCredential?.trim();
    if (normalizedDeviceCredential !== undefined && normalizedDeviceCredential.length > 0) {
      const tvContext = await this.tvService.getContext(normalizedDeviceCredential);
      return this.resolveActiveAssignment(tvContext.device.room.id, 'TV');
    }

    throw this.unauthorized();
  }

  private async resolveActiveAssignment(
    roomId: string,
    source: ResolvedGuestContext['source'],
  ): Promise<ResolvedGuestContext> {
    const assignment = await this.receptionistRepository.findActiveAssignmentByRoomId(roomId);
    if (assignment === null) throw this.contextNotFound();

    return {
      room: { ...assignment.room },
      assignment,
      source,
    };
  }

  private unauthorized(): ApiException {
    return new ApiException(HttpStatus.UNAUTHORIZED, {
      code: 'GUEST_CONTEXT_UNAUTHORIZED',
      message: 'Guest access token or TV device credential is missing or invalid.',
    });
  }

  private contextNotFound(): ApiException {
    return new ApiException(HttpStatus.NOT_FOUND, {
      code: 'CONTEXT_NOT_FOUND',
      message: 'The room does not have an active guest assignment.',
    });
  }
}
