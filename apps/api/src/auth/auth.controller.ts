import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';

import { ApiException } from './api-exception';
import { STAFF_SESSION_COOKIE } from './auth.constants';
import type { StaffRequest } from './auth.types';
import { AuthService } from './auth.service';
import { StaffLoginDto } from './dto/staff-login.dto';
import { CurrentStaff } from './decorators/current-staff.decorator';
import { StaffSessionGuard } from './guards/staff-session.guard';
import { staffSessionCookieOptions } from './session.middleware';

@Controller('auth')
export class AuthController {
  public constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('staff/login')
  @HttpCode(HttpStatus.OK)
  public login(@Body() credentials: StaffLoginDto, @Req() request: StaffRequest) {
    return this.authService.login(credentials, request);
  }

  @Post('staff/logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(StaffSessionGuard)
  public async logout(
    @Req() request: StaffRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.authService.logout(request.session);
    response.clearCookie(STAFF_SESSION_COOKIE, staffSessionCookieOptions(this.config));
  }

  @Get('me')
  @UseGuards(StaffSessionGuard)
  public getCurrentStaffUser(@CurrentStaff() staffUser: StaffRequest['staffUser']) {
    if (staffUser === undefined) {
      throw new ApiException(HttpStatus.UNAUTHORIZED, {
        code: 'UNAUTHORIZED',
        message: 'Staff session is missing or invalid.',
      });
    }

    return staffUser;
  }
}
