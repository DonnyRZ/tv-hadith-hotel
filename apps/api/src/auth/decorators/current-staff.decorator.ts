import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import type { PublicStaffUser, StaffRequest } from '../auth.types';

export const CurrentStaff = createParamDecorator(
  (_data: unknown, context: ExecutionContext): PublicStaffUser => {
    const request = context.switchToHttp().getRequest<StaffRequest>();

    if (request.staffUser === undefined) {
      throw new Error('CurrentStaff requires StaffSessionGuard');
    }

    return request.staffUser;
  },
);
