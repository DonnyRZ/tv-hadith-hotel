import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { CurrentStaff } from '../auth/decorators/current-staff.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import type { PublicStaffUser } from '../auth/auth.types';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { StaffSessionGuard } from '../auth/guards/staff-session.guard';
import { AssignGuestDto } from './dto/assign-guest.dto';
import { ListFolioOrdersDto } from './dto/list-folio-orders.dto';
import { ListReceptionistRoomsDto } from './dto/list-receptionist-rooms.dto';
import { UpdateGuestAssignmentDto } from './dto/update-guest-assignment.dto';
import { ReceptionistService } from './receptionist.service';

@Controller('receptionist')
@UseGuards(StaffSessionGuard, PermissionsGuard)
export class ReceptionistController {
  public constructor(private readonly receptionistService: ReceptionistService) {}

  @Get('rooms')
  @RequirePermissions('receptionist:rooms:view')
  public listRooms(@Query() query: ListReceptionistRoomsDto) {
    return this.receptionistService.listRooms(query);
  }

  @Get('rooms/:roomId')
  @RequirePermissions('receptionist:rooms:view')
  public getRoom(@Param('roomId', new ParseUUIDPipe()) roomId: string) {
    return this.receptionistService.getRoom(roomId);
  }

  @Get('rooms/:roomId/folio')
  @RequirePermissions('receptionist:folio:view')
  public getActiveFolio(
    @Param('roomId', new ParseUUIDPipe()) roomId: string,
    @Query() query: ListFolioOrdersDto,
  ) {
    return this.receptionistService.getActiveFolio(roomId, query);
  }

  @Get('rooms/:roomId/folio/history')
  @RequirePermissions('receptionist:folio:view')
  public listFolioHistory(
    @Param('roomId', new ParseUUIDPipe()) roomId: string,
    @Query() query: ListFolioOrdersDto,
  ) {
    return this.receptionistService.listFolioHistory(roomId, query);
  }

  @Get('rooms/:roomId/folio/history/:assignmentId')
  @RequirePermissions('receptionist:folio:view')
  public getFolioHistoryDetail(
    @Param('roomId', new ParseUUIDPipe()) roomId: string,
    @Param('assignmentId', new ParseUUIDPipe()) assignmentId: string,
    @Query() query: ListFolioOrdersDto,
  ) {
    return this.receptionistService.getFolioHistoryDetail(roomId, assignmentId, query);
  }

  @Post('rooms/:roomId/guest-assignment')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('receptionist:guest:assign')
  public assignGuest(
    @Param('roomId', new ParseUUIDPipe()) roomId: string,
    @Body() input: AssignGuestDto,
    @CurrentStaff() staff: PublicStaffUser,
  ) {
    return this.receptionistService.assignGuest(roomId, input, staff);
  }

  @Patch('guest-assignments/:assignmentId')
  @RequirePermissions('receptionist:guest:update')
  public updateGuestAssignment(
    @Param('assignmentId', new ParseUUIDPipe()) assignmentId: string,
    @Body() input: UpdateGuestAssignmentDto,
  ) {
    return this.receptionistService.updateGuestAssignment(assignmentId, input);
  }

  @Post('guest-assignments/:assignmentId/checkout')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('receptionist:guest:checkout')
  public checkoutGuestAssignment(@Param('assignmentId', new ParseUUIDPipe()) assignmentId: string) {
    return this.receptionistService.checkoutGuestAssignment(assignmentId);
  }
}
