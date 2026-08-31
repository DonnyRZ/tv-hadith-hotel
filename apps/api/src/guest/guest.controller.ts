import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { StaffSessionGuard } from '../auth/guards/staff-session.guard';
import { CurrentGuestContext } from './current-guest-context.decorator';
import { CreateGuestRequestDto } from './dto/create-guest-request.dto';
import { ListGuestMenusDto } from './dto/list-guest-menus.dto';
import { ListGuestRequestsDto } from './dto/list-guest-requests.dto';
import { GuestContextGuard } from './guest-context.guard';
import { GuestQrService } from './guest-qr.service';
import { GuestService } from './guest.service';
import type { ResolvedGuestContext } from './guest.types';

@Controller('guest')
@UseGuards(GuestContextGuard)
export class GuestController {
  public constructor(private readonly guestService: GuestService) {}

  @Get('context')
  @Header('Cache-Control', 'no-store')
  public getContext(@CurrentGuestContext() context: ResolvedGuestContext) {
    return this.guestService.getContext(context);
  }

  @Get('departments')
  @Header('Cache-Control', 'no-store')
  public listDepartments() {
    return this.guestService.listDepartments();
  }

  @Get('menus')
  @Header('Cache-Control', 'no-store')
  public listMenus(
    @CurrentGuestContext() context: ResolvedGuestContext,
    @Query() query: ListGuestMenusDto,
  ) {
    return this.guestService.listMenus(context, query);
  }

  @Get('menus/:menuItemId')
  @Header('Cache-Control', 'no-store')
  public getMenuItem(
    @CurrentGuestContext() context: ResolvedGuestContext,
    @Param('menuItemId', new ParseUUIDPipe()) menuItemId: string,
  ) {
    return this.guestService.getMenuItem(context, menuItemId);
  }

  @Get('requests')
  @Header('Cache-Control', 'no-store')
  public listRequests(
    @CurrentGuestContext() context: ResolvedGuestContext,
    @Query() query: ListGuestRequestsDto,
  ) {
    return this.guestService.listRequests(context, query);
  }

  @Post('requests')
  @HttpCode(HttpStatus.CREATED)
  public createRequest(
    @CurrentGuestContext() context: ResolvedGuestContext,
    @Body() input: CreateGuestRequestDto,
  ) {
    return this.guestService.createRequest(context, input);
  }

  @Get('requests/:requestId')
  @Header('Cache-Control', 'no-store')
  public getRequest(
    @CurrentGuestContext() context: ResolvedGuestContext,
    @Param('requestId', new ParseUUIDPipe()) requestId: string,
  ) {
    return this.guestService.getRequest(context, requestId);
  }
}

@Controller('receptionist/rooms')
@UseGuards(StaffSessionGuard, PermissionsGuard)
@RequirePermissions('receptionist:guest:assign')
export class GuestQrController {
  public constructor(private readonly guestQrService: GuestQrService) {}

  @Post(':roomId/guest-access-token')
  @HttpCode(HttpStatus.OK)
  public issueToken(@Param('roomId', new ParseUUIDPipe()) roomId: string) {
    return this.guestQrService.issueForRoom(roomId);
  }

  @Post(':roomId/guest-access-token/revoke')
  @HttpCode(HttpStatus.OK)
  public revokeToken(@Param('roomId', new ParseUUIDPipe()) roomId: string) {
    return this.guestQrService.revokeForRoom(roomId);
  }
}
