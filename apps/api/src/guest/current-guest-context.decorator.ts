import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import type { GuestHttpRequest } from './guest-context.guard';
import type { ResolvedGuestContext } from './guest.types';

export const CurrentGuestContext = createParamDecorator(
  (_data: unknown, context: ExecutionContext): ResolvedGuestContext => {
    const request = context.switchToHttp().getRequest<GuestHttpRequest>();
    if (request.guestContext === undefined) {
      throw new Error('CurrentGuestContext requires GuestContextGuard');
    }
    return request.guestContext;
  },
);
