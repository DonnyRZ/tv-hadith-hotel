import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

import { AuthService } from '../auth.service';
import type { StaffRequest } from '../auth.types';

@Injectable()
export class StaffSessionGuard implements CanActivate {
  public constructor(private readonly authService: AuthService) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<StaffRequest>();
    const staffUser = await this.authService.getCurrentStaffUser(request.session);
    request.staffUser = staffUser;
    return true;
  }
}
