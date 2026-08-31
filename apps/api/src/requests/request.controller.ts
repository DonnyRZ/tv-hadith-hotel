import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { CurrentStaff } from '../auth/decorators/current-staff.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import type { PublicStaffUser } from '../auth/auth.types';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { StaffSessionGuard } from '../auth/guards/staff-session.guard';
import { ListDepartmentRequestsDto } from './dto/list-department-requests.dto';
import { ListRoomManagerRequestsDto } from './dto/list-room-manager-requests.dto';
import { RequestService } from './request.service';

@Controller('department/requests')
@UseGuards(StaffSessionGuard, PermissionsGuard)
export class RequestController {
  public constructor(private readonly requestService: RequestService) {}

  @Get()
  @RequirePermissions('request:view')
  public list(@CurrentStaff() staff: PublicStaffUser, @Query() query: ListDepartmentRequestsDto) {
    return this.requestService.listDepartmentRequests(staff, query);
  }

  @Get(':requestId')
  @RequirePermissions('request:view')
  public get(
    @CurrentStaff() staff: PublicStaffUser,
    @Param('requestId', new ParseUUIDPipe()) requestId: string,
  ) {
    return this.requestService.getDepartmentRequest(staff, requestId);
  }

  @Post(':requestId/confirm')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('request:confirm')
  public confirm(
    @CurrentStaff() staff: PublicStaffUser,
    @Param('requestId', new ParseUUIDPipe()) requestId: string,
  ) {
    return this.requestService.confirmDepartmentRequest(staff, requestId);
  }

  @Post(':requestId/done')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('request:complete')
  public done(
    @CurrentStaff() staff: PublicStaffUser,
    @Param('requestId', new ParseUUIDPipe()) requestId: string,
  ) {
    return this.requestService.completeDepartmentRequest(staff, requestId);
  }
}

@Controller('room-manager/requests')
@UseGuards(StaffSessionGuard, PermissionsGuard)
export class RoomManagerRequestController {
  public constructor(private readonly requestService: RequestService) {}

  @Get()
  @RequirePermissions('room-manager:monitor')
  public list(@CurrentStaff() staff: PublicStaffUser, @Query() query: ListRoomManagerRequestsDto) {
    return this.requestService.listRoomManagerRequests(staff, query);
  }

  @Get(':requestId')
  @RequirePermissions('room-manager:monitor')
  public get(
    @CurrentStaff() staff: PublicStaffUser,
    @Param('requestId', new ParseUUIDPipe()) requestId: string,
  ) {
    return this.requestService.getRoomManagerRequest(staff, requestId);
  }
}
