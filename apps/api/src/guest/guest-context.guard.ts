import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';

import { GuestContextResolver } from './guest-context.resolver';
import type { ResolvedGuestContext } from './guest.types';

export interface GuestHttpRequest extends ExpressRequest {
  guestContext?: ResolvedGuestContext;
}

@Injectable()
export class GuestContextGuard implements CanActivate {
  public constructor(private readonly resolver: GuestContextResolver) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<GuestHttpRequest>();
    request.guestContext = await this.resolver.resolve(
      this.readHeader(request.headers['x-guest-access-token']),
      this.readHeader(request.headers['x-device-credential']),
    );
    return true;
  }

  private readHeader(value: string | string[] | undefined): string | undefined {
    return Array.isArray(value) ? value[0] : value;
  }
}
